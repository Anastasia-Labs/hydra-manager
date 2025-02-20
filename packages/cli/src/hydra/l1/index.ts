import config from "@hydra-manager/cli/cli/config"
import { Blockfrost, validatorToAddress } from "@lucid-evolution/lucid"
import type { HydraContracts } from "./types.js"

let contracts: HydraContracts | undefined

export async function getHydraContracts() {
  if (contracts === undefined) {
    if (config.contractsReferenceTxIds === undefined || config.blockfrostProjectId === undefined) {
      throw new Error("Contracts reference tx ids or blockfrost project id not found in config file")
    }

    const provider = new Blockfrost(
      `https://cardano-${config.network.toLocaleLowerCase()}.blockfrost.io/api/v0`,
      config.blockfrostProjectId
    )

    const refTxs = config.contractsReferenceTxIds.split(",")

    const scriptRefUTxOs = await provider.getUtxosByOutRef(refTxs.map((tx) => {
      return { txHash: tx, outputIndex: 0 }
    }))

    if (scriptRefUTxOs.length !== 3 || scriptRefUTxOs.some((utxo) => utxo.scriptRef === undefined)) {
      throw new Error("Invalid script reference utxos some of them are missing or invalid")
    }

    contracts = {
      initialScriptAddress: validatorToAddress(config.network, scriptRefUTxOs[0].scriptRef!),
      initialScript: scriptRefUTxOs[0].scriptRef,
      initialUtxo: scriptRefUTxOs[0],
      commitScriptAddress: validatorToAddress(config.network, scriptRefUTxOs[1].scriptRef!),
      commitScript: scriptRefUTxOs[1].scriptRef,
      commitUtxo: scriptRefUTxOs[1],
      headScriptAddress: validatorToAddress(config.network, scriptRefUTxOs[2].scriptRef!),
      headScript: scriptRefUTxOs[2].scriptRef,
      headUtxo: scriptRefUTxOs[2]
    } as HydraContracts
  }
  return contracts
}
