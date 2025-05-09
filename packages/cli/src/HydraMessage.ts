import { Schema } from "effect";

export const InitializingMessageSchema = Schema.Struct({
  tag: Schema.Literal("HeadIsInitializing"),
});
export type InitializingMessage = typeof InitializingMessageSchema.Type;

export const OpenMessageSchema = Schema.Struct({
  tag: Schema.Literal("HeadIsOpen"),
});
export type OpenMessage = typeof OpenMessageSchema.Type;

export const ClosedMessageSchema = Schema.Struct({
  tag: Schema.Literal("HeadIsClosed"),
});
export type ClosedMessage = typeof ClosedMessageSchema.Type;

export const FinalizedMessageSchema = Schema.Struct({
  tag: Schema.Literal("HeadIsFinalized"),
});
export type FinalizedMessage = typeof FinalizedMessageSchema.Type;

export const GreetingsMessageSchema = Schema.Struct({
  tag: Schema.Literal("Greetings"),
  headStatus: Schema.String,
});
export type GreetingsMessage = typeof GreetingsMessageSchema.Type;

export const ReadyToFanoutMessageSchema = Schema.Struct({
  tag: Schema.Literal("ReadyToFanout"),
});
export type ReadyToFanoutMessage = typeof ReadyToFanoutMessageSchema.Type;

export const TxValidMessageSchema = Schema.Struct({
  tag: Schema.Literal("TxValid"),
  transaction: Schema.Struct({
    txId: Schema.String,
  }),
});
export type TxValidMessage = typeof TxValidMessageSchema.Type;

export const TxInvalidMessageSchema = Schema.Struct({
  tag: Schema.Literal("TxInvalid"),
  transaction: Schema.Struct({
    txId: Schema.String,
  }),
});
export type TxInvalidMessage = typeof TxInvalidMessageSchema.Type;

export const CommandFailedMessageSchema = Schema.Struct({
  tag: Schema.Literal("CommandFailed"),
  clientInput: Schema.Struct({
    tag: Schema.String,
    transaction: Schema.optional(
      Schema.Struct({
        txId: Schema.String,
      }),
    ),
  }),
});
export type CommandFailedMessage = typeof CommandFailedMessageSchema.Type;

export const PostTxOnChainFailedMessageSchema = Schema.Struct({
  tag: Schema.Literal("PostTxOnChainFailed"),
  postChainTx: Schema.Struct({
    tag: Schema.String,
  }),
  postTxError: Schema.Record({ key: Schema.String, value: Schema.Any }),
});
export type PostTxOnChainFailedMessage =
  typeof PostTxOnChainFailedMessageSchema.Type;

export const SnapshotConfirmedMessageSchema = Schema.Struct({
  tag: Schema.Literal("SnapshotConfirmed"),
  snapshot: Schema.Struct({
    confirmedTransactions: Schema.optional(Schema.Array(Schema.String)),
    confirmed: Schema.optional(
      Schema.Array(
        Schema.Record({
          key: Schema.String,
          value: Schema.Unknown,
        }),
      ),
    ),
  }),
});
export type SnapshotConfirmedMessage =
  typeof SnapshotConfirmedMessageSchema.Type;

export const HydraMessageSchema = Schema.Union(
  InitializingMessageSchema,
  OpenMessageSchema,
  ClosedMessageSchema,
  FinalizedMessageSchema,
  GreetingsMessageSchema,
  ReadyToFanoutMessageSchema,
  TxValidMessageSchema,
  TxInvalidMessageSchema,
  CommandFailedMessageSchema,
  PostTxOnChainFailedMessageSchema,
  SnapshotConfirmedMessageSchema,
);
export type HydraMessage = typeof HydraMessageSchema.Type;

// Define schema for protocol parameters response
export const ProtocolParametersResponseSchema = Schema.Struct({
  txFeePerByte: Schema.Number,
  txFeeFixed: Schema.Number,
  maxTxSize: Schema.Number,
  maxValueSize: Schema.Number,
  stakeAddressDeposit: Schema.String,
  stakePoolDeposit: Schema.String,
  dRepDeposit: Schema.String,
  govActionDeposit: Schema.String,
  executionUnitPrices: Schema.Struct({
    priceMemory: Schema.Number,
    priceSteps: Schema.Number,
  }),
  maxTxExecutionUnits: Schema.Struct({
    memory: Schema.String,
    steps: Schema.String,
  }),
  utxoCostPerByte: Schema.String,
  collateralPercentage: Schema.Number,
  maxCollateralInputs: Schema.Number,
  minFeeRefScriptCostPerByte: Schema.Number,
  costModels: Schema.Struct({
    PlutusV1: Schema.Array(Schema.Number),
    PlutusV2: Schema.Array(Schema.Number),
    PlutusV3: Schema.Array(Schema.Number),
  }),
});

export const LovelaceSchema = Schema.Struct({
  lovelace: Schema.Number,
});

export const TokenSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Number,
});

export const AssetsSchema = Schema.Record({
  key: Schema.String,
  value: TokenSchema,
});

export type AssetsSchema = typeof AssetsSchema.Type;

export const ValueSchema = Schema.Struct(LovelaceSchema.fields, AssetsSchema);

export type Value = typeof ValueSchema.Type;

export const UTxOItemSchema = Schema.Struct({
  address: Schema.String,
  datum: Schema.optional(Schema.String),
  datumHash: Schema.optional(Schema.String),
  inlineDatum: Schema.optional(Schema.String),
  inlineDatumRaw: Schema.optional(Schema.String),
  referenceScript: Schema.optional(Schema.String),
  value: ValueSchema,
});

export const UTxOResponseSchema = Schema.Record({
  key: Schema.String,
  value: UTxOItemSchema,
});

export type ProtocolParametersResponse =
  typeof ProtocolParametersResponseSchema.Type;
export type UTxOResponseType = typeof UTxOResponseSchema.Type;
