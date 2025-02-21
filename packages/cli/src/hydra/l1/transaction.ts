import config from "@hydra-manager/cli/cli/config"
import { getBlockfrostAPI, getCardanoProvider } from "@hydra-manager/cli/utils"
import type { Assets, OutputDatum as LucidOutputDatum, Script, UTxO } from "@lucid-evolution/lucid"
import { CML, Constr, Data, Lucid } from "@lucid-evolution/lucid"
import { createHash } from "crypto"
import { getCardanoNodeWalletPrivateKeyByPubkeyHash, getCardanoNodeWalletsPubkeyHashes } from "../utils.js"
import { getHydraContracts } from "./index.js"
import type { Address, CloseDatum, OpenDatum, OutputDatum, ReferenceScript, Value } from "./plutus.js"
import { CollectCommitDatum, getHeadStateDatum, HeadStateDatum, InputRedeemer, TxOut } from "./plutus.js"

export async function createCloseOpenHeadTransaction(headUtxo: UTxO) {
  if (!headUtxo.datum) {
    throw new Error("Datum not found, invalid UTxO")
  }

  const openDatum = getHeadStateDatum(headUtxo.datum) as OpenDatum
  if (openDatum === undefined || !openDatum.Open) {
    throw new Error("Invalid datum format. Expected Open datum.")
  }

  const headCardanoPubkeyHashes = Object.keys(headUtxo.assets).map((asset) => asset.slice(56))
  const pubkeyHashes = headCardanoPubkeyHashes.filter((hash) => getCardanoNodeWalletsPubkeyHashes(true).includes(hash))

  if (pubkeyHashes.length === 0) {
    throw new Error("You are not a party of this head")
  }

  const privateKey = getCardanoNodeWalletPrivateKeyByPubkeyHash(pubkeyHashes[0])

  if (privateKey === undefined) {
    throw new Error("Private key not found")
  }

  const hydraContracts = await getHydraContracts()

  const lucid = await Lucid(getCardanoProvider(), config.network)

  lucid.selectWallet.fromPrivateKey(privateKey)

  const emptyHash = createHash("sha256").digest("hex")
  const now = BigInt(new Date().getTime() - 20000) / 1000n * 1000n
  const closeDatum: HeadStateDatum = {
    Closed: {
      closeDatum: {
        headId: openDatum.Open.openDatum.headId,
        parties: openDatum.Open.openDatum.parties,
        contestationPeriod: openDatum.Open.openDatum.contestationPeriod,
        version: openDatum.Open.openDatum.version,
        snapshotNumber: 0n,
        utxoHash: openDatum.Open.openDatum.hash,
        alphaUTxOHash: emptyHash,
        omegaUTxOHash: emptyHash,
        contesters: [],
        contestationDeadline: now + 2n * openDatum.Open.openDatum.contestationPeriod.milliseconds
      }
    }
  }
  const closeDatumCbor = Data.to(closeDatum, HeadStateDatum)
  if (closeDatumCbor === undefined) {
    throw new Error("Failed to encode close datum")
  }

  const txBuilder = await lucid.newTx()

  const redeemer: InputRedeemer = { Close: { closeSchema: "CloseInitial" } }
  const redeemerCbor = Data.to(redeemer, InputRedeemer)
  txBuilder.collectFrom([headUtxo], redeemerCbor)
  txBuilder.readFrom([hydraContracts.headUtxo])

  txBuilder.pay.ToContract(
    hydraContracts.headScriptAddress,
    { kind: "inline", value: closeDatumCbor },
    headUtxo.assets
  )

  txBuilder.validFrom(Number(now))
  txBuilder.validTo(Number(now + openDatum.Open.openDatum.contestationPeriod.milliseconds))

  txBuilder.addSigner(await lucid.wallet().address())

  const txUnsigned = await txBuilder.complete()

  const txSigned = await (await txUnsigned.sign.withWallet()).complete()

  return txSigned.toCBOR()
}

export async function createFanOutTransaction(headUtxo: UTxO) {
  if (!headUtxo.datum) {
    throw new Error("Datum not found, invalid UTxO")
  }

  const closeDatum = getHeadStateDatum(headUtxo.datum) as CloseDatum
  if (closeDatum === undefined || !closeDatum.Closed) {
    throw new Error("Invalid datum format. Expected Open datum.")
  }

  const headCardanoPubkeyHashes = Object.keys(headUtxo.assets).map((asset) => asset.slice(56))
  const pubkeyHashes = headCardanoPubkeyHashes.filter((hash) => getCardanoNodeWalletsPubkeyHashes(true).includes(hash))

  if (pubkeyHashes.length === 0) {
    throw new Error("You are not a party of this head")
  }

  const privateKey = getCardanoNodeWalletPrivateKeyByPubkeyHash(pubkeyHashes[0])

  if (privateKey === undefined) {
    throw new Error("Private key not found")
  }

  const hydraContracts = await getHydraContracts()

  const lucid = await Lucid(getCardanoProvider(), config.network)

  lucid.selectWallet.fromPrivateKey(privateKey)

  const { alphaUTxOHash, omegaUTxOHash, snapshotNumber } = closeDatum.Closed.closeDatum

  if (snapshotNumber !== 0n) {
    throw new Error("Invalid snapshot number. Only snapshot number 0 is allowed.")
  }

  const emptyHash = createHash("sha256").digest("hex")
  if (alphaUTxOHash !== emptyHash || omegaUTxOHash !== emptyHash) {
    throw new Error("Invalid alpha or omega UTxO hash")
  }

  const blockfrostApi = getBlockfrostAPI()

  const findCollectCommitmentDatums = async (txHash: string) => {
    const tx = await blockfrostApi.txsUtxos(txHash)

    for (const input of tx.inputs) {
      const datum: string | null = input.inline_datum
      if (datum !== null) {
        const decoded = getHeadStateDatum(datum) as any
        if (
          input.address === hydraContracts.headScriptAddress && decoded !== undefined &&
          (decoded.Closed !== undefined || decoded.Open !== undefined)
        ) {
          return findCollectCommitmentDatums(input.tx_hash)
        } else if (input.address === hydraContracts.commitScriptAddress) {
          return tx.inputs.filter((input) => input.address === hydraContracts.commitScriptAddress).map((input) =>
            Data.from(input.inline_datum!, CollectCommitDatum)
          )
        }
      }
    }

    return undefined
  }

  const collectCommitmentInput = await findCollectCommitmentDatums(headUtxo.txHash)

  if (collectCommitmentInput === undefined) {
    throw new Error("Collect commitment inputs not found")
  }

  const orderedTxOuts = collectCommitmentInput
    .flatMap((input) => input.commit)
    .sort((a, b) =>
      a.input.txOutRefId.localeCompare(b.input.txOutRefId) == 0 ?
        Number(a.input.txOutRefIdx - b.input.txOutRefIdx) :
        a.input.txOutRefId.localeCompare(b.input.txOutRefId)
    ).map((commit) => {
      return Data.from(commit.preSerializedOutput, TxOut)
    })

  const txBuilder = await lucid.newTx()

  orderedTxOuts.forEach((txOut) => {
    txBuilder.pay.ToAddressWithData(
      convertToAddress(txOut.address),
      convertToDatum(txOut.datum),
      convertToAssets(txOut.value),
      convertToReferenceScript(txOut.referenceScript)
    )
  })

  const tokenToBurn: Assets = {}
  Object.keys(headUtxo.assets).filter((asset) => asset !== "lovelace").forEach((asset) => {
    tokenToBurn[asset] = headUtxo.assets[asset] * -1n
  })
  txBuilder.mintAssets(tokenToBurn, Data.to(new Constr(1, [])))

  const findMintingPolicy = async (txHash: string) => {
    const tx = await blockfrostApi.txsUtxos(txHash)

    for (const input of tx.inputs) {
      const datum: string | null = input.inline_datum
      if (datum !== null) {
        const decoded = getHeadStateDatum(datum) as any
        if (
          input.address === hydraContracts.headScriptAddress && decoded !== undefined &&
          (decoded.Initial === undefined)
        ) {
          return findMintingPolicy(input.tx_hash)
        } else if (
          input.address === hydraContracts.headScriptAddress && decoded !== undefined && decoded.Initial !== undefined
        ) {
          const tx = await blockfrostApi.txsCbor(input.tx_hash)

          const coreTransaction = CML.Transaction.from_cbor_hex(tx.cbor)

          const mintingScript: Script = {
            type: "PlutusV3",
            script: coreTransaction.witness_set().plutus_v3_scripts()?.get(0).to_canonical_cbor_hex() ?? ""
          }

          if (mintingScript.script === "") {
            throw new Error("Minting policy not found")
          }

          return mintingScript
        }
      }
    }

    throw new Error("Minting policy not found")
  }

  const mintingPolicy = await findMintingPolicy(headUtxo.txHash)
  txBuilder.attach.MintingPolicy(mintingPolicy)

  txBuilder.readFrom([hydraContracts.headUtxo])
  const redeemer: InputRedeemer = {
    Fanout: {
      numberOfFanoutOutputs: BigInt(orderedTxOuts.length),
      numberOfCommitOutputs: 0n,
      numberOfDecommitOutputs: 0n
    }
  }

  txBuilder.collectFrom([headUtxo], Data.to(redeemer, InputRedeemer))

  const now = BigInt(new Date().getTime() - 20000) / 1000n * 1000n

  txBuilder.validFrom(Number(now))

  txBuilder.addSigner(await lucid.wallet().address())

  const txUnsigned = await txBuilder.complete()

  const txSigned = await (await txUnsigned.sign.withWallet()).complete()

  return txSigned.toCBOR()
}

function convertToAddress(address: Address) {
  const paymentCredential = "PubKeyCredential" in address.addressCredential ?
    CML.Credential.new_pub_key(CML.Ed25519KeyHash.from_hex(address.addressCredential.PubKeyCredential[0]))
    : CML.Credential.new_script(CML.ScriptHash.from_hex(address.addressCredential.ScriptCredential[0]))

  if (address.addressStakingCredential === "Nothing") {
    return CML.EnterpriseAddress.new(
      config.network === "Mainnet" ? 1 : 0,
      paymentCredential
    ).to_address().to_bech32()
  } else {
    const StakingCredential = address.addressStakingCredential.Just

    if ("StakingPtr" in StakingCredential) {
      throw new Error("Staking pointer not allowed. TODO")
    } else {
      return CML.BaseAddress.new(
        config.network === "Mainnet" ? 1 : 0,
        paymentCredential,
        "PubKeyCredential" in StakingCredential.StakingCredenetial ?
          CML.Credential.new_pub_key(
            CML.Ed25519KeyHash.from_hex(StakingCredential.StakingCredential.PubKeyCredential[0])
          )
          : CML.Credential.new_script(CML.ScriptHash.from_hex(StakingCredential.StakingCredential.ScriptCredential[0]))
      ).to_address().to_bech32()
    }
  }
}

function convertToAssets(value: Value) {
  const assets: Assets = {}

  value.forEach((asset, currencySymbol) => {
    asset.forEach((amount, tokenName) => {
      if (assets[currencySymbol] === undefined) {
        assets[currencySymbol === "" ? "lovelace" : currencySymbol + tokenName] = amount
      } else {
        throw new Error("Multiple tokens with the same currency symbol not allowed")
      }
    })
  })

  return assets
}

function convertToDatum(datum: OutputDatum): LucidOutputDatum | undefined {
  if ("NoOutputDatum" === datum) {
    return undefined
  } else if ("OutputDatumHash" in datum) {
    return { kind: "hash", value: datum.OutputDatumHash[0] }
  } else {
    return { kind: "inline", value: datum.OutputDatum[0] }
  }
}

function convertToReferenceScript(referenceScript: ReferenceScript) {
  if (referenceScript === "Nothing") {
    return undefined
  } else {
    throw new Error("Reference script not allowed. TODO")
  }
}
