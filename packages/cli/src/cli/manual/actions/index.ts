import type { Assets, OutRef } from "@lucid-evolution/lucid"
import { addAssets, assetsToValue, CML, utxoToCore } from "@lucid-evolution/lucid"
import type { HydraHead } from "@template/cli/hydra/head"
import type { HydraUTxOs } from "@template/cli/hydra/types"
import {
  displayBalances,
  displayUTxOs,
  printHydraUTxOs,
  selectWallet,
  signCommitTransaction,
  sleep
} from "@template/cli/hydra/utils"
import * as fs from "fs"
import ora from "ora-classic"
import { chain } from "stream-chain"
import type { Action } from "../types.js"

const { select } = require("inquirer-select-pro")

const { parser } = require("stream-json")
const { ignore } = require("stream-json/filters/Ignore")
const { pick } = require("stream-json/filters/Pick")
const { streamArray } = require("stream-json/streamers/StreamArray")

export const getL1BalancesAction: Action = {
  name: "Get L1 Balances",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const { participants } = hydraHead
    const lucid = await hydraHead.getLucidL1()

    await displayBalances(participants, lucid)
  }
}

export const getL1UTxOsAction: Action = {
  name: "Get L1 UTxOs",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const { participants } = hydraHead
    const lucid = await hydraHead.getLucidL1()

    await displayUTxOs(participants, lucid)
  }
}

export const initHeadAction: Action = {
  name: "Init Head",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const spinner = ora("Initializing head").start()
    try {
      await hydraHead.mainNode.init()
      spinner.succeed("Head initialized")
    } catch (error) {
      spinner.fail("Failed to initialize head")
      throw error
    }
  }
}

export const commitToHeadAction: Action = {
  name: "Commit to Head",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const spinner = ora("Committing to head")

    try {
      const selectedParticipant = await selectParticipant(hydraHead)

      const lucid = await hydraHead.getLucidL1()
      selectWallet(selectedParticipant + "-funds", lucid)

      const participantUTxOs = await lucid.wallet().getUtxos()
      const selectedUTxOs = await select(
        {
          message: "Select UTXOs to commit",
          multiple: true,
          options: participantUTxOs.map((utxo) => ({
            name: `${utxo.txHash}#${utxo.outputIndex} (${utxo.assets["lovelace"] / 1000000n} ADA)`,
            value: utxo
          }))
        }
      )

      spinner.start()

      let response = await hydraHead.nodes[selectedParticipant].commit(selectedUTxOs)

      if (selectedUTxOs.length > 0) {
        response = await signCommitTransaction(response, lucid)
      }

      await hydraHead.mainNode.cardanoTransaction(response)

      spinner.succeed("Committed to head")
    } catch (error) {
      spinner.fail("Failed to commit to head")
      console.error(error)
    }
  }
}

export const closeHeadAction: Action = {
  name: "Close Head",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const spinner = ora("Closing head").start()
    try {
      await hydraHead.mainNode.close()
      spinner.succeed("Head closed")
    } catch (error) {
      spinner.fail("Failed to close head")
      throw error
    }
  }
}

export const fanoutFundsAction: Action = {
  name: "Fanout",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const spinner = ora("Fanout").start()
    try {
      await hydraHead.mainNode.fanout()
      spinner.succeed("Fanout")
    } catch (error) {
      spinner.fail("Failed to fanout")
      throw error
    }
  }
}

export const createDummyTransactionSendingAllFunds: Action = {
  name: "Create dummy transaction sending all funds to the selected wallet",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const participant = await selectParticipant(hydraHead)
    const spinner = ora(`Sending all funds to ${participant}`).start()
    try {
      const lucidL2 = await hydraHead.getLucidL2()

      console.log("Selecting participant.")
      selectWallet(participant + "-funds", lucidL2)

      const assets: Assets = (await lucidL2.wallet().getUtxos()).reduce((acc, utxo) => addAssets(acc, utxo.assets), {})
      const utxos = await lucidL2.wallet().getUtxos()
      const address = await lucidL2.wallet().address()

      if (assets["lovelace"] === undefined || assets["lovelace"] === 0n) {
        spinner.fail("No funds to send")
        return
      }

      const txBuilder = CML.TransactionBuilder.new((await lucidL2.config()).txbuilderconfig!)

      for (const utxo of utxos) {
        txBuilder.add_input(
          CML.SingleInputBuilder.new(utxoToCore(utxo).input(), utxoToCore(utxo).output()).payment_key()
        )
      }

      txBuilder.add_output(
        CML.TransactionOutputBuilder.new().with_address(CML.Address.from_bech32(address)).next()
          .with_value(assetsToValue(assets)).build()
      )

      const tx = txBuilder.build(CML.ChangeSelectionAlgo.Default, CML.Address.from_bech32(address)).build_unchecked()

      const txWitnessSet = await lucidL2.wallet().signTx(tx)

      const currentTxWitnessSet = tx.witness_set()

      currentTxWitnessSet.add_all_witnesses(txWitnessSet)

      const signedTx = CML.Transaction.new(tx.body(), currentTxWitnessSet, true)

      await lucidL2.wallet().submitTx(signedTx.to_cbor_hex())

      spinner.succeed("All funds sent")
    } catch (error) {
      spinner.fail("Failed to send all funds")
      throw error
    }
  }
}

export const createDummyTransactionSendingAllFundsLucid: Action = {
  name: "Create dummy transaction sending all funds to the selected wallet",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const lucidL2 = await hydraHead.getLucidL2()

    console.log("Selecting participant.")
    const participant = await selectParticipant(hydraHead)

    const spinner = ora("Sending all funds to your self").start()
    selectWallet(participant + "-funds", lucidL2)

    const assets: Assets = (await lucidL2.wallet().getUtxos()).reduce((acc, utxo) => addAssets(acc, utxo.assets), {})

    if (assets["lovelace"] === 0n) {
      spinner.fail("No funds to send")
      return
    }

    const tx = await (await (await lucidL2.newTx().pay.ToAddress(await lucidL2.wallet().address(), assets)).complete())
      .sign
      .withWallet().complete()

    await tx.submit()

    spinner.succeed("All funds sent")
  }
}
export const processDatasetAction: Action = {
  name: "Process Dataset",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const spinner = ora("Processing dataset")
    try {
      // Print alice funds utxos
      const lucidL1 = await hydraHead.getLucidL1()
      await selectWallet("alice-funds", lucidL1)
      await printHydraUTxOs(lucidL1)

      const privateKey = JSON.parse(
        fs.readFileSync(`./credentials/alice-funds.sk`, { encoding: "utf-8" })
      )

      const privateKeyBech32 = CML.PrivateKey.from_normal_bytes(
        Buffer.from((privateKey.cborHex as string).substring(4), "hex")
      ).to_bech32()

      spinner.info(`Selecting wallet with private key ${privateKeyBech32}`)

      // Select dataset file
      const datasetFile = await select({
        message: "Select dataset file to process",
        multiple: false,
        required: true,
        options: fs.readdirSync("./datasets").filter((file) => file.endsWith(".json")).map((file) => ({
          name: file,
          value: file
        }))
      })

      spinner.info(`Processing dataset ${datasetFile}`)

      // Use stream-json to read the file
      const metadataPipe = chain<any>([
        fs.createReadStream(`./datasets/${datasetFile}`),
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
          fs.createReadStream(`./datasets/${datasetFile}`),
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
    } catch (error) {
      spinner.fail("Failed to process dataset")
      throw error
    }
  }
}

async function selectParticipant(hydraHead: HydraHead) {
  const selectedParticipant = await select(
    {
      message: "Select participants to commit",
      multiple: false,
      required: true,
      options: hydraHead.participants.map((participant) => ({ name: participant, value: participant }))
    }
  )

  if (!selectedParticipant) {
    throw new Error("No participants selected")
  }
  return selectedParticipant
}
