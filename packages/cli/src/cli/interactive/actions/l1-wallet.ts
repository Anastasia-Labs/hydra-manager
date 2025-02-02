import type { HydraHead } from "@hydra-manager/cli/hydra/head"
import { displayBalances, displayUTxOs, selectWallet } from "@hydra-manager/cli/hydra/utils"
import { select } from "@inquirer/prompts"
import type { Action } from "../types.js"
import { actionLoop, selectParticipant } from "../utils.js"

export const mainMenuL1WalletActions: Action = {
  name: "L1 Wallet Main Menu",
  value: async (hydraHead: HydraHead): Promise<void> => {
    await actionLoop(hydraHead, [getL1BalancesAction, getL1UTxOsAction, mergeAllUtxosAction])
  }
}

const getL1BalancesAction: Action = {
  name: "Get L1 Balances",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const { participants } = hydraHead
    const lucid = await hydraHead.getLucidL1()

    await displayBalances(participants, lucid)
  }
}

const getL1UTxOsAction: Action = {
  name: "Get L1 UTxOs",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const { participants } = hydraHead
    const lucid = await hydraHead.getLucidL1()

    await displayUTxOs(participants, lucid)
  }
}

const mergeAllUtxosAction: Action = {
  name: "Merge All UTxOs",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const selectedParticipant = await selectParticipant(hydraHead)
    const walletSelected = await select({
      message: "Fund or node wallet",
      choices: ["Funds", "Node"]
    })

    const lucid = await hydraHead.getLucidL1()
    selectWallet(selectedParticipant + (walletSelected == "Funds" ? "-funds" : ""), lucid)

    const utxos = await lucid.wallet().getUtxos()

    const txBuilder = lucid.newTx()

    const tx = await txBuilder.collectFrom(utxos).complete()

    const txSigned = await tx.sign.withWallet().complete()

    const txHash = await txSigned.submit()

    console.log(`Transaction submitted: ${txHash}`)

    await lucid.awaitTx(txHash)

    console.log("Transaction confirmed")
  }
}
