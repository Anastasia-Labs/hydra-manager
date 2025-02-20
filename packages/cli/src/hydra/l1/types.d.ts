import type { Address } from "@lucid-evolution/lucid"

export type HydraContracts = {
  initialScriptAddress: Address
  initialScript: Script
  initialUtxo: UTxO
  commitScriptAddress: Address
  commitScript: Script
  commitUtxo: UTxO
  headScriptAddress: Address
  headScript: Script
  headUtxo: UTxO
}
