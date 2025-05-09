import { Effect, Either, pipe, PubSub, Option, Record, Schema } from "effect";
import * as SocketClient from "./Socket.js";
import * as HydraMessage from "./HydraMessage.js";
import { ParseError } from "effect/ParseResult";
import { SocketError } from "@effect/platform/Socket";
import { NodeConfig } from "./ProjectConfig.js";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse,
  Socket,
} from "@effect/platform";
import { Assets, ProtocolParameters, UTxO } from "@lucid-evolution/core-types";
import { HttpClientError } from "@effect/platform/HttpClientError";

type Status =
  | "DISCONNECTED"
  | "CONNECTING"
  | "INITIALIZING"
  | "OPEN"
  | "CLOSED"
  | "FANOUT_POSSIBLE"
  | "FINAL";

type TransactionRequest = {
  type: string;
  description: string;
  cborHex: string;
  txId?: string;
};

// Define schema for protocol parameters response
const ProtocolParametersResponseSchema = Schema.Struct({
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

const LovelaceSchema = Schema.Struct({
  lovelace: Schema.Number,
});

const TokenSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Number,
});

const AssetsSchema = Schema.Record({
  key: Schema.String,
  value: TokenSchema,
});

type AssetsSchema = typeof AssetsSchema.Type;

const ValueSchema = Schema.Struct(LovelaceSchema.fields, AssetsSchema);

type Value = typeof ValueSchema.Type;

const UTxOItemSchema = Schema.Struct({
  address: Schema.String,
  datum: Schema.optional(Schema.String),
  datumHash: Schema.optional(Schema.String),
  inlineDatum: Schema.optional(Schema.String),
  inlineDatumRaw: Schema.optional(Schema.String),
  referenceScript: Schema.optional(Schema.String),
  value: ValueSchema,
});

const UTxOResponseSchema = Schema.Record({
  key: Schema.String,
  value: UTxOItemSchema,
});

type ProtocolParametersResponse = typeof ProtocolParametersResponseSchema.Type;
type UTxOResponseType = typeof UTxOResponseSchema.Type;

export class HydraNode extends Effect.Service<HydraNode>()("HydraNode", {
  effect: Effect.gen(function* () {
    yield* Effect.log("HydraNode was created")
    const nodeConfigEffect = yield* NodeConfig;
    const nodeConfig = yield* nodeConfigEffect.nodeConfig;
    const nodeName = nodeConfig.name;

    const connection = yield* SocketClient.createWebSocketConnection(
      nodeConfig.url,
    );
    const initializeMessage = yield* PubSub.subscribe(connection.messages);
    const newTxMessage = yield* PubSub.subscribe(connection.messages);
    yield* connection.publishMessageFiber;

    const httpClient = yield* HttpClient.HttpClient;
    const httpServerUrl = nodeConfig.url.replace("ws://", "http://");

    //TODO: When constructing this service the status should be initialized by the server using the greetings websocket message.
    // For now, we will set it to "DISCONNECTED" until we receive a valid initializing message.
    let status: Status = "DISCONNECTED";

    const initialize: Effect.Effect<void, ParseError | SocketError> =
      Effect.gen(function* () {
        // Send initialization message
        yield* connection.sendMessage(JSON.stringify({ tag: "Init" })).pipe(
          Effect.tap(() => Effect.log("Init message sent")),
          Effect.scoped,
        );

        // Wait for a valid initializing message from the server
        while (status !== "INITIALIZING") {
          // Take next message from subscription
          const rawMessage: Uint8Array = yield* initializeMessage.take;
          const messageText: string = new TextDecoder().decode(rawMessage);

          yield* Effect.log(
            `Received raw message during initialization: ${messageText}`,
          );

          // Try to decode and validate the message
          const maybe: Option.Option<HydraMessage.InitializingMessage> =
            yield* Effect.option(
              Schema.decode(
                Schema.parseJson(HydraMessage.InitializingMessageSchema),
              )(messageText),
            );

          if (Option.isSome(maybe)) {
            // Valid initializing message found
            const hydraMessage: HydraMessage.InitializingMessage = maybe.value;
            yield* Effect.log(
              `Valid initializing message received: ${maybe.value.tag}`,
            );
            status = "INITIALIZING";
            break;
          } else {
            // Log failure but continue waiting
            yield* Effect.log(
              `Received non-initializing message: ${messageText}`,
            );
          }
        }

        yield* Effect.log(
          "Initialization complete, status is now INITIALIZING",
        );
      });

    const newTx = (
      transaction: TransactionRequest,
    ): Effect.Effect<string, SocketError | Error> =>
      Effect.gen(function* () {
        yield* connection.sendMessage(
          JSON.stringify({ tag: "NewTx", transaction }),
        );

        const response: string = new TextDecoder().decode(
          yield* newTxMessage.take,
        );

        // Try to decode as a TxValidMessage
        const validMessage: Either.Either<
          HydraMessage.TxValidMessage,
          ParseError
        > = yield* pipe(
          Schema.decode(Schema.parseJson(HydraMessage.TxValidMessageSchema))(
            response,
          ),
          Effect.either,
        );

        if (Either.isRight(validMessage)) {
          return validMessage.right.transaction.txId;
        }

        const errorMessage:
          | HydraMessage.TxInvalidMessage
          | HydraMessage.CommandFailedMessage = yield* pipe(
          Schema.decode(
            Schema.parseJson(
              Schema.Union(
                HydraMessage.TxInvalidMessageSchema,
                HydraMessage.CommandFailedMessageSchema,
              ),
            ),
          )(response),
        );

        return yield* Effect.fail(
          new Error(`Transaction failed: ${errorMessage}`),
        );
      }).pipe(Effect.scoped);

    const protocolParameters: Effect.Effect<
      ProtocolParameters,
      ParseError | HttpClientError
    > = Effect.gen(function* () {
      // Make HTTP GET request to protocol-parameters endpoint
      const response = yield* httpClient.get(
        `${httpServerUrl}/protocol-parameters`,
      );

      // Parse and validate response using schema
      const responseData: ProtocolParametersResponse =
        yield* HttpClientResponse.schemaBodyJson(
          ProtocolParametersResponseSchema,
        )(response);

      // Transform response data to ProtocolParameters format
      const parameters: ProtocolParameters = {
        minFeeA: responseData.txFeePerByte,
        minFeeB: responseData.txFeeFixed,
        maxTxSize: responseData.maxTxSize,
        maxValSize: responseData.maxValueSize,
        keyDeposit: BigInt(responseData.stakeAddressDeposit),
        poolDeposit: BigInt(responseData.stakePoolDeposit),
        drepDeposit: BigInt(responseData.dRepDeposit),
        govActionDeposit: BigInt(responseData.govActionDeposit),
        priceMem: responseData.executionUnitPrices.priceMemory,
        priceStep: responseData.executionUnitPrices.priceSteps,
        maxTxExMem: BigInt(responseData.maxTxExecutionUnits.memory),
        maxTxExSteps: BigInt(responseData.maxTxExecutionUnits.steps),
        coinsPerUtxoByte: BigInt(responseData.utxoCostPerByte),
        collateralPercentage: responseData.collateralPercentage,
        maxCollateralInputs: responseData.maxCollateralInputs,
        minFeeRefScriptCostPerByte: responseData.minFeeRefScriptCostPerByte,
        costModels: {
          PlutusV1: Object.fromEntries(
            responseData.costModels.PlutusV1.map((v, i) => [i.toString(), v]),
          ),
          PlutusV2: Object.fromEntries(
            responseData.costModels.PlutusV2.map((v, i) => [i.toString(), v]),
          ),
          PlutusV3: Object.fromEntries(
            responseData.costModels.PlutusV3.map((v, i) => [i.toString(), v]),
          ),
        },
      };

      return parameters;
    });

    const snapshotUTxO: Effect.Effect<
      Array<UTxO>,
      ParseError | HttpClientError
    > = Effect.gen(function* () {
      // Make HTTP GET request to snapshot/utxo endpoint
      const response = yield* httpClient.get(`${httpServerUrl}/snapshot/utxo`);

      // Parse and validate response using schema
      const responseData: UTxOResponseType =
        yield* HttpClientResponse.schemaBodyJson(UTxOResponseSchema)(response);

      // Transform response data to UTxO array format
      const utxos: Array<UTxO> = Object.entries(responseData).map(
        ([utxoKey, utxoData]) => {
          const [txHash, outputIndexStr] = utxoKey.split("#");
          const outputIndex = Number(outputIndexStr);

          // Convert value to assets type
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

          // Create UTxO object with required fields
          const utxo: UTxO = {
            txHash,
            outputIndex,
            address: utxoData.address,
            assets,
          };

          // Add optional fields if they exist
          if (utxoData.datum !== undefined) {
            utxo.datum = utxoData.datum;
          }

          if (utxoData.datumHash !== undefined) {
            utxo.datumHash = utxoData.datumHash;
          }

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
        },
      );

      return utxos;
    });

    return {
      nodeName,
      initialize,
      newTx,
      protocolParameters,
      snapshotUTxO,
      getStatus: () => status,
    };
  }),

  dependencies: [Socket.layerWebSocketConstructorGlobal, FetchHttpClient.layer],
}) {}
