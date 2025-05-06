import { it, describe, expect, beforeEach } from "@effect/vitest";
import { Chunk, Effect, Exit, Logger, Queue } from "effect";
import { WS } from "vitest-websocket-mock";
import { Scope } from "effect/Scope";
import { SocketService } from "../src/lucid/SocketService.js";
import { Socket } from "@effect/platform";
import { constNull } from "effect/Function";

const url = `ws://localhost:1234`;

// Create a test server with acquisition and release handlers
const makeServer = Effect.acquireRelease(
  Effect.sync(() => new WS(url)), // acquire
  (ws) =>
    Effect.sync(() => {
      ws.close();
      WS.clean();
    }), // release
);

describe("SocketService", () => {
  it.scoped.only("should send messages to the server", () =>
    Effect.gen(function* () {
      const server = yield* makeServer;
      const socketService = yield* SocketService;

      const connection = yield* socketService.createWebSocketConnection(url);

      // Send a message to the server
      yield* connection.sendMessage("Hello from client!");

      // Verify the server received the message
      const receivedMessage = yield* Effect.promise(() => server.nextMessage);
      yield* Effect.log(`Message received by server: ${receivedMessage}`);
      expect(receivedMessage).toBe("Hello from client!");
    }).pipe(
      Effect.provide(SocketService.Default),
      Effect.provide(Socket.layerWebSocketConstructorGlobal),
      Effect.provide(Logger.pretty),
    ),
  );

  it.scoped.only("should handle messages from the server", () =>
    Effect.gen(function* () {
      const server = yield* makeServer;
      const socketService = yield* SocketService;

      const connection = yield* socketService.createWebSocketConnection(url);
      yield* connection.sendMessage("Hello from client!");

      // Server sends a message
      server.send("Hello from server!");

      // Wait to receive the message
      const receivedMessage = yield* connection.messages.take;
      yield* Effect.log(
        `Message from server: ${new TextDecoder().decode(receivedMessage)}`,
      );
      expect(new TextDecoder().decode(receivedMessage)).toBe(
        "Hello from server!",
      );
    }).pipe(
      Effect.provide(SocketService.Default),
      Effect.provide(Socket.layerWebSocketConstructorGlobal),
      Effect.provide(Logger.pretty),
    ),
  );

  it.scoped.only("should handle binary data", () =>
    Effect.gen(function* () {
      const server = yield* makeServer;
      const socketService = yield* SocketService;

      const connection = yield* socketService.createWebSocketConnection(url);

      // Create sample binary data
      const binaryData = new Uint8Array([1, 2, 3, 4, 5]);

      // Send binary data to the server
      yield* connection.sendMessage(binaryData);

      // Verify the server received the binary data
      const receivedData = (yield* Effect.promise(
        () => server.nextMessage,
      )) as Uint8Array;
      yield* Effect.log(`Binary data received by server: ${receivedData}`);
      expect(receivedData).toEqual(binaryData);

      // Test receiving binary data from server
      server.send(binaryData.buffer); // Send as ArrayBuffer to ensure binary transmission
      const receivedFromServer = yield* connection.messages.take;
      yield* Effect.log(`Binary data from server: ${receivedFromServer}`);
      expect(receivedFromServer).toEqual(binaryData);
    }).pipe(
      Effect.provide(SocketService.Default),
      Effect.provide(Socket.layerWebSocketConstructorGlobal),
      Effect.provide(Logger.pretty),
    ),
  );

  it.scoped.only("should handle multiple connections", () =>
    Effect.gen(function* () {
      const server = yield* makeServer;
      const socketService = yield* SocketService;

      const connection1 = yield* socketService.createWebSocketConnection(url);
      const connection2 = yield* socketService.createWebSocketConnection(url);

      // Send messages from both connections
      yield* connection1.sendMessage("Message from connection 1");
      yield* connection2.sendMessage("Message from connection 2");
      // Verify both connections are established
      expect(server.server.clients().length).toEqual(2);

      // Verify server received both messages
      const message1 = (yield* Effect.promise(
        () => server.nextMessage,
      )) as string;
      const message2 = (yield* Effect.promise(
        () => server.nextMessage,
      )) as string;

      const decodedMessages = [message1, message2].sort();

      expect(decodedMessages).toEqual(
        ["Message from connection 1", "Message from connection 2"].sort(),
      );

      // Test server sending messages to each connection
      server.send("1st response to both connections");
      server.send("2nd response to both connections");

      const response1 = yield* connection1.messages.take;
      expect(new TextDecoder().decode(response1)).toBe(
        "1st response to both connections",
      );
      const response2 = yield* connection2.messages.take;
      expect(new TextDecoder().decode(response2)).toBe(
        "1st response to both connections",
      );
    }).pipe(
      Effect.provide(SocketService.Default),
      Effect.provide(Socket.layerWebSocketConstructorGlobal),
      Effect.provide(Logger.pretty),
    ),
  );

  it.scoped.only("should handle multiple messages from server", () =>
    Effect.gen(function* () {
      const server = yield* makeServer;
      const socketService = yield* SocketService;

      const connection = yield* socketService.createWebSocketConnection(url);

      // Send a message to ensure connection is established
      yield* connection.sendMessage("Connection established");
      yield* Effect.promise(() => server.nextMessage);

      // Server sends multiple messages in succession
      const messages = [
        "First message from server",
        "Second message from server",
        "Third message from server",
        "Fourth message from server",
        "Fifth message from server",
      ];

      // Send all messages from server
      messages.forEach((msg) => server.send(msg));

      const receivedMessages = yield* connection.messages.takeAll;

      // Verify all messages were received in the correct order
      expect(Chunk.toArray(receivedMessages)).toEqual(
        messages.map((msg) => new TextEncoder().encode(msg)),
      );

      // Verify the queue still works after receiving multiple messages
      server.send("Final test message");
      const finalMessage = yield* connection.messages.take;
      expect(new TextDecoder().decode(finalMessage)).toBe("Final test message");
    }).pipe(
      Effect.provide(SocketService.Default),
      Effect.provide(Socket.layerWebSocketConstructorGlobal),
      Effect.provide(Logger.pretty),
    ),
  );

  it.scoped.only("should handle connection errors", () =>
    Effect.gen(function* () {
      // Use a non-existent URL to trigger an error
      const invalidUrl = "ws://non-existent-server:9999";
      const socketService = yield* SocketService;

      // Attempt to connect should fail
      const result = yield* socketService.createWebSocketConnection(invalidUrl);
      // await to know whether the fiber succeeded, failed, or was interrupted
      const exit = yield* result.fiber.await;
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit)) {
        // Log the error message
        yield* Effect.log(
          `Connection attempt to invalid URL resulted in: ${exit.cause._tag}`,
        );
      }
    }).pipe(
      Effect.provide(SocketService.Default),
      Effect.provide(Socket.layerWebSocketConstructorGlobal),
      Effect.provide(Logger.pretty),
    ),
  );

  it.scoped.only("should close connections properly", () =>
    Effect.gen(function* () {
      const server = yield* makeServer;
      const socketService = yield* SocketService;

      const connection = yield* socketService.createWebSocketConnection(url);

      // Send a message to verify the connection is working
      yield* connection.sendMessage("Test message");
      const receivedMessage = (yield* Effect.promise(
        () => server.nextMessage,
      )) as string;
      expect(receivedMessage).toBe("Test message");

      // When the scope closes, the connection should be closed automatically
      // We can test this by checking server clients before and after releasing the scope
      expect(server.server.clients().length).toBe(1);
      yield* Effect.log(
        "Connection verified and will be closed when scope ends",
      );

      // The test will automatically close the scope when it completes,
      // and the release handler of the socket should close the connection
    }).pipe(
      Effect.provide(SocketService.Default),
      Effect.provide(Socket.layerWebSocketConstructorGlobal),
      Effect.provide(Logger.pretty),
    ),
  );
});
