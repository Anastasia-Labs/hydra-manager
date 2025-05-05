import { Socket } from "@effect/platform";
import {
  layerWebSocketConstructorGlobal,
  WebSocketConstructor,
} from "@effect/platform/Socket";
import { Effect, Layer, Option } from "effect";
import { processStatus } from "./handlers.js";
import { RuntimeFiber } from "effect/Fiber";
import { WebSocket } from "ws";

interface Node {
  connect: () => Effect.Effect<void, Error, WebSocketConstructor>;
  disconnect: () => Effect.Effect<void, Error, never>;
  getStatus: () => Effect.Effect<Status, never, never>;
}

const STATUS = {
  IDLE: "IDLE",
  DISCONNECTED: "DISCONNECTED",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  INITIALIZING: "INITIALIZING",
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  FANOUT_POSSIBLE: "FANOUT_POSSIBLE",
  FINAL: "FINAL",
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];

const makeNode = (url: string): Effect.Effect<Node, never, never> =>
  Effect.gen(function* () {
    let socket: Socket.Socket | null = null;
    let status: Status = "DISCONNECTED";
    let fiber: RuntimeFiber<void, Socket.SocketError> | null = null;
    let numEvent = 0;

    const handleOnMessage = (rawData: Uint8Array) =>
      Effect.gen(function* () {
        const data = Buffer.from(rawData).toString();
        yield* Effect.log(`Event N ${++numEvent}`);
        yield* Effect.sleep(10000 - 5000 * (2 - numEvent));

        yield* Effect.log(`End of Event N ${numEvent}`);
        Option.match(yield* processStatus(data), {
          onSome: (newStatus) => (status = newStatus),
          onNone: () => {},
        });
      });

    const connect = () =>
      Effect.gen(function* (_) {
        if (socket) {
          return yield* Effect.fail(new Error("Already connected"));
        }

        socket = yield* Socket.makeWebSocket(url);

        fiber = yield* Effect.fork(socket.run(handleOnMessage));

        return yield* Effect.void;
      });

    const disconnect = () =>
      Effect.gen(function* (_) {
        yield* Effect.gen(function* () {
          if (!socket) {
            return yield* Effect.fail(new Error("Not connected"));
          }

          const writer = yield* socket.writer;
          yield* writer(new Socket.CloseEvent(1000, "Normal closure"));
        }).pipe(Effect.scoped);
        yield* fiber!.await;
        return yield* Effect.void;
      });

    const getStatus = () => Effect.succeed(status);

    return {
      connect,
      disconnect,
      getStatus,
    };
  });

const program = Effect.gen(function* (_) {
  const socket = yield* makeNode("ws://localhost:4001");
  yield* socket
    .getStatus()
    .pipe(Effect.flatMap((status) => Effect.log(`Status: ${status}`)));
  yield* socket.connect();
  yield* Effect.sleep(1000000);
  yield* socket
    .getStatus()
    .pipe(Effect.flatMap((status) => Effect.log(`Status: ${status}`)));
  // yield* socket.disconnect();
});

const websocketConstructorLayer = Layer.sync(WebSocketConstructor, () => {
  return (url, protocol) =>
    new WebSocket(url, protocol) as unknown as globalThis.WebSocket;
});

const runnable = program.pipe(Effect.provide(websocketConstructorLayer));
Effect.runPromise(runnable);
