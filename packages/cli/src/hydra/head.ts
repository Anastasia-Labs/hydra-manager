import type { LucidEvolution, Provider } from "@lucid-evolution/lucid"
import { Lucid } from "@lucid-evolution/lucid"
import { EventEmitter } from "node:events"
import { HydraNode } from "./node.js"
import { Hydra } from "./provider.js"
import type { HydraStatus, NodeConfig } from "./types.js"

export class HydraHead extends EventEmitter {
  private _lucidL2: Record<string, LucidEvolution>
  private _provider: Provider
  private _participants: Array<string>
  private _nodes: Record<string, HydraNode>
  private _status: HydraStatus

  constructor(provider: Provider, nodes: Array<NodeConfig>) {
    super()

    this._lucidL2 = {}

    this._participants = nodes.map((node) => node.name)

    this._provider = provider

    this._nodes = nodes.reduce((acc, node) => {
      acc[node.name] = new HydraNode(node.url)
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
