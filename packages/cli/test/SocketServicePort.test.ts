import { it, describe, expect, beforeEach } from "@effect/vitest";
import { Chunk, Effect, Exit, Logger, Queue, PubSub, Layer } from "effect";
import { WS } from "vitest-websocket-mock";
import { Scope } from "effect/Scope";
import { SocketService } from "../src/lucid/SocketService.js";
import { Socket } from "@effect/platform";
import * as SocketClient from "../src/Socket.js";
import { Dequeue } from "effect/Queue";
import { WebSocketConstructor } from "@effect/platform/Socket";
import { WebSocket } from "ws";

const url = `ws://localhost:4001`;

describe("SocketService", () => {
  it.scoped.only("should send messages to the server", () =>
    Effect.gen(function* () {
      const connection = yield* SocketClient.createWebSocketConnection(url);
      yield* connection.sendMessage("Hello from client!");
      const sub: Dequeue<Uint8Array> = yield* PubSub.subscribe(
        connection.messages,
      );
      const res = yield* sub.take;
      console.log(JSON.stringify(res));
    }).pipe(
      Effect.provide(SocketService.Default),
      Effect.provide(
        Layer.succeed(WebSocketConstructor, (url, options) => {
          return new WebSocket(url, options) as unknown as globalThis.WebSocket;
        }),
      ),
      Effect.provide(Logger.pretty),
    ),
  );
});
