import { Effect, Queue, Runtime } from "effect";

export class SocketClient extends Effect.Service<SocketClient>()(
  "SocketClient",
  {
    scoped: Effect.gen(function* () {
      const connectToWebSocket = (url: string) =>
        Effect.gen(function* () {
          const socket = yield* createAndConnectSocket(url);
          const messageQueue = yield* Queue.unbounded<Uint8Array>();

          const runtime = yield* Effect.runtime();
          const runtimeFork = Runtime.runFork(runtime);

          socket.onmessage = (event) => {
            const data = new TextEncoder().encode(event.data);
            runtimeFork(
              messageQueue
                .offer(data)
                .pipe(
                  Effect.tap(() =>
                    Effect.log(
                      `WebSocket message received and queued: ${event.data}`,
                    ),
                  ),
                ),
            ); // Send the data to the queue
          };

          // Send function with connection state check using standard Error
          const sendMessage = (
            message: string | ArrayBuffer | Blob | ArrayBufferView,
          ) =>
            Effect.gen(function* () {
              // Check if the socket is open before attempting to send
              if (socket.readyState !== WebSocket.OPEN) {
                return yield* Effect.fail(
                  new Error(
                    "Cannot send message: WebSocket is not in OPEN state",
                  ),
                );
              }

              return yield* Effect.try({
                try: () => {
                  socket.send(message);
                  return true;
                },
                catch: (error) =>
                  new Error(`Failed to send WebSocket message: ${error}`),
              }).pipe(
                Effect.tap(() =>
                  Effect.log(
                    `WebSocket message sent: ${typeof message === "string" ? message : "(binary data)"}`,
                  ),
                ),
              );
            });

          return {
            messageQueue,
            sendMessage,
            socket,
            isConnected: () =>
              Effect.succeed(socket.readyState === WebSocket.OPEN),
          };
        });

      return {
        connectToWebSocket,
      };
    }),
  },
) {}

const createAndConnectSocket = (url: string) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      yield* Effect.log(`Attempting to connect to WebSocket at ${url}...`);
      const socket = new WebSocket(url);
      const cleanup = () => {
        socket.onopen = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.onmessage = null;
      };
      // Log the current readyState immediately
      yield* Effect.log(`Initial WebSocket readyState: ${socket.readyState}`); // 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
      const socketConnection = Effect.async<WebSocket, Error>((resume) => {
        socket.onopen = () => {
          resume(
            Effect.succeed(socket).pipe(
              Effect.tap(() =>
                Effect.log(
                  `WebSocket connection opened! readyState: ${socket.readyState}`,
                ),
              ),
            ),
          );
        };

        socket.onerror = (err) => {
          cleanup();
          resume(Effect.fail(new Error(`WebSocket error: ${url}`)));
        };

        // Check if already open (rare but possible)
        if (socket.readyState === WebSocket.OPEN) {
          resume(
            Effect.succeed(socket).pipe(
              Effect.tap(() =>
                Effect.log(
                  `WebSocket connection already open! readyState: ${socket.readyState}`,
                ),
              ),
            ),
          );
        }
      });
      const socketConnectionWithTimeout = yield* socketConnection.pipe(
        Effect.timeoutFail({
          duration: 500,
          onTimeout: () => new Error("WebSocket connection timed out"),
        }),
      );
      return socketConnectionWithTimeout;
    }),
    // Release: Clean up the WebSocket
    (socket) =>
      Effect.sync(() => {
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close();
        }
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
      }).pipe(
        Effect.tap(() =>
          Effect.log(
            `Closing WebSocket. Current readyState: ${socket.readyState}`,
          ),
        ), // Log when the WebSocket is closed
      ),
  );
