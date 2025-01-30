import type { LucidEvolution, Script, ScriptType, UTxO } from "@lucid-evolution/lucid"
import { CML, utxoToCore } from "@lucid-evolution/lucid"
import { readFileSync } from "node:fs"
import type { CardanoTransactionRequest, HydraScriptLanguage, HydraUTxOs } from "./types"

export async function displayBalances(participants: Array<string>, lucid: LucidEvolution) {
  for (const participant of participants) {
    const balance = await getBalance(participant, lucid)
    console.log(`${participant} node wallet balance: ${balance} ADA`)
    const fundBalance = await getBalance(participant + "-funds", lucid)
    console.log(`${participant} funds wallet balance: ${fundBalance} ADA`)
  }
}
export async function displayUTxOs(participants: Array<string>, lucid: LucidEvolution) {
  for (const participant of participants) {
    await showUTxOs(getParticipantAddress(participant), participant)
    await showUTxOs(getParticipantAddress(participant + "-funds"), participant + "-funds")
  }

  async function showUTxOs(address: string, participant: string) {
    const utxos = await lucid.utxosAt(address)
    console.log(`${participant} node wallet utxos length: ${utxos.length}`)
    for (const utxo of utxos) {
      console.log(utxo)
    }
  }
}

export async function printHydraUTxOs(lucid: LucidEvolution) {
  const utxos = await lucid.wallet().getUtxos()

  console.log("Hydra utxos:")
  console.log(JSON.stringify(utxoToHydraUTxO(utxos), null, 2))
}

async function getBalance(participant: string, lucid: LucidEvolution) {
  const address = getParticipantAddress(participant)
  const utxos = await lucid.utxosAt(address)
  const balance = utxos.reduce((acc, utxo) => acc + utxo.assets["lovelace"].valueOf(), 0n) / 1000000n
  return balance
}

function getParticipantAddress(participant: string) {
  return readFileSync(`./credentials/${participant.toLocaleLowerCase()}.addr`, { encoding: "utf-8" })
}

export async function singleOutputBlueprintTx(lucid: LucidEvolution, lovelace: number) {
  const walletUtxos = [(await lucid.wallet().getUtxos())[0]]

  const inputs = CML.TransactionInputList.new()

  for (const utxo of walletUtxos) {
    const coreUTxO = utxoToCore(utxo)
    inputs.add(coreUTxO.input())
  }

  const outputs = CML.TransactionOutputList.new()

  const participantCoreAddress = CML.Address.from_bech32(await lucid.wallet().address())

  outputs.add(
    CML.TransactionOutputBuilder.new().with_address(participantCoreAddress)
      .next().with_value(CML.Value.new(BigInt(lovelace), CML.MultiAsset.new())).build().output()
  )

  const txBody = CML.TransactionBody.new(inputs, outputs, 0n)

  const bluePrintTx = CML.Transaction.new(txBody, CML.TransactionWitnessSet.new(), true).to_cbor_hex()
  return { bluePrintTx, walletUtxos }
}

export async function selectWallet(participant: string, lucid: LucidEvolution) {
  const privateKeyBech32 = getParticipantPrivateKey(participant)
  await lucid.selectWallet.fromPrivateKey(privateKeyBech32)
}

export function getParticipantPrivateKey(participant: string) {
  const privateKey = JSON.parse(
    readFileSync(`./credentials/${participant.toLocaleLowerCase()}.sk`, { encoding: "utf-8" })
  )

  return CML.PrivateKey.from_normal_bytes(
    Buffer.from((privateKey.cborHex as string).substring(4), "hex")
  ).to_bech32()
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function utxoToHydraUTxO(utxos: Array<UTxO>) {
  return utxos.reduce((acc, utxo) => {
    acc[utxo.txHash + "#" + utxo.outputIndex] = {
      address: utxo.address,
      value: utxo.assets,
      referenceScript: utxo.scriptRef
        ? scriptToHydraScript(utxo.scriptRef)
        : null,
      datumHash: utxo.datumHash ?? null,
      inlineDatum: null,
      inlineDatumHash: null,
      datum: utxo.datum ?? null
    }
    return acc
  }, {} as HydraUTxOs)
}

function scriptToHydraScript(script: Script) {
  const scriptLanguageMap = new Map<ScriptType, HydraScriptLanguage>([
    ["Native", "SimpleScript"],
    ["PlutusV1", "PlutusScriptV1"],
    ["PlutusV2", "PlutusScriptV2"],
    ["PlutusV3", "PlutusScriptV3"]
  ])

  return {
    scriptLanguage: decode(script.type, scriptLanguageMap, "SimpleScript"),
    script: {
      cborHex: script.script,
      description: "",
      type: decode(script.type, scriptLanguageMap, "SimpleScript")
    }
  }
}

function decode<T, R>(value: T, map: Map<T, R>, defaultValue: R) {
  return map.has(value) ? map.get(value)! : defaultValue
}

export async function signCommitTransaction(unwitnessedTransaction: CardanoTransactionRequest, lucid: LucidEvolution) {
  const unsignedTx = CML.Transaction.from_cbor_hex(unwitnessedTransaction.cborHex)

  const witnessSet = unsignedTx.witness_set()

  witnessSet.add_all_witnesses(await lucid.wallet().signTx(unsignedTx))

  const signedTx = CML.Transaction.new(
    unsignedTx.body(),
    witnessSet,
    true,
    unsignedTx.auxiliary_data()
  )

  return {
    ...unwitnessedTransaction,
    cborHex: signedTx.to_cbor_hex()
  }
}
