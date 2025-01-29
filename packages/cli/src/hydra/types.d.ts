export const HYDRA_STATUS = {
  IDLE: "IDLE",
  DISCONNECTED: "DISCONNECTED",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  INITIALIZING: "INITIALIZING",
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  FANOUT_POSSIBLE: "FANOUT_POSSIBLE",
  FINAL: "FINAL"
} as const

export type HydraStatus = (typeof HYDRA_STATUS)[keyof typeof HYDRA_STATUS]

export type CardanoTransactionRequest = {
  type: string
  description: string
  cborHex: string
  txId?: string
}

export type HydraUTxOs = {
  [key: string]: {
    address: string
    value: { [key: string | "lovelace"]: bigint }
    referenceScript: HydraScriptRef
    datumHash: null | string
    inlineDatum: null | any
    inlineDatumHash: null | string
    datum: null | string
  }
}

export type HydraScriptRef = null | {
  scriptLanguage: HydraScriptLanguage
  script: {
    cborHex: string
    description: string
    type: HydraScriptLanguage
  }
}

export type HydraScriptLanguage = "SimpleScript" | "PlutusScriptV1" | "PlutusScriptV2" | "PlutusScriptV3"
