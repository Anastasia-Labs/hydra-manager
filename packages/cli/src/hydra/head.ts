import type { LucidEvolution, Provider } from "@lucid-evolution/lucid"
import { Blockfrost, Koios, Lucid } from "@lucid-evolution/lucid"
import { EventEmitter } from "node:events"
import { HydraNode } from "./node.js"
import { Hydra } from "./provider.js"
import type { HydraStatus } from "./types.js"

export class HydraHead extends EventEmitter {
  private _lucidL2: Record<string, LucidEvolution>
  private _provider: Provider
  private _participants: Array<string>
  private _nodes: Record<string, HydraNode>
  private _status: HydraStatus

  constructor() {
    super()

    this._lucidL2 = {}

    this._participants = ["Alice", "Bob", "Carol", "Dave", "Erin"]

    if (process.env.BLOCKFROST_PROJECT_ID) {
      this._provider = new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", process.env.BLOCKFROST_PROJECT_ID)
    } else {
      this._provider = new Koios("https://preprod.koios.rest/api/v1")
    }

    this._nodes = this._participants.reduce((acc, participant, index) => {
      acc[participant] = new HydraNode(`http://localhost:400${index + 1}`)
      return acc
    }, {} as Record<string, HydraNode>)

    this.mainNode.connect()
    this._status = this.mainNode.status
    this.mainNode.on("status", (status) => {
      this._status = status
      this.emit("status", status)
    })
  }

  async getLucidL1() {
    return await Lucid(this._provider, "Preprod")
  }

  async getLucidL2(participant: string = this._participants[0]) {
    if (this._participants.indexOf(participant) === -1) {
      throw new Error("Participant not found")
    } else if (this._lucidL2[this._participants.indexOf(participant)] === undefined) {
      this._lucidL2[participant] = await Lucid(
        new Hydra(this._nodes[participant].url, "Preprod"),
        "Preprod"
      )
    }
    return this._lucidL2[participant]
  }

  get participants() {
    return this._participants
  }
  get nodes() {
    return this._nodes
  }

  get mainNode() {
    return this._nodes["Alice"]
  }

  get status() {
    return this._status
  }
}
