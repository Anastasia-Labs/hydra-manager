import { Socket } from "@effect/platform";
import { Effect, Queue } from "effect";

export const createWebSocketConnection = (url: string) =>
  Effect.gen(function* () {
    yield* Effect.log(`Connecting to WebSocket at: ${url}`);

    // Create the WebSocket
    const socket = yield* Socket.makeWebSocket(url);

    // Create an unbounded queue for messages
    const messages = yield* Queue.unbounded<Uint8Array>();
    yield* Effect.log("Message queue created");

    // Start a fiber that continuously processes incoming messages into the queue
    yield* Effect.log("Starting WebSocket message handler fiber");
    const fiber = yield* Effect.fork(
      socket
        .run((data) => {
          return Effect.gen(function* () {
            yield* Effect.log(
              `WebSocket message received in handler: ${data}, type ${typeof data}`,
            );

            // Ensure we're handling binary data correctly - data should already be Uint8Array
            // but we need to ensure we don't accidentally convert it to string
            const binaryData =
              data instanceof Uint8Array
                ? data
                : typeof data === "string"
                  ? new TextEncoder().encode(data)
                  : new Uint8Array(data);

            return yield* messages.offer(binaryData);
          });
        })
        .pipe(
          Effect.tap(() =>
            Effect.log("WebSocket message received and queued"),
          ),
        ),
    );
    yield* Effect.log("WebSocket handler fiber started");

    /**
     * Send data through the WebSocket
     * @param data Data to send (string, ArrayBuffer, or ArrayBufferView)
     */
    const sendMessage = (data: string | ArrayBuffer | ArrayBufferView) =>
      socket.writer.pipe(
        Effect.flatMap((write) =>
          write(
            typeof data === "string"
              ? new TextEncoder().encode(data)
              : new Uint8Array(
                  data instanceof ArrayBuffer ? data : data.buffer,
                ),
          ),
        ),
        Effect.catchAll((error) =>
          Effect.logError(`Failed to send message: ${error}`).pipe(
            Effect.flatMap(() => Effect.fail(error)),
          ),
        ),
      );

    return {
      // Access to the message queue for taking messages
      messages,

      // Write to the socket
      sendMessage,

      // Access to the raw socket for advanced usage
      socket,

      // Access to the fiber running the socket
      fiber,
    };
  });
