import { it, describe } from "@effect/vitest";
import { Effect, Logger } from "effect";
import { WS } from "vitest-websocket-mock";
import { SocketClient } from "../src/lucid/SocketClient.js";
import { Scope } from "effect/Scope";

const url = `ws://localhost:1234`;

const makeServer: Effect.Effect<WS, never, Scope> = Effect.acquireRelease(
  Effect.sync(() => new WS(url)), // acquire
  // release
  (ws) =>
    Effect.sync(() => {
      ws.close();
      WS.clean();
    }),
);

describe("Socket", () => {
  it.scoped.only("mock effect server", () =>
    Effect.gen(function* () {
      const server = yield* makeServer;
      const socket1 = yield* SocketClient;
      const connection1 = yield* socket1.connectToWebSocket(url);
      const socket2 = yield* SocketClient;
      const connection2 = yield* socket2.connectToWebSocket(url);
      console.log(
        "message size from connection 1: ",
        yield* connection1.messageQueue.size,
      );
      console.log(
        "message size from connection 2: ",
        yield* connection2.messageQueue.size,
      );
      server.send("Hello from the server!");
      console.log(
        "connection 1 message from server: ",
        yield* connection1.messageQueue.take,
      );
      console.log(
        "connection 2 message from server: ",
        yield* connection2.messageQueue.take,
      );

      yield* connection1.sendMessage(
        new TextEncoder().encode("Hello from client 1!"),
      );
      yield* connection2.sendMessage(
        new TextEncoder().encode("Hello from client 2!"),
      );
      console.log(
        "Server received message from client 1: ",
        yield* Effect.promise(() => server.nextMessage),
      );
      console.log(
        "Server received message from client 2: ",
        yield* Effect.promise(() => server.nextMessage),
      );
      console.log("Server connections: ", server.server.clients().length);
    }).pipe(
      Effect.provide(SocketClient.Default),
      Effect.provide(Logger.pretty), // Providing a pretty logger for log output
    ),
  );
});
