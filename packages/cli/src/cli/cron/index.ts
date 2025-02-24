import { Command, Options } from "@effect/cli"
import type { HydraManagerConfig } from "@hydra-manager/cli/hydra/types"
import { Blockfrost, Koios, type Provider } from "@lucid-evolution/lucid"
import { Effect, pipe } from "effect"
import { HydraHead } from "../../hydra/head.js"
import { sleep } from "../../hydra/utils.js"
import configs from "../config.js"
import {
  closeHeadAction,
  fanoutFundsAction,
  initHeadAction,
  processManyTransactionsIntervalAction,
  processNewLargeUTxOsIntervalAction
} from "../interactive/actions/index.js"
import { Monitor } from "../interactive/actions/monitor.js"
import type { ActionCallback, CronConfig } from "../interactive/types.js"

declare global {
  interface BigInt {
    toJSON: () => string
  }
}

BigInt.prototype.toJSON = function() {
  return this.toString()
}

const participantNames = configs.nodes.map((item) => item.name)

// Define Argument
const participantOptions = Options.choice("participant", participantNames)
const jobOptions = Options.choice("job", ["many-txs", "large-utxos"])
const intervalOptions = Options.text("interval").pipe(
  Options.withDescription("Run process every x seconds")
)

export const cronCommand = Command.make(
  "cron",
  {
    participant: participantOptions,
    job: jobOptions,
    interval: intervalOptions
  },
  ({ interval, job, participant }) => {
    return pipe(
      Effect.tryPromise(async () => {
        const intervalValue = Math.floor(Number(interval))
        if (isNaN(intervalValue) || intervalValue <= 0) {
          throw new Error("Invalid interval")
        }
        if (intervalValue < 60) {
          throw new Error("Interval must be at least 60 seconds")
        }
        const cronCommandImpl = new CronCommandImpl(
          configs,
          participant,
          job,
          intervalValue
        )

        await sleep(1000)

        await cronCommandImpl.loop()
      }),
      Effect.catchAll((error) => {
        console.error(error)
        return Effect.succeed(0)
      })
    )
  }
)

class CronCommandImpl {
  private _hydraHead: HydraHead
  private _abortController: AbortController
  private _config: HydraManagerConfig
  private _chosenParticipant: string
  private _chosenJob: string
  private _monitor: Monitor
  private _interval: number // in seconds

  constructor(
    config: HydraManagerConfig,
    chosenParticipant: string,
    chosenJob: string,
    interval: number
  ) {
    this._config = config
    this._chosenParticipant = chosenParticipant
    this._chosenJob = chosenJob
    this._interval = interval
    this._monitor = new Monitor()

    let provider: Provider
    if (process.env.BLOCKFROST_PROJECT_ID) {
      provider = new Blockfrost(
        "https://cardano-preprod.blockfrost.io/api/v0",
        process.env.BLOCKFROST_PROJECT_ID
      )
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
        const action = chooseAction(
          this._hydraHead,
          this._chosenParticipant,
          this._chosenJob,
          this._interval,
          this._monitor
        )

        if (action == "wait") await sleep(1000)
        else if (action == "exit") return
        else await action(this._hydraHead)
      } catch (error) {
        if (error instanceof Error && error.name === "AbortPromptError") {
          console.log(
            `\n\nNew status detected: ${this._hydraHead.status}, new actions available\n\n`
          )
        } else {
          console.error(`\nCommand failed:\n\n${error}\n\n`)
        }
      }
    }
  }
}

const chooseAction = (
  hydraHead: HydraHead,
  chosenParticipant: string,
  chosenJob: string,
  interval: number,
  monitor: Monitor
): ActionCallback | "wait" | "exit" => {
  const cronConfig: CronConfig = {
    chosenParticipant,
    monitor,
    interval
  }
  switch (hydraHead.status) {
    case "IDLE":
      console.log(`\n${chosenParticipant} init Hydra Head\n`)
      return initHeadAction.value
    case "FINAL":
      console.log(`\nHydra Head is finalized\n`)
      return "exit"
    case "INITIALIZING": {
      if (chosenJob === "many-txs") {
        return processManyTransactionsIntervalAction.value(cronConfig)
      } else if (chosenJob === "large-utxos") {
        return processNewLargeUTxOsIntervalAction.value(cronConfig)
      } else throw new Error("Invalid job")
    }
    case "OPEN":
      console.log(`\n${chosenParticipant} close Hydra Head\n`)
      return closeHeadAction.value
    case "FANOUT_POSSIBLE":
      console.log(`\nFanout Hydra Head\n`)
      return fanoutFundsAction.value
    default:
      return "wait"
  }
}
