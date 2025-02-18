import { Command } from "@effect/cli"
import type { HydraManagerConfig } from "@hydra-manager/cli/hydra/types"
import { select } from "@inquirer/prompts"
import { Blockfrost, Koios, type Provider } from "@lucid-evolution/lucid"
import { Effect, pipe } from "effect"
import { HydraHead } from "../../hydra/head.js"
import { sleep } from "../../hydra/utils.js"
import config from "../config.js"
import { processManyTransactionsDatasetAction } from "./actions/datasets.js"
import {
  closeHeadAction,
  commitToHeadAction,
  createDummyTransactionSendingAllFunds,
  fanoutFundsAction,
  initHeadAction,
  processDatasetAction,
  processManyTransactionsIntervalAction,
  processNewLargeUTxosDatasetAction
} from "./actions/index.js"
import { mainMenuL1WalletActions } from "./actions/l1-wallet.js"
import type { ActionCallback } from "./types.js"

declare global {
  interface BigInt {
    toJSON: () => string
  }
}

BigInt.prototype.toJSON = function() {
  return this.toString()
}

export const interactiveCommand = Command.make("interactive", {}, () => {
  return pipe(
    Effect.tryPromise(async () => {
      const manualCommandImpl = new ManualCommandImpl(config)

      await sleep(1000)

      await manualCommandImpl.loop()
    }),
    Effect.catchAll((error) => {
      console.error(error)
      return Effect.succeed(0)
    })
  )
})

class ManualCommandImpl {
  private _hydraHead: HydraHead
  private _abortController: AbortController
  private _config: HydraManagerConfig

  constructor(config: HydraManagerConfig) {
    this._config = config

    let provider: Provider
    if (process.env.BLOCKFROST_PROJECT_ID) {
      provider = new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", process.env.BLOCKFROST_PROJECT_ID)
    } else {
      provider = new Koios("https://preprod.koios.rest/api/v1")
    }

    this._hydraHead = new HydraHead(provider, this._config.nodes)
    this._abortController = new AbortController()

    this._hydraHead.on("status", () => {
      this._abortController.abort()
      this._abortController = new AbortController()
    })
  }

  async loop() {
    while (true) {
      try {
        const answer = await select<ActionCallback>({
          message: "What do you want to do?",
          choices: selectActionSet(this._hydraHead)
        }, { signal: this._abortController.signal })
        await answer(this._hydraHead)
      } catch (error) {
        if (error instanceof Error && error.name === "AbortPromptError") {
          console.log(`\n\nNew status detected: ${this._hydraHead.status}, new actions available\n\n`)
        } else {
          console.error(`\nCommand failed:\n\n${error}\n\n`)
        }
      }
    }
  }
}

const selectActionSet = (hydraHead: HydraHead): Array<{ name: string; value: ActionCallback }> => {
  switch (hydraHead.status) {
    case "IDLE":
    case "FINAL":
      return [mainMenuL1WalletActions, initHeadAction]
    case "INITIALIZING":
      return [
        mainMenuL1WalletActions,
        commitToHeadAction,
        processDatasetAction,
        processNewLargeUTxosDatasetAction,
        processManyTransactionsDatasetAction,
        processManyTransactionsIntervalAction
      ]
    case "OPEN":
      return [mainMenuL1WalletActions, closeHeadAction, createDummyTransactionSendingAllFunds]
    case "FANOUT_POSSIBLE":
      return [mainMenuL1WalletActions, fanoutFundsAction]
    default:
      return [mainMenuL1WalletActions]
  }
}
