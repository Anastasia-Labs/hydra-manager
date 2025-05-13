import {
  Effect,
  Either,
  pipe,
  PubSub,
  Option,
  Schema,
  Layer,
  Fiber,
} from "effect";
import * as SocketClient from "./Socket.js";
import * as HydraMessage from "./HydraMessage.js";
import { Status } from "./HydraMessage.js";
import { ParseError } from "effect/ParseResult";
import { SocketError } from "@effect/platform/Socket";
import * as NodeConfig from "./NodeConfig.js";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse,
  Socket,
} from "@effect/platform";
import { Assets, ProtocolParameters, UTxO } from "@lucid-evolution/core-types";
import { HttpClientError } from "@effect/platform/HttpClientError";
import { Scope } from "effect/Scope";
import { WebSocketConstructor } from "@effect/platform/Socket";
import { WebSocket } from "ws";
import { Dequeue } from "effect/Queue";

export class HydraNode extends Effect.Service<HydraNode>()("HydraNode", {
  effect: Effect.gen(function* () {
    yield* Effect.log("HydraNode was created");
    const { nodeConfig } = yield* NodeConfig.NodeConfigService;
    const nodeName = nodeConfig.name;

    const connection = yield* SocketClient.createWebSocketConnection(
      nodeConfig.url,
    );
    const httpClient = yield* HttpClient.HttpClient;
    const httpServerUrl = nodeConfig.url.replace("ws://", "http://");

    const messageQueue: Dequeue<Uint8Array> = yield* PubSub.subscribe(
      connection.messages,
    );

    let status: Status = "DISCONNECTED";

    const statusFiber = yield* Effect.fork(
      Effect.gen(function* () {
        let rawMessage: Uint8Array;
        while ((rawMessage = yield* messageQueue.take)) {
          const messageText: string = new TextDecoder().decode(rawMessage);

          const maybe: Option.Option<HydraMessage.StatusMessage> =
            yield* Effect.option(HydraMessage.decodeStatusMessage(messageText));

          if (Option.isSome(maybe)) {
            const statusMessage: HydraMessage.StatusMessage = maybe.value;
            yield* Effect.log(
              `Valid status message received: ${statusMessage.headStatus}`,
            );
            status = HydraMessage.statusMessageToStatus(statusMessage);
          }
        }
      }),
    );

    const initialize = Effect.gen(function* () {
      const messageQueue: Dequeue<Uint8Array> = yield* PubSub.subscribe(
        connection.messages,
      );

      // Send initialization message
      yield* connection.sendMessage(JSON.stringify({ tag: "Init" })).pipe(
        Effect.tap(() => Effect.log("Init message sent")),
        Effect.scoped,
      );

      // Wait for a valid initializing message from the server
      while (status !== "INITIALIZING") {
        // Take next message from subscription
        const rawMessage: Uint8Array = yield* messageQueue.take;
        const messageText: string = new TextDecoder().decode(rawMessage);

        yield* Effect.log(
          `Received raw message during initialization command: ${messageText}`,
        );

        // Try to decode and validate the message
        const maybe: Option.Option<HydraMessage.InitializingMessage> =
          yield* Effect.option(
            HydraMessage.decodeInitializingMessage(messageText),
          );

        if (Option.isSome(maybe)) {
          // Valid initializing message found
          const hydraMessage: HydraMessage.InitializingMessage = maybe.value;
          yield* Effect.log(
            `Valid initializing message received: ${hydraMessage.tag}`,
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

      yield* Effect.log("Initialization complete, status is now INITIALIZING");
    });

    const newTx = (
      transaction: HydraMessage.TransactionRequestType,
    ): Effect.Effect<string, SocketError | Error, Scope> =>
      Effect.gen(function* () {
        const newTxMessage: Dequeue<Uint8Array> = yield* PubSub.subscribe(
          connection.messages,
        );
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
      yield* Effect.log(
        `Received response from protocol-parameters endpoint: ${response}`,
      );

      // Parse and validate response using schema
      const responseData: HydraMessage.ProtocolParametersResponse =
        yield* HttpClientResponse.schemaBodyJson(
          HydraMessage.ProtocolParametersResponseSchema,
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
      const responseData: HydraMessage.UTxOResponseType =
        yield* HttpClientResponse.schemaBodyJson(
          HydraMessage.UTxOResponseSchema,
        )(response);

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

  dependencies: [
    Layer.succeed(WebSocketConstructor, (url, options) => {
      return new WebSocket(url, options) as unknown as globalThis.WebSocket;
    }),
    FetchHttpClient.layer,
  ],
}) {}
