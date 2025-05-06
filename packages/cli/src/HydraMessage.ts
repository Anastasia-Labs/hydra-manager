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
