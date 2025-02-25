import { Command } from "@effect/cli"
import { getHydraContracts } from "@hydra-manager/cli/hydra/l1/index"
import { getHeadStateDatum, HeadStateDatum } from "@hydra-manager/cli/hydra/l1/plutus"
import { getAllActiveHydraHeads, getMyActiveHydraHeads } from "@hydra-manager/cli/hydra/l1/query"
import { createCloseOpenHeadTransaction, createFanOutTransaction } from "@hydra-manager/cli/hydra/l1/transaction"
import type { HydraContracts } from "@hydra-manager/cli/hydra/l1/types"
import { getCardanoProvider } from "@hydra-manager/cli/utils"
import { input, select } from "@inquirer/prompts"
import type { UTxO } from "@lucid-evolution/lucid"
import { Data } from "@lucid-evolution/lucid"
import { Effect, pipe } from "effect"
import ora from "ora-classic"
import { sleep } from "../../hydra/utils.js"
import { logObject } from "./utils.js"

declare global {
  interface BigInt {
    toJSON: () => string
  }
}

BigInt.prototype.toJSON = function() {
  return this.toString()
}

type ActionValue = (() => Promise<any>) | (() => any)

type ActionChoice = {
  name: string
  value: ActionValue
  disabled?: boolean
}

export const l1Command = Command.make("l1", {}, () => {
  return pipe(
    Effect.tryPromise(async () => {
      const manualCommandImpl = new L1CommandImpl()

      await sleep(1000)

      await manualCommandImpl.loop()
    }),
    Effect.catchAll((error) => {
      console.error(error)
      return Effect.succeed(0)
    })
  )
})

class L1CommandImpl {
  private _hydraContracts: HydraContracts | undefined
  private _finished: boolean = false
  activeHydraHeads: Array<{ utxo: UTxO; datum: HeadStateDatum }> = []
  myActiveHydraHeads: Array<{ utxo: UTxO; datum: HeadStateDatum }> = []

  constructor() {
  }

  async fetchHydraContracts() {
    this._hydraContracts = await getHydraContracts()
  }

  get isHydraContractsDefined() {
    return !!this._hydraContracts
  }

  stop() {
    this._finished = true
  }

  async loop() {
    while (!this._finished) {
      try {
        const answer = await select<ActionValue>({
          message: "What do you want to do?",
          choices: selectActionSet(this)
        })
        await answer()
      } catch (error) {
        console.error(`\nCommand failed:\n\n${error}\n\n`)
      }
    }
  }
}

const selectActionSet = (l1CommandImpl: L1CommandImpl): Array<ActionChoice> => {
  if (l1CommandImpl.isHydraContractsDefined) {
    return [
      {
        name: "Fetch Hydra Contracts",
        value: l1CommandImpl.fetchHydraContracts
      }
    ]
  }
  return [
    { name: "Datum Actions", value: startDatumActions },
    {
      name: "On Chain Actions",
      value: () => startOnChainActions(l1CommandImpl)
    },
    { name: "Exit", value: () => l1CommandImpl.stop() }
  ]
}

const startDatumActions = async () => {
  let finished = false
  while (!finished) {
    const answer = await select<ActionValue>({
      message: "Pick an action",
      choices: [
        ...["Initial", "Open", "Closed"].map((state) => ({
          name: `Decode ${state} State Datum`,
          value: async () => await decodeDatumAction(state)
        })),
        {
          name: "Back",
          value: () => {
            finished = true
          }
        }
      ]
    })
    await answer()
  }
}

const decodeDatumAction = async (type: string) => {
  const datum = await input({
    message: `Enter ${type} State Datum CBOR Hex string to decode`
  })
  const decoded = getHeadStateDatum(datum.trim())
  if (!decoded) throw new Error(`Not valid ${type} datum`)

  if (type == "Final" && decoded != "Final") {
    throw new Error(`Not valid Final datum`)
  }
  if (typeof decoded == "string") throw new Error(`Not valid ${type} datum`)

  if (!(type in decoded)) {
    throw new Error(
      `This is ${Object.keys(decoded)[0]} datum, not ${type} datum`
    )
  }
  console.log("\nDecoded Datum is:\n")
  logObject(decoded)
  console.log("\n")
}

const startOnChainActions = async (l1CommandImpl: L1CommandImpl) => {
  let finished = false
  while (!finished) {
    const answer = await select<ActionValue>({
      message: "Pick an action",
      choices: [
        {
          name: "All Active Hydra Heads",
          value: () => activeHydraHeadsAction(l1CommandImpl, "All")
        },
        {
          name: "My Active Hydra Heads",
          value: () => activeHydraHeadsAction(l1CommandImpl, "Mine")
        },
        {
          name: "Back",
          value: () => {
            finished = true
          }
        }
      ]
    })
    await answer()
  }
}

const activeHydraHeadsAction = async (
  l1CommandImpl: L1CommandImpl,
  type: "All" | "Mine"
) => {
  const key = type == "All" ? "activeHydraHeads" : "myActiveHydraHeads"

  let finished = false
  while (!finished) {
    const action = await select<ActionValue>({
      message: "Pick Hydra Head UTxO",
      choices: [
        ...l1CommandImpl[key].map((head) => ({
          name: `${head.utxo.txHash}${head.utxo.outputIndex}`,
          value: async () => {
            if (type == "All") {
              logObject(head.datum)
            } else {
              await myHydraHeadAction(l1CommandImpl, head)
            }
          }
        })),
        {
          name: `Fetch ${type == "All" ? "All" : "Your"} Active Hydra Heads`,
          value: async () => {
            l1CommandImpl[key] = await fetchActiveHydraHeads(type)
          }
        },
        {
          name: "Back",
          value: () => (finished = true)
        }
      ]
    })
    await action()
  }
}

const fetchActiveHydraHeads = async (type: "All" | "Mine") => {
  const utxos = type == "All"
    ? await getAllActiveHydraHeads()
    : await getMyActiveHydraHeads()
  return utxos
    .map((utxo) => {
      if (!utxo.datum) return
      try {
        const datum = Data.from(utxo.datum, HeadStateDatum)
        return { utxo, datum }
      } catch {
        return
      }
    })
    .filter(Boolean) as Array<{ utxo: UTxO; datum: HeadStateDatum }>
}

const myHydraHeadAction = async (l1CommandImpl: L1CommandImpl, hydraHead: { utxo: UTxO; datum: HeadStateDatum }) => {
  let finished: boolean = false
  while (!finished) {
    logObject(hydraHead.datum)
    console.log("\n")
    const action = await select<ActionValue>({
      message: "Select Action",
      choices: [
        {
          name: "Close Hydra Head",
          value: async () => {
            await closeOpenHydraHeadAction(hydraHead)
            finished = true
          },
          disabled: !(typeof hydraHead.datum == "object" && "Open" in hydraHead.datum)
        },
        {
          name: "Fan out Hydra Head",
          value: async () => {
            await fanoutClosedHydraHeadAction(hydraHead)
            finished = true
          },
          disabled: !(typeof hydraHead.datum == "object" && "Closed" in hydraHead.datum)
        },
        {
          name: "Back",
          value: () => {
            finished = true
          }
        }
      ]
    })
    await action()
  }
}

const closeOpenHydraHeadAction = async (hydraHead: { utxo: UTxO; datum: HeadStateDatum }) => {
  const spinner = ora("Making Close Tx")
  try {
    const tx = await createCloseOpenHeadTransaction(hydraHead.utxo)
    spinner.info("Submitting transaction")
    const provider = getCardanoProvider()
    const txHash = await provider.submitTx(tx)
    spinner.succeed("Transaction Submitted")
    console.log("\nTx Hash is")
    console.log(txHash)
    console.log("\nWait till tx is on chain and contestation period ends\n")
  } catch (err) {
    spinner.fail("Failed to create close Tx")
    throw err
  }
}

const fanoutClosedHydraHeadAction = async (hydraHead: { utxo: UTxO; datum: HeadStateDatum }) => {
  const spinner = ora("Making Fan Out Tx")
  try {
    const tx = await createFanOutTransaction(hydraHead.utxo)
    spinner.info("Submitting transaction")
    const provider = getCardanoProvider()
    const txHash = await provider.submitTx(tx)
    spinner.succeed("Transaction Submitted")
    console.log("\nTx Hash is")
    console.log(txHash)
    console.log("\n")
  } catch (err) {
    spinner.fail("Failed to create fanout Tx")
    throw err
  }
}
