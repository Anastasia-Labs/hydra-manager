import { Effect, Queue } from "effect";

export class SocketClient extends Effect.Service<SocketClient>()(
  "SocketClient",
  {
    effect: Effect.gen(function* () {
      const connectToWebSocket = (url: string) =>
        Effect.gen(function* () {
          const ws = yield* createAndConnectSocket(url);
          const messageQueue = yield* Queue.unbounded<Uint8Array>();

          ws.onmessage = (event) => {
            console.log("WebSocket message received:", event.data);
            const data = new TextEncoder().encode(event.data);
            Effect.runFork(messageQueue.offer(data)); // new thread
          };

          // Send function with connection state check using standard Error
          const sendMessage = (
            message: string | ArrayBuffer | Blob | ArrayBufferView,
          ) =>
            Effect.gen(function* () {
              // Check if the socket is open before attempting to send
              if (ws.readyState !== WebSocket.OPEN) {
                return yield* Effect.fail(
                  new Error(
                    "Cannot send message: WebSocket is not in OPEN state",
                  ),
                );
              }

              return yield* Effect.try({
                try: () => {
                  console.log(
                    "Sending message via WebSocket:",
                    typeof message === "string" ? message : "(binary data)",
                  );
                  ws.send(message);
                  return true;
                },
                catch: (error) =>
                  new Error(`Failed to send WebSocket message: ${error}`),
              });
            });

          return {
            messageQueue,
            sendMessage,
            socket: ws,
            isConnected: () => Effect.succeed(ws.readyState === WebSocket.OPEN),
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
    // Acquire: Create and connect the WebSocket
    Effect.async<WebSocket, Error>((resume) => {
      // console.log(`Attempting to connect to WebSocket at ${url}...`);
      Effect.runSync(
        Effect.log(`Attempting to connect to WebSocket at ${url}...`),
      );
      const socket = new WebSocket(url);

      // Log the current readyState immediately
      console.log(`Initial WebSocket readyState: ${socket.readyState}`);
      // 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED

      const cleanup = () => {
        socket.onopen = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.onmessage = null;
      };

      socket.onopen = () => {
        console.log(
          `WebSocket connection opened! readyState: ${socket.readyState}`,
        );
        cleanup();
        resume(Effect.succeed(socket));
      };

      socket.onerror = (err) => {
        console.error(`WebSocket error occurred: ${JSON.stringify(err)}`);
        cleanup();
        resume(Effect.fail(new Error(`WebSocket error: ${err}`)));
      };

      // Add a timeout to detect if the connection is taking too long
      const connectionTimeout = setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          console.log(
            `WebSocket connection timed out. Current readyState: ${socket.readyState}`,
          );
          cleanup();
          resume(Effect.fail(new Error("WebSocket connection timed out")));
        }
      }, 5000); // 5 second timeout

      // Check if already open (rare but possible)
      if (socket.readyState === WebSocket.OPEN) {
        console.log("WebSocket connection already open!");
        clearTimeout(connectionTimeout);
        cleanup();
        resume(Effect.succeed(socket));
      }
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
