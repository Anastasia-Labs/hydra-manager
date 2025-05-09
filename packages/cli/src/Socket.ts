import { Socket } from "@effect/platform";
import { Effect, PubSub } from "effect";

export const createWebSocketConnection = (url: string) =>
  Effect.gen(function* () {
    yield* Effect.log(`Connecting to WebSocket at: ${url}`);

    // Create the WebSocket
    const socket = yield* Socket.makeWebSocket(url);

    // Create an unbounded queue for messages
    const messages = yield* PubSub.unbounded<Uint8Array>();
    yield* Effect.log("Message queue created");

    /*
     * Start a fiber that continuously processes incoming messages into the pubsub queue
     */
    const publishMessageFiber = Effect.fork(
      socket
        .run((data) => {
          return Effect.gen(function* () {
            yield* Effect.log(
              `Client Socket message received : ${data}, length ${data.length}`,
            );
            return yield* PubSub.publish(messages, data);
          });
        })
        .pipe(
          Effect.tap(() =>
            Effect.log("Client Socket message received and queued"),
          ),
        ),
    );

    /**
     * Send data through the WebSocket
     */
    const sendMessage = (chunk: Uint8Array | string | Socket.CloseEvent) =>
      socket.writer.pipe(
        Effect.flatMap((write) => write(chunk)),
        Effect.tapError((e) => Effect.logError(`Failed to send message: ${e}`)),
      );

    return {
      // Access to the message queue for taking messages
      messages,

      // Write to the socket
      sendMessage,

      // Access to the raw socket for advanced usage
      socket,

      // Access to the fiber running the socket
      publishMessageFiber,
    };
  });
