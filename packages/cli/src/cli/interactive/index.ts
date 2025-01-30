import { Command } from "@effect/cli"
import { select } from "@inquirer/prompts"
import { Effect, pipe } from "effect"
import { HydraHead } from "../../hydra/head.js"
import { sleep } from "../../hydra/utils.js"
import { processNewLargeUTxosDatasetAction } from "./actions/datasets.js"
import {
  closeHeadAction,
  commitToHeadAction,
  createDummyTransactionSendingAllFunds,
  fanoutFundsAction,
  getL1BalancesAction,
  getL1UTxOsAction,
  initHeadAction,
  processDatasetAction
} from "./actions/index.js"
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
      const manualCommandImpl = new ManualCommandImpl()

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

  constructor() {
    this._hydraHead = new HydraHead()
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
      return [getL1BalancesAction, initHeadAction, getL1UTxOsAction]
    case "INITIALIZING":
      return [getL1BalancesAction, commitToHeadAction, processDatasetAction, processNewLargeUTxosDatasetAction]
    case "OPEN":
      return [getL1BalancesAction, closeHeadAction, createDummyTransactionSendingAllFunds]
    case "FANOUT_POSSIBLE":
      return [getL1BalancesAction, fanoutFundsAction]
    default:
      return [getL1BalancesAction, getL1UTxOsAction]
  }
}
