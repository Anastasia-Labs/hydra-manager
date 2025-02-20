import { Data } from "@lucid-evolution/lucid"

const partySchema = Data.Bytes()

const currencySymbolSchema = Data.Bytes()

const tokenNameSchema = Data.Bytes()

const contestationPeriodSchema = Data.Object({
  milliseconds: Data.Integer()
})

const txOutRefSchema = Data.Object({
  txOutRefId: Data.Bytes(),
  txOutRefIdx: Data.Integer()
})

const initialStateSchema = Data.Object({
  Initial: Data.Object({
    contestationPeriod: contestationPeriodSchema,
    parties: Data.Array(partySchema),
    headId: currencySymbolSchema,
    seed: txOutRefSchema
  })
})

const openStateSchema = Data.Object({
  Open: Data.Object(
    {
      openDatum: Data.Object({
        headId: currencySymbolSchema,
        parties: Data.Array(partySchema),
        contestationPeriod: contestationPeriodSchema,
        version: Data.Integer(),
        hash: Data.Bytes()
      })
    }
  )
})

const closeStateSchema = Data.Object({
  Closed: Data.Object({
    closeDatum: Data.Object({
      headId: currencySymbolSchema,
      parties: Data.Array(partySchema),
      contestationPeriod: contestationPeriodSchema,
      version: Data.Integer(),
      snapshotNumber: Data.Integer(),
      utxoHash: Data.Bytes(),
      alphaUTxOHash: Data.Bytes(),
      omegaUTxOHash: Data.Bytes(),
      contesters: Data.Array(Data.Bytes()),
      contestationDeadline: Data.Integer()
    })
  })
})

const finalStateSchema = Data.Literal("Final")

export const stateSchema = Data.Enum([initialStateSchema, openStateSchema, closeStateSchema, finalStateSchema])

export type InitialDatum = Data.Static<typeof initialStateSchema>
export const InitialDatum = initialStateSchema as unknown as InitialDatum

export type OpenDatum = Data.Static<typeof openStateSchema>
export const OpenDatum = openStateSchema as unknown as OpenDatum

export type CloseDatum = Data.Static<typeof closeStateSchema>
export const CloseDatum = closeStateSchema as unknown as CloseDatum

export type FinalDatum = Data.Static<typeof finalStateSchema>
export const FinalDatum = finalStateSchema as unknown as FinalDatum

export type HeadStateDatum = Data.Static<typeof stateSchema>
export const HeadStateDatum = stateSchema as unknown as HeadStateDatum

export function getHeadStateDatum(datum: string) {
  try {
    return Data.from(datum, HeadStateDatum) as HeadStateDatum
  } catch {
    return undefined
  }
}

const closeInitialSchema = Data.Literal("CloseInitial")
const closeAnySchema = Data.Object({
  CloseAny: Data.Object({ signature: Data.Array(Data.Bytes()) })
})

const closeSchema = Data.Enum([closeInitialSchema, closeAnySchema])

export type CloseRedeemer = Data.Static<typeof closeSchema>
export const CloseRedeemer = closeSchema as unknown as CloseRedeemer

const collectComInputSchema = Data.Literal("CollectCom")
const incrementInputSchema = Data.Literal("Increment_NOT_USE")
const decrementInputSchema = Data.Literal("Decrement_NOT_USE")
const closeInputSchema = Data.Object({
  Close: Data.Object({ closeSchema })
})
const inputRedeemerSchema = Data.Enum([
  collectComInputSchema,
  incrementInputSchema,
  decrementInputSchema,
  closeInputSchema
])
export type InputRedeemer = Data.Static<typeof inputRedeemerSchema>
export const InputRedeemer = inputRedeemerSchema as unknown as InputRedeemer

const commitSchema = Data.Object({
  input: txOutRefSchema,
  preSerializedOutput: Data.Bytes()
})

const collectCommitSchema = Data.Object({
  party: Data.Bytes(),
  commit: Data.Array(commitSchema),
  headId: Data.Bytes()
})

export type CollectCommitDatum = Data.Static<typeof collectCommitSchema>
export const CollectCommitDatum = collectCommitSchema as unknown as CollectCommitDatum

// const credentialSchema = Data.Enum([
//   Data.Object({ PubKeyCredential: Data.Bytes() }),
//   Data.Object({ ScriptCredential: Data.Bytes() })
// ])

const credentialSchema = Data.Enum([
  Data.Object({ PubKeyCredential: Data.Tuple([Data.Bytes()]) }),
  Data.Object({ ScriptCredential: Data.Tuple([Data.Bytes()]) })
])

const maybeSchema = (schema: any) => Data.Enum([Data.Object({ Just: schema }), Data.Literal("Nothing")])

const stakingCredentialSchema = Data.Enum([
  Data.Object({ StakingCredential: credentialSchema }),
  Data.Object({ StakingPtr: Data.Tuple([Data.Integer(), Data.Integer(), Data.Integer()]) })
])

const addressSchema = Data.Object({
  addressCredential: credentialSchema,
  addressStakingCredential: maybeSchema(stakingCredentialSchema)
})

const valueSchema = Data.Map(currencySymbolSchema, Data.Map(tokenNameSchema, Data.Integer()))

const outputDatumSchema = Data.Enum([
  Data.Literal("NoOutputDatum"),
  Data.Object({ OutputDatumHash: Data.Tuple([Data.Bytes()]) }),
  Data.Object({ OutputDatum: Data.Tuple([Data.Bytes()]) })
])

const txOutSchema = Data.Object({
  address: addressSchema,
  value: valueSchema,
  datum: outputDatumSchema,
  referenceScript: maybeSchema(Data.Tuple([Data.Bytes()]))
})

export type TxOut = Data.Static<typeof txOutSchema>
export const TxOut = txOutSchema as unknown as TxOut

export type Address = Data.Static<typeof addressSchema>
export const Address = addressSchema as unknown as Address

export type Value = Data.Static<typeof valueSchema>
export const Value = valueSchema as unknown as Value

export type OutputDatum = Data.Static<typeof outputDatumSchema>
export const OutputDatum = outputDatumSchema as unknown as OutputDatum
