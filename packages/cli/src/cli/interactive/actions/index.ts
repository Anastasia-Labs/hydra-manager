import type { HydraHead } from "@hydra-manager/cli/hydra/head"
import { selectWallet, signCommitTransaction } from "@hydra-manager/cli/hydra/utils"
import type { Assets } from "@lucid-evolution/lucid"
import { addAssets, assetsToValue, CML, utxoToCore } from "@lucid-evolution/lucid"
import ora from "ora-classic"
import type { Action } from "../types.js"
import { selectParticipant } from "../utils.js"

import { select } from "inquirer-select-pro"

export { processDatasetAction, processNewLargeUTxosDatasetAction } from "./datasets.js"

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
