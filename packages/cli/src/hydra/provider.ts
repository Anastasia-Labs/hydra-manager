import type {
  Address,
  Credential,
  Datum,
  DatumHash,
  Delegation,
  EvalRedeemer,
  Network,
  OutRef,
  ProtocolParameters,
  Provider,
  RewardAddress,
  Transaction,
  TxHash,
  Unit,
  UTxO
} from "@lucid-evolution/lucid"
import { credentialToAddress } from "@lucid-evolution/lucid"
import { HydraNode } from "./node.js"

export class Hydra implements Provider {
  private readonly _node: HydraNode
  private readonly _network: Network

  constructor(url: string, network?: Network) {
    this._node = new HydraNode(url)
    this._node.connect()
    this._network = network ?? "Preprod"
  }

  getProtocolParameters(): Promise<ProtocolParameters> {
    return this._node.protocolParameters()
  }

  async getUtxos(addressOrCredential: Address | Credential): Promise<Array<UTxO>> {
    let address: Address

    if (typeof addressOrCredential === "string") {
      address = addressOrCredential
    } else {
      address = credentialToAddress(this._network, addressOrCredential)
    }

    return (await this._node.snapshotUTxO()).filter((utxo) => utxo.address === address)
  }

  async getUtxosWithUnit(_addressOrCredential: Address | Credential, _unit: Unit): Promise<Array<UTxO>> {
    let address: Address

    if (typeof _addressOrCredential === "string") {
      address = _addressOrCredential
    } else {
      address = credentialToAddress(this._network, _addressOrCredential)
    }

    return (await this._node.snapshotUTxO()).filter((utxo) =>
      utxo.address === address && Object.keys(utxo.assets).includes(_unit)
    )
  }

  async getUtxoByUnit(_unit: Unit): Promise<UTxO> {
    const utxo = (await this._node.snapshotUTxO()).filter((utxo) => Object.keys(utxo.assets).includes(_unit))

    if (utxo === undefined) {
      throw new Error("UTxO with unit not found")
    } else if (utxo.length > 1) {
      throw new Error("Unit need to be a NFT")
    }

    return utxo[0]
  }

  async getUtxosByOutRef(_outRefs: Array<OutRef>): Promise<Array<UTxO>> {
    return (await this._node.snapshotUTxO()).filter((utxo) =>
      _outRefs.some((outRef) => utxo.txHash === outRef.txHash && utxo.outputIndex === outRef.outputIndex)
    )
  }

  getDelegation(_rewardAddress: RewardAddress): Promise<Delegation> {
    throw new Error("Method not implemented.")
  }

  getDatum(_datumHash: DatumHash): Promise<Datum> {
    throw new Error("Method not implemented.")
  }

  awaitTx(_txHash: TxHash, _checkInterval?: number): Promise<boolean> {
    return this._node.awaitTx(_txHash, _checkInterval)
  }

  submitTx(tx: Transaction): Promise<TxHash> {
    return this._node.newTx({
      cborHex: tx,
      description: "",
      type: "Tx ConwayEra"
    })
  }

  evaluateTx(_tx: Transaction, _additionalUTxOs?: Array<UTxO>): Promise<Array<EvalRedeemer>> {
    throw new Error("Method not implemented.")
  }
}
