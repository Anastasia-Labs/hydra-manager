import { Assets, UTxO } from "@lucid-evolution/core-types";
import { Option, Record, Schema } from "effect";

export type Status =
  | "DISCONNECTED"
  | "CONNECTING"
  | "IDLE"
  | "INITIALIZING"
  | "OPEN"
  | "CLOSED"
  | "FANOUT_POSSIBLE"
  | "FINAL";

export const StatusMessageSchema = Schema.Struct({
  headStatus: Schema.Literal(
    "Disconnected",
    "Connecting",
    "Idle",
    "Initializing",
    "Open",
    "Closed",
    "FanoutPossible",
    "Final",
  ),
});
export type StatusMessage = typeof StatusMessageSchema.Type;

export function statusMessageToStatus(
  message: StatusMessage,
): Option.Option<Status> {
  switch (message.headStatus) {
    case "Disconnected":
      return Option.some("DISCONNECTED");
    case "Connecting":
      return Option.some("CONNECTING");
    case "Idle":
      return Option.some("IDLE");
    case "Initializing":
      return Option.some("INITIALIZING");
    case "Open":
      return Option.some("OPEN");
    case "Closed":
      return Option.some("CLOSED");
    case "FanoutPossible":
      return Option.some("FANOUT_POSSIBLE");
    case "Final":
      return Option.some("FINAL");
  }
}

export const decodeStatusMessage = Schema.decode(
  Schema.parseJson(StatusMessageSchema),
);

export function hydraMessageToStatus(
  message: HydraMessage,
): Option.Option<Status> {
  switch (message.tag) {
    case "HeadIsInitializing":
      return Option.some("INITIALIZING");
    case "HeadIsOpen":
      return Option.some("OPEN");
    case "HeadIsClosed":
      return Option.some("CLOSED");
    case "ReadyToFanout":
      return Option.some("FANOUT_POSSIBLE");
    case "HeadIsFinalized":
      return Option.some("FINAL");
    default:
      return Option.none();
  }
}

export const InitializingMessageSchema = Schema.Struct({
  tag: Schema.Literal("HeadIsInitializing"),
});
export type InitializingMessage = typeof InitializingMessageSchema.Type;

export const decodeInitializingMessage = Schema.decode(
  Schema.parseJson(InitializingMessageSchema),
);

export const OpenMessageSchema = Schema.Struct({
  tag: Schema.Literal("HeadIsOpen"),
});
export type OpenMessage = typeof OpenMessageSchema.Type;

export const ClosedMessageSchema = Schema.Struct({
  tag: Schema.Literal("HeadIsClosed"),
});
export type ClosedMessage = typeof ClosedMessageSchema.Type;

export const decodeClosedMessage = Schema.decode(
  Schema.parseJson(ClosedMessageSchema),
);

export const FinalizedMessageSchema = Schema.Struct({
  tag: Schema.Literal("HeadIsFinalized"),
});
export type FinalizedMessage = typeof FinalizedMessageSchema.Type;

export const decodeFinalizedMessage = Schema.decode(
  Schema.parseJson(FinalizedMessageSchema),
);

export const GreetingsMessageSchema = Schema.Struct({
  tag: Schema.Literal("Greetings"),
  headStatus: Schema.String,
});
export type GreetingsMessage = typeof GreetingsMessageSchema.Type;

export const ReadyToFanoutMessageSchema = Schema.Struct({
  tag: Schema.Literal("ReadyToFanout"),
});
export type ReadyToFanoutMessage = typeof ReadyToFanoutMessageSchema.Type;

export const decodeReadyToFanoutMessage = Schema.decode(
  Schema.parseJson(ReadyToFanoutMessageSchema),
);

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

export const decodeHydraMessage = Schema.decode(
  Schema.parseJson(HydraMessageSchema),
);

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

export function utxoResponseToUTxOArray(
  utxoResponse: UTxOResponseType,
): Array<UTxO> {
  return Object.entries(utxoResponse).map(([utxoKey, utxoData]) => {
    const [txHash, outputIndexStr] = utxoKey.split("#");
    const outputIndex = Number(outputIndexStr);

    const assets: Assets = {};

    if (utxoData.value.lovelace) {
      assets["lovelace"] = BigInt(utxoData.value.lovelace);
    }
    // Process other assets if they exist
    // Iterate through all entries in value object except lovelace
    Object.entries(utxoData.value).forEach(([key, value]) => {
      if (key !== "lovelace") {
        // Narrow down to assets
        if (typeof value === "object") {
          Object.entries(value).forEach(([assetName, amount]) => {
            const fullAssetId = key + assetName;
            assets[fullAssetId] = BigInt(amount);
          });
        }
      }
    });

    const utxo: UTxO = {
      txHash,
      outputIndex,
      address: utxoData.address,
      assets,
      datum: utxoData.datum,
      datumHash: utxoData.datumHash,
    };

    if (utxoData.inlineDatum !== undefined) {
      //TODO: Decode inline datum
      //NOTE: Double check the hydra api docs
      const inline = utxoData.inlineDatum;
    }

    if (utxoData.referenceScript !== undefined) {
      //TODO: Decode reference script
      utxo.scriptRef = undefined;
    }

    return utxo;
  });
}

function joinValueRecords(
  records: Record<string, number | Record<string, number>>[],
): Record<string, number | Record<string, number>> {
  return records.reduce((acc, record) => {
    return Object.assign(acc, record);
  });
}

export function utxoArrayToUTxOResponse(utxos: Array<UTxO>): UTxOResponseType {
  return utxos.reduce(
    (acc, utxo: UTxO) => {
      acc[utxo.txHash + "#" + utxo.outputIndex] = {
        address: utxo.address,
        datum: utxo.datum,
        datumHash: utxo.datumHash,
        inlineDatum: utxo.datum,
        value: joinValueRecords(
          Object.keys(utxo.assets).map((assetKey) => {
            let res: Record<string, number | Record<string, number>>;
            if (assetKey == "lovelace") {
              res = { [assetKey]: Number(utxo.assets[assetKey].valueOf()) };
            } else {
              const policyId = assetKey.slice(0, 56);
              const assetName = assetKey.slice(56);
              res = {
                [policyId]: {
                  [assetName]: Number(utxo.assets[assetKey].valueOf()),
                },
              };
            }
            return res;
          }),
        ),
      };
      return acc;
    },
    {} as Record<string, any>,
  );
}

export function utxosToString(nodeUTxOs: Array<UTxO>): string {
 return JSON.stringify(nodeUTxOs, (_, v) =>
          typeof v === "bigint" ? v.toString() : v,
        );
}

export const DraftCommitTxResponseSchema = Schema.Struct({
  type: Schema.String,
  description: Schema.String,
  cborHex: Schema.String,
  txId: Schema.optional(Schema.String),
});
export type DraftCommitTxResponseType = typeof DraftCommitTxResponseSchema.Type;

export const TransactionSubmittedSchema = Schema.Struct({
  tag: Schema.Literal("TransactionSubmitted")
});
export type TransactionSubmittedType = typeof TransactionSubmittedSchema.Type;

export const PostTxErrorSchema = Schema.Struct({
    tag: Schema.Literal("ScriptFailedInWallet"),
    redeemerPtr: Schema.String,
    failureReason: Schema.String,
});
export type PostTxErrorType = typeof PostTxErrorSchema.Type;

export const cardanoTransactionResponseSchema = Schema.Union(
  TransactionSubmittedSchema,
  PostTxErrorSchema,
)
export type cardanoTransactionResponseType = typeof cardanoTransactionResponseSchema.Type;
