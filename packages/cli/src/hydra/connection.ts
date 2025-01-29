import { EventEmitter } from "node:events"
import { WebSocket } from "ws"
import type { HydraStatus } from "./types.js"

export class Connection extends EventEmitter {
  private _url: string
  private _status: HydraStatus
  private _websocket: WebSocket | undefined

  constructor(url: string) {
    super()
    this._url = url
    this._status = "DISCONNECTED"
    this.setMaxListeners(10000)
  }

  async connect() {
    if (this._status !== "DISCONNECTED") {
      return
    }

    this._websocket = new WebSocket(this._url.replace("http", "ws"))
    this._status = "CONNECTING"

    this._websocket.on("open", () => {
      this._status = "CONNECTED"
    })

    this._websocket.on("message", (data) => {
      this.emit("message", data)
    })

    this._websocket.on("error", (error) => {
      console.log(`Received error: ${error}`)
    })

    this._websocket.on("close", (code) => {
      if (code === 1006) {
        this.onerror(new Error("Connection closed unexpectedly"))
      }
    })
  }

  async onerror(error: Error) {
    if (this._status === "IDLE") {
      return
    }

    if (this._status === "CONNECTED") {
      this._status = "CONNECTING"
      this.emit("close", error)
    }

    console.log(`Error: ${error}`)

    await setTimeout(() => {
      this.connect()
    }, 1000)
  }

  async disconnect() {
    if (this._status === "DISCONNECTED") {
      return
    }

    if (this._websocket && this._websocket.readyState === WebSocket.OPEN) {
      this._websocket.close(1007)
    }
    this._status = "DISCONNECTED"
  }

  isOpen(): boolean {
    return this._status === "CONNECTED"
  }

  send(data: string): void {
    if (this._status === "CONNECTED") {
      this._websocket?.send(data)
    }
  }
}
