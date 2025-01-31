import { CML, type ProtocolParameters, type UTxO } from "@lucid-evolution/lucid"
import { EventEmitter } from "node:events"
import { Connection } from "./connection.js"
import type { CardanoTransactionRequest, HydraStatus } from "./types.js"

export class HydraNode extends EventEmitter {
  private readonly _url: string
  private _status: HydraStatus
  private readonly _connection: Connection
  private readonly _txCircularBuffer: CircularBuffer<string>

  constructor(url: string) {
    super()
    this._url = url
    this._status = "DISCONNECTED"
    this._connection = new Connection(url + "?history=no")
    this._connection.on("message", (data) => this.processStatus(data))
    this._connection.on("message", (data) => this.processConfirmedTx(data))
    this._connection.connect()

    this._txCircularBuffer = new CircularBuffer(1000)
  }

  private async processStatus(data: string) {
    const message = JSON.parse(data)
    function getStatus(data: any): HydraStatus | null {
      switch (data.tag) {
        case "Greetings":
          return (data.headStatus as string).toUpperCase() as HydraStatus
        case "HeadIsInitializing":
          return "INITIALIZING"
        case "HeadIsOpen":
          return "OPEN"
        case "HeadIsClosed":
          return "CLOSED"
        case "ReadyToFanout":
          return "FANOUT_POSSIBLE"
        case "HeadIsFinalized":
          return "FINAL"
        default:
          return null
      }
    }

    let status: HydraStatus | null = null
    if ((status = getStatus(message)) && status !== null && status !== this._status) {
      this._status = status
      this.emit("status", status)
    }
  }

  private async processConfirmedTx(data: string) {
    const message = JSON.parse(data)

    if (message.tag === "SnapshotConfirmed") {
      message.snapshot.confirmedTransactions.forEach((tx: string) => {
        this._txCircularBuffer.add(tx)
      })
    }
  }

  async init() {
    this._connection.send(JSON.stringify({ tag: "Init" }))

    return new Promise<void>((resolve, reject) => {
      const resolveCallback = (data: string) => {
        const rejectCb = (reason?: any) => {
          this._connection.removeListener("message", resolveCallback)
          reject(reason)
        }

        const message = handleWsResponse(data, "Init", rejectCb)
        if (message.tag === "HeadIsInitializing") {
          this._connection.removeListener("message", resolveCallback)
          resolve()
        }
      }

      this._connection.on("message", resolveCallback)
    })
  }

  async commit(utxos: Array<UTxO> = [], blueprintTx?: string) {
    let bodyRequest: string

    if (blueprintTx !== undefined) {
      bodyRequest = JSON.stringify({
        blueprintTx: {
          cborHex: blueprintTx,
          description: "",
          type: "Tx ConwayEra"
        },
        utxo: utxos.reduce((acc, u) => {
          acc[u.txHash + "#" + u.outputIndex] = {
            address: u.address,
            datum: u.datum ?? null,
            datumhash: u.datumHash ?? null,
            inlineDatum: null,
            inlineDatumRaw: null,
            referenceScript: null,
            value: Object.keys(u.assets).reduce((acc, key) => {
              acc[key] = Number(u.assets[key].valueOf())
              return acc
            }, {} as Record<string, number>)
          }
          return acc
        }, {} as Record<string, any>)
      })
    } else {
      bodyRequest = JSON.stringify(utxos.reduce((acc, u) => {
        acc[u.txHash + "#" + u.outputIndex] = {
          address: u.address,
          datum: u.datum,
          datumHash: u.datumHash,
          inlineDatum: u.datum,
          value: Object.keys(u.assets).reduce((acc, key) => {
            acc[key] = Number(u.assets[key].valueOf())
            return acc
          }, {} as Record<string, number>)
        }
        return acc
      }, {} as Record<string, any>))
    }

    const body = await fetch(this._url.replace("ws", "http") + "/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyRequest
    })

    return (await handleHttpResponse(body)) as CardanoTransactionRequest
  }

  async cardanoTransaction(transaction: CardanoTransactionRequest) {
    const body = await fetch(this._url.replace("ws", "http") + "/cardano-transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transaction)
    })

    return await handleHttpResponse(body)
  }

  async snapshotUTxO() {
    const body = await fetch(this._url.replace("ws", "http") + "/snapshot/utxo", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    })

    const response = await handleHttpResponse(body)

    return Object.keys(response).map((key) => {
      const utxo: UTxO = {
        txHash: key.split("#")[0],
        outputIndex: Number(key.split("#")[1]),
        address: response[key].address,
        datum: response[key].datum,
        datumHash: response[key].datumHash,
        assets: Object.keys(response[key].value).reduce((acc, assetKey) => {
          acc[assetKey] = BigInt(response[key].value[assetKey])
          return acc
        }, {} as Record<string, bigint>)
      }
      return utxo
    })
  }

  async protocolParameters() {
    const body = await fetch(this._url.replace("ws", "http") + "/protocol-parameters", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    })

    const response = await handleHttpResponse(body)

    const parameters: ProtocolParameters = {
      minFeeA: response.txFeePerByte,
      minFeeB: response.txFeeFixed,
      maxTxSize: response.maxTxSize,
      maxValSize: response.maxValueSize,
      keyDeposit: BigInt(response.stakeAddressDeposit),
      poolDeposit: BigInt(response.stakePoolDeposit),
      drepDeposit: BigInt(response.dRepDeposit),
      govActionDeposit: BigInt(response.govActionDeposit),
      priceMem: response.executionUnitPrices.priceMemory,
      priceStep: response.executionUnitPrices.priceSteps,
      maxTxExMem: BigInt(response.maxTxExecutionUnits.memory),
      maxTxExSteps: BigInt(response.maxTxExecutionUnits.steps),
      coinsPerUtxoByte: BigInt(response.utxoCostPerByte),
      collateralPercentage: response.collateralPercentage,
      maxCollateralInputs: response.maxCollateralInputs,
      minFeeRefScriptCostPerByte: response.minFeeRefScriptCostPerByte,
      costModels: {
        PlutusV1: Object.fromEntries(
          response.costModels.PlutusV1.map((v: number, i: number) => [i.toString(), v])
        ),
        PlutusV2: Object.fromEntries(
          response.costModels.PlutusV2.map((v: number, i: number) => [i.toString(), v])
        ),
        PlutusV3: Object.fromEntries(
          response.costModels.PlutusV3.map((v: number, i: number) => [i.toString(), v])
        )
      }
    }

    return parameters
  }

  async newTx(transaction: CardanoTransactionRequest) {
    this._connection.send(JSON.stringify({ tag: "NewTx", transaction }))

    const transactionHash = CML.hash_transaction(CML.Transaction.from_cbor_hex(transaction.cborHex).body()).to_hex()

    return new Promise<string>((resolve, reject) => {
      const resolveCallback = (data: string) => {
        const rejectCb = (reason?: any) => {
          this._connection.removeListener("message", resolveCallback)
          reject(reason)
        }

        const message = handleWsResponse(data, "NewTx", rejectCb, transactionHash)
        if (message.tag === "TxValid" && message.transaction.txId === transactionHash) {
          this._connection.removeListener("message", resolveCallback)
          resolve(transactionHash)
        } else if (message.tag === "TxInvalid" && message.transaction.txId === transactionHash) {
          this._connection.removeListener("message", resolveCallback)
          reject(new Error("Transaction is invalid"))
        }
      }

      this._connection.on("message", resolveCallback)
    })
  }

  async awaitTx(txHash: string, checkInterval: number = 1000) {
    return new Promise<boolean>((resolve) => {
      const interval = setInterval(async () => {
        if (this._txCircularBuffer.getBuffer().includes(txHash)) {
          resolve(true)
          clearInterval(interval)
        }
      }, checkInterval)
    })
  }

  async close() {
    this._connection.send(JSON.stringify({ tag: "Close" }))

    return new Promise<void>((resolve, reject) => {
      const interval = setInterval(() => this._connection.send(JSON.stringify({ tag: "Close" })), 10000)
      const resolveCallback = (data: string) => {
        const rejectCb = (reason?: any) => {
          this._connection.removeListener("message", resolveCallback)
          clearInterval(interval)
          reject(reason)
        }

        const message = handleWsResponse(data, "Close", rejectCb)
        if (message.tag === "HeadIsClosed") {
          this._connection.removeListener("message", resolveCallback)
          clearInterval(interval)
          resolve()
        }
      }

      this._connection.on("message", resolveCallback)
    })
  }

  async fanout() {
    this._connection.send(JSON.stringify({ tag: "Fanout" }))

    return new Promise<void>((resolve, reject) => {
      const resolveCallback = (data: string) => {
        const rejectCb = (reason?: any) => {
          this._connection.removeListener("message", resolveCallback)
          reject(reason)
        }

        const message = handleWsResponse(data, "Fanout", rejectCb, "Fanout")
        if (message.tag === "HeadIsFinalized") {
          this._connection.removeListener("message", resolveCallback)
          resolve()
        }
      }

      this._connection.on("message", resolveCallback)
    })
  }

  get status() {
    return this._status
  }

  get url() {
    return this._url
  }
}

class CircularBuffer<T> {
  private buffer: Array<T>
  private length: number
  private pointer: number

  constructor(length: number) {
    this.buffer = Array(length)
    this.length = length
    this.pointer = 0
  }

  add(element: T) {
    this.buffer[this.pointer = (this.pointer + 1) % this.length] = element
  }
  getBuffer() {
    return this.buffer
  }
}

async function handleHttpResponse(response: Response) {
  try {
    return await response.json()
  } catch (e) {
    if (e instanceof Error && e.name === "SyntaxError") {
      throw new Error(await response.text())
    } else {
      throw e
    }
  }
}

function handleWsResponse(message: any, command: string, reject: (reason?: any) => void, ...args: Array<string>) {
  try {
    message = JSON.parse(message)

    if (message.tag === "CommandFailed" && message.clientInput) {
      if (
        command === "NewTx" && message.clientInput.tag === "NewTx" && message.clientInput.transaction.txId === args[0]
      ) {
        reject(new Error("Error posting transaction with hash " + args[0]))
      } else if (message.clientInput.tag === command) {
        reject(new Error("Command " + command + " failed"))
      }
    } else if (message.tag === "PostTxOnChainFailed" && message.postChainTx.tag === command + "Tx") {
      reject(
        new Error(
          `Error posting transaction for command ${command}./n Error:/n ${JSON.stringify(message.postTxError, null, 2)}`
        )
      )
    }

    return message
  } catch (e) {
    if (e instanceof Error && e.name === "SyntaxError") {
      reject(new Error(message))
    } else {
      reject(e)
    }
  }
}
