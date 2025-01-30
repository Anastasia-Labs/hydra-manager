import type { HydraHead } from "@hydra-manager/cli/hydra/head"
import type { HydraUTxOs } from "@hydra-manager/cli/hydra/types"
import { signCommitTransaction, sleep } from "@hydra-manager/cli/hydra/utils"
import type { OutRef } from "@lucid-evolution/lucid"
import { CML } from "@lucid-evolution/lucid"
import * as fs from "fs"
import type { Ora } from "ora-classic"
import { chain } from "stream-chain"

const { parser } = require("stream-json")
const { ignore } = require("stream-json/filters/Ignore")
const { pick } = require("stream-json/filters/Pick")
const { streamArray } = require("stream-json/streamers/StreamArray")

export const processDataset = async (hydraHead: HydraHead, datasetFile: string, spinner: Ora) => {
  const lucidL1 = await hydraHead.getLucidL1()
  spinner.info(`Processing dataset ${datasetFile}`)

  // Use stream-json to read the file
  const metadataPipe = chain<any>([
    fs.createReadStream(`${datasetFile}`),
    parser(),
    pick({ filter: "clientDatasets" }),
    ignore({ filter: /\d+\.txSequence/ }),
    streamArray()
  ])

  spinner.start("Processing dataset metadata")

  const metadata: Array<{
    initialUTxO: HydraUTxOs
    paymentKey: any
  }> = []

  await new Promise<void>((resolve, reject) => {
    metadataPipe.on("data", (data) => metadata.push(data.value))
    metadataPipe.on("end", () => {
      resolve()
    })
    metadataPipe.on("error", (error) => {
      reject(error)
    })
  })

  if (metadata.length === 0) {
    spinner.fail("No metadata found")
    return
  } else if (metadata.length > hydraHead.participants.length) {
    spinner.fail("More client datasets than participants")
    return
  }

  if (hydraHead.status !== "OPEN") {
    await Promise.all(metadata.map(async (data, index) => {
      // Check if the initial UTxOs are present in L1
      const utxosRef: Array<OutRef> = Object.keys(data.initialUTxO).map((txRef) => {
        return { txHash: txRef.split("#")[0], outputIndex: parseInt(txRef.split("#")[1]) }
      })
      const utxos = await lucidL1.utxosByOutRef(utxosRef)

      if (utxos.length === 0) {
        throw new Error("Not initial UTxOs provided in the dataset")
      }

      if (utxos.length !== utxosRef.length) {
        throw new Error("Initial UTxOs not found in L1")
      }

      const participant = hydraHead.participants[index]

      // Create commit
      const privateKey = CML.PrivateKey.from_normal_bytes(Buffer.from(data.paymentKey.cborHex.substring(4), "hex"))
      lucidL1.selectWallet.fromPrivateKey(privateKey.to_bech32())

      const node = hydraHead.nodes[participant]

      const response = await node.commit(utxos)

      // Sign commit
      const signedResponse = await signCommitTransaction(response, lucidL1)

      // Commit to the head
      await hydraHead.mainNode.cardanoTransaction(signedResponse)
    }))

    for (let i = 0; i < hydraHead.participants.length - metadata.length; i++) {
      const index = metadata.length + i

      const participant = hydraHead.participants[index]

      const node = hydraHead.nodes[participant]

      const response = await node.commit([])
      await hydraHead.mainNode.cardanoTransaction(response)
    }
    spinner.info("All participants committed to the head")

    spinner.start("Waiting for head to open")
  }

  // Wait until the head is open
  while (hydraHead.status !== "OPEN") {
    await sleep(1000)
  }
  spinner.info("Head is open")

  // Process the tx Sequence
  spinner.start("Processing tx sequence")

  const maxBackPreasure = 64
  const stats = {
    processed: 0,
    failed: 0,
    confirmed: 0,
    initTime: Date.now()
  }
  await Promise.all(metadata.map(async (data, index) => {
    const txSequencePipe = chain<any>([
      fs.createReadStream(`${datasetFile}`),
      parser(),
      pick({ filter: RegExp(`clientDatasets.${index}.txSequence`) }),
      streamArray()
    ])

    const node = hydraHead.nodes[hydraHead.participants[index]]

    while (!txSequencePipe.readableEnded || stats.processed - (stats.confirmed + stats.failed) > 0) {
      let tx
      if (stats.processed - (stats.confirmed + stats.failed) > maxBackPreasure) {
        await sleep(1)
        continue
      }

      if ((tx = txSequencePipe.read()) !== null) {
        stats.processed++
        node.newTx(tx.value).then(async (txHash) => {
          await node.awaitTx(txHash)
          stats.confirmed++
        }).catch(() => stats.failed++)
        await sleep(1)
      } else {
        await sleep(1)
      }

      spinner.text = `Processed: ${stats.processed}, Confirmed: ${stats.confirmed}, Failed: ${stats.failed}, TPS: ${
        stats.confirmed / ((Date.now() - stats.initTime) / 1000)
      }`
    }
  }))

  spinner.info(
    `Processed: ${stats.processed}, Confirmed: ${stats.confirmed}, Failed: ${stats.failed}, TPS: ${
      stats.confirmed / ((Date.now() - stats.initTime) / 1000)
    }`
  )
  spinner.succeed("Dataset metadata processed")
}
