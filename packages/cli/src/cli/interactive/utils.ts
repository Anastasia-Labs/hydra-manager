import type { HydraHead } from "@hydra-manager/cli/hydra/head"
import { selectWallet } from "@hydra-manager/cli/hydra/utils"
import { select } from "@inquirer/prompts"
import type { UTxO } from "@lucid-evolution/lucid"
import type { Action, ActionCallback } from "./types.js"

import { select as selectPro } from "inquirer-select-pro"

export async function selectParticipant(hydraHead: HydraHead) {
  const selectedParticipant = await selectPro(
    {
      message: "Select participants",
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

export async function selectedUTxOs(hydraHead: HydraHead, participant: string) {
  const lucid = await hydraHead.getLucidL1()
  selectWallet(participant + "-funds", lucid)

  const participantUTxOs = await lucid.wallet().getUtxos()
  const selectedUTxOs = await selectPro(
    {
      message: "Select UTXOs to commit",
      multiple: true,
      options: participantUTxOs.map((utxo) => ({
        name: `${utxo.txHash}#${utxo.outputIndex} (${utxo.assets["lovelace"] / 1000000n} ADA)`,
        value: utxo
      }))
    }
  )

  if (!selectedUTxOs) {
    throw new Error("No UTXOs selected")
  }
  return selectedUTxOs as Array<UTxO>
}

export const actionLoop = async (hydraHead: HydraHead, actionSet: Array<Action>) => {
  let exit = false
  while (!exit) {
    try {
      const answer = await select<ActionCallback>({
        message: "What do you want to do?",
        choices: [...actionSet, {
          name: "Exit",
          value: async () => {
            exit = true
          }
        }]
      })
      await answer(hydraHead)
    } catch (error) {
      console.error(`\nCommand failed:\n\n${error}\n\n`)
    }
  }
}
