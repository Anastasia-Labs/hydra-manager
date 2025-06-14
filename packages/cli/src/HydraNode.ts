import {
  Effect,
  Either,
  pipe,
  PubSub,
  Option,
  Schema,
  Layer,
  Fiber,
  Schedule,
  Equal,
} from "effect";
import * as SocketClient from "./Socket.js";
import * as HydraMessage from "./HydraMessage.js";
import { Status } from "./HydraMessage.js";
import { ParseError } from "effect/ParseResult";
import { SocketError } from "@effect/platform/Socket";
import * as NodeConfig from "./utils/AddressConverters.js";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  Socket,
} from "@effect/platform";
import { Assets, ProtocolParameters, UTxO } from "@lucid-evolution/core-types";
import { HttpClientError } from "@effect/platform/HttpClientError";
import { Scope } from "effect/Scope";
import { WebSocketConstructor } from "@effect/platform/Socket";
import { WebSocket } from "ws";
import { Dequeue } from "effect/Queue";
import { HttpBodyError } from "@effect/platform/HttpBody";
import { filterStatusOk } from "@effect/platform/HttpClientResponse";
import { CML } from "@lucid-evolution/lucid";
import * as Common from "@hydra-manager/common";

export class HydraNode extends Effect.Service<HydraNode>()("HydraNode", {
  effect: Effect.gen(function* () {
    yield* Effect.log("HydraNode was created");
    const { nodeConfig } = yield* Common.NodeConfigService;
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
          const maybeStatus: Option.Option<HydraMessage.Status> =
            Option.firstSomeOf([
              yield* Effect.option(
                HydraMessage.decodeStatusMessage(messageText),
              ).pipe(
                Effect.map(Option.flatMap(HydraMessage.statusMessageToStatus)),
              ),
              yield* Effect.option(
                HydraMessage.decodeHydraMessage(messageText),
              ).pipe(
                Effect.map(Option.flatMap(HydraMessage.hydraMessageToStatus)),
              ),
            ]);

          if (Option.isSome(maybeStatus)) {
            const statusRaw = yield* maybeStatus;
            yield* Effect.log(
              `Valid status received [${statusRaw}] from message: ${messageText}`,
            );
            status = statusRaw;
          }
        }
      }),
    );

    const retryPolicy = Schedule.addDelay(
      Schedule.compose(Schedule.exponential(50), Schedule.recurs(10)),
      () => "100 millis",
    );
    const awaitStatus = (
      targetStatus: Status,
    ): Effect.Effect<void, Error, never> =>
      Effect.retry(
        Effect.gen(function* () {
          if (status != targetStatus) {
            yield* Effect.fail(
              new Error(`Status is ${status}, espected ${targetStatus}`),
            );
          }
        }),
        retryPolicy,
      );

    const initialize = Effect.gen(function* () {
      const messageQueue: Dequeue<Uint8Array> = yield* PubSub.subscribe(
        connection.messages,
      );
      yield* Effect.log(`Called initialize for ${nodeName} node`);
      yield* awaitStatus("IDLE");

      yield* connection.sendMessage(JSON.stringify({ tag: "Init" })).pipe(
        Effect.tap(() => Effect.log("Init message sent")),
        Effect.scoped,
      );

      while (status !== "INITIALIZING") {
        const rawMessage: Uint8Array = yield* messageQueue.take;
        const messageText: string = new TextDecoder().decode(rawMessage);

        yield* Effect.log(
          `Received raw message during initialization command: ${messageText}`,
        );

        const maybe: Option.Option<HydraMessage.InitializingMessage> =
          yield* Effect.option(
            HydraMessage.decodeInitializingMessage(messageText),
          );

        if (Option.isSome(maybe)) {
          const hydraMessage: HydraMessage.InitializingMessage = maybe.value;
          yield* Effect.log(
            `Valid initializing message received: ${hydraMessage.tag}`,
          );
          break;
        } else {
          yield* Effect.log(
            `Received non-initializing message: ${messageText}`,
          );
        }
      }

      yield* Effect.log(`Initialization complete, status is now ${status}`);
    });

    const close = Effect.gen(function* () {
      const messageQueue: Dequeue<Uint8Array> = yield* PubSub.subscribe(
        connection.messages,
      );

      yield* awaitStatus("OPEN");

      yield* connection.sendMessage(JSON.stringify({ tag: "Close" })).pipe(
        Effect.tap(() => Effect.log("Close message sent")),
        Effect.scoped,
      );

      while (status !== "CLOSED") {
        const rawMessage: Uint8Array = yield* messageQueue.take;
        const messageText: string = new TextDecoder().decode(rawMessage);

        yield* Effect.log(
          `Received raw message during closing command: ${messageText}`,
        );

        const maybe: Option.Option<HydraMessage.ClosedMessage> =
          yield* Effect.option(HydraMessage.decodeClosedMessage(messageText));

        if (Option.isSome(maybe)) {
          const hydraMessage: HydraMessage.ClosedMessage = maybe.value;
          yield* Effect.log(
            `Valid closeing message received: ${hydraMessage.tag}`,
          );
          break;
        } else {
          yield* Effect.log(`Received non-closing message: ${messageText}`);
        }
      }

      yield* Effect.log(`Closing complete, status is now ${status}`);
    });

    const fanout = Effect.gen(function* () {
      const messageQueue: Dequeue<Uint8Array> = yield* PubSub.subscribe(
        connection.messages,
      );
      yield* awaitStatus("FANOUT_POSSIBLE");

      yield* connection.sendMessage(JSON.stringify({ tag: "Fanout" })).pipe(
        Effect.tap(() => Effect.log("Close message sent")),
        Effect.scoped,
      );

      while (status !== "FINAL") {
        const rawMessage: Uint8Array = yield* messageQueue.take;
        const messageText: string = new TextDecoder().decode(rawMessage);

        yield* Effect.log(
          `Received raw message during initialization command: ${messageText}`,
        );

        const maybe: Option.Option<HydraMessage.FinalizedMessage> =
          yield* Effect.option(
            HydraMessage.decodeFinalizedMessage(messageText),
          );

        if (Option.isSome(maybe)) {
          const hydraMessage: HydraMessage.FinalizedMessage = maybe.value;
          yield* Effect.log(
            `Valid finalized message received: ${hydraMessage.tag}`,
          );
          break;
        } else {
          yield* Effect.log(`Received non-finalized message: ${messageText}`);
        }
      }

      yield* Effect.log(`Fanout complete, status is now ${status}`);
    });

    const newTx = (
      transaction: HydraMessage.DraftCommitTxResponseType,
    ): Effect.Effect<string, SocketError | Error, Scope> =>
      Effect.gen(function* () {
        const messageQueue: Dequeue<Uint8Array> = yield* PubSub.subscribe(
          connection.messages,
        );
        yield* connection.sendMessage(
          JSON.stringify({ tag: "NewTx", transaction }),
        );

        const response: string = new TextDecoder().decode(
          yield* messageQueue.take,
        );

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

    const snapshotUTxOs: Effect.Effect<
      UTxO[],
      HttpClientError | Error | ParseError,
      never
    > = Effect.gen(function* () {
      Effect.log(`Called snapshotUTxOs for ${nodeName}`);

      yield* awaitStatus("OPEN");

      const response = yield* httpClient.get(`${httpServerUrl}/snapshot/utxo`);

      const responseData: HydraMessage.UTxOResponseType =
        yield* HttpClientResponse.schemaBodyJson(
          HydraMessage.UTxOResponseSchema,
        )(response);

      return HydraMessage.utxoResponseToUTxOArray(responseData);
    });

    const commitHTTPHandle = (
      utxos: Array<UTxO>,
    ): Effect.Effect<
      HydraMessage.DraftCommitTxResponseType,
      ParseError | HttpClientError | HttpBodyError
    > =>
      Effect.gen(function* () {
        yield* Effect.log(`Running commitHTTPHandle`);
        const response: HydraMessage.DraftCommitTxResponseType =
          yield* HttpClientRequest.post(`${httpServerUrl}/commit`).pipe(
            HttpClientRequest.bodyJson(
              HydraMessage.utxoArrayToUTxOResponse(utxos),
            ),
            Effect.flatMap(httpClient.execute),
            Effect.flatMap(
              HttpClientResponse.schemaBodyJson(
                HydraMessage.DraftCommitTxResponseSchema,
              ),
            ),
            Effect.scoped,
          );
        yield* Effect.log(`Received expected response at commitHTTPHandle`);
        return response;
      });

    const cardanoTransactionHTTPHandle = (
      transaction: HydraMessage.DraftCommitTxResponseType,
    ): Effect.Effect<
      void,
      Error | ParseError | HttpClientError | HttpBodyError
    > =>
      Effect.gen(function* () {
        yield* Effect.log(`Running cardanoTransactionHTTPHandle`);
        const response: HydraMessage.cardanoTransactionResponseType =
          yield* HttpClientRequest.post(
            `${httpServerUrl}/cardano-transaction`,
          ).pipe(
            HttpClientRequest.bodyJson(transaction),
            Effect.flatMap(httpClient.execute),
            Effect.flatMap(
              HttpClientResponse.schemaBodyJson(
                HydraMessage.cardanoTransactionResponseSchema,
              ),
            ),
            Effect.scoped,
          );
        if (response.tag === "ScriptFailedInWallet") {
          yield* Effect.fail(
            new Error(`Failed to submit the transaction ${transaction}`),
          );
        }
        yield* Effect.log(
          `successfully commited utxos at cardanoTransactionHTTPHandle`,
        );
      });

    return {
      nodeName,
      initialize,
      close,
      fanout,
      newTx,
      protocolParameters,
      snapshotUTxOs,
      commitHTTPHandle,
      cardanoTransactionHTTPHandle,
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
