import { Effect, Either, pipe, Schema } from "effect";
import * as SocketClient from "./Socket.js";
import * as HydraMessage from "./HydraMessage.js";
import { ParseError } from "effect/ParseResult";

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

export class HydraNode extends Effect.Service<HydraNode>()("HydraNode", {
  effect: Effect.gen(function* () {
    //TODO: Replace with actual server URL from config context
    const connection = yield* SocketClient.createWebSocketConnection(
      "ws://localhost:1234",
    );

    let status: Status = "DISCONNECTED";

    const initialize = Effect.gen(function* () {
      yield* connection.sendMessage(JSON.stringify({ tag: "Init" }));
      const response = new TextDecoder().decode(
        yield* connection.messages.take,
      );
      const hydraMessage: HydraMessage.InitializingMessage =
        yield* Schema.decode(
          Schema.parseJson(HydraMessage.InitializingMessageSchema),
        )(response);
      status = "INITIALIZING";
    }).pipe(Effect.scoped);

    const newTx = (transaction: TransactionRequest) =>
      Effect.gen(function* () {
        yield* connection.sendMessage(
          JSON.stringify({ tag: "NewTx", transaction }),
        );

        const response = new TextDecoder().decode(
          yield* connection.messages.take,
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

        // Try to decode as TxInvalidMessage
        const invalidMessage: Either.Either<
          HydraMessage.TxInvalidMessage,
          ParseError
        > = yield* pipe(
          Schema.decode(Schema.parseJson(HydraMessage.TxInvalidMessageSchema))(
            response,
          ),
          Effect.either,
        );

        if (Either.isRight(invalidMessage)) {
          return yield* Effect.fail(
            new Error(
              `Transaction invalid: ${invalidMessage.right.transaction.txId}`,
            ),
          );
        }

        // Try to decode as CommandFailedMessage
        const failedMessage: Either.Either<
          HydraMessage.CommandFailedMessage,
          ParseError
        > = yield* pipe(
          Schema.decode(
            Schema.parseJson(HydraMessage.CommandFailedMessageSchema),
          )(response),
          Effect.either,
        );

        if (Either.isRight(failedMessage)) {
          return yield* Effect.fail(
            new Error(
              `Command failed: ${JSON.stringify(failedMessage.right.clientInput)}`,
            ),
          );
        }

        // If none of the expected message types matched, fail with unexpected message
        return yield* Effect.fail(
          new Error(`Unexpected message received: ${response}`),
        );
      }).pipe(Effect.scoped);

    return {
      initialize,
      newTx,
      getStatus: () => status,
    };
  }),
}) {}
