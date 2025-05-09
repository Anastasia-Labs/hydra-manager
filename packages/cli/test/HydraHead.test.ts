import { expect, it } from "@effect/vitest";
import * as HydraHead from "../src/HydraHead.js";
import * as HydraNode from "../src/HydraNode.js";
import { Effect, Layer } from "effect";
import * as Provider from "../src/Provider.js";
import * as ProjectConfig from "../src/ProjectConfig.js";
import * as NodeConfig from "../src/NodeConfig.js";
import WS from "vitest-websocket-mock";
import { Scope } from "effect/Scope";
import { sleep } from "effect/Clock";

const url = `ws://localhost:4001`;

const makeServer: Effect.Effect<WS, never, Scope> = Effect.acquireRelease(
  Effect.sync(() => new WS(url)), // acquire
  // release
  (ws) =>
    Effect.sync(() => {
      ws.close();
      WS.clean();
    }),
);

const HydraHeadTestLayer = Layer.provide(
  HydraHead.HydraHead.Default,
  Layer.provideMerge(
    Provider.ProviderEffect.Default,
    ProjectConfig.ProjectConfigTestLayer,
  ),
);

const NodeConfigTestLayer = Layer.succeed(NodeConfig.NodeConfigService, {
  nodeConfig: {
    name: "testNode",
    url: "ws://localhost:4001",
    fundsWalletSK: {
      type: "SecretKey",
      cborHex: "1234567890abcdef",
    },
    nodeWalletSK: {
      type: "SecretKey",
      cborHex: "1234567890abcdef",
    },
    hydraSK: {
      type: "SecretKey",
      cborHex: "1234567890abcdef",
    },
  },
});

const HydraNodeTestLayer = Layer.provide(
  HydraNode.HydraNode.Default,
  NodeConfigTestLayer,
);

it.scopedLive(
  "submits a init command from a hydra node successfully confirm initialization from the server",
  () =>
    Effect.gen(function* () {
      const server = yield* makeServer;
      const hydraNode = yield* HydraNode.HydraNode;
      const fiber = yield* Effect.fork(hydraNode.initialize);
      expect(yield* Effect.promise(() => server.nextMessage)).toEqual(
        JSON.stringify({
          tag: "Init",
        }),
      );
      server.send(
        JSON.stringify({
          tag: "HeadIsInitializing",
        }),
      );
      const result = yield* fiber.await;
      expect(result._tag).toEqual("Success");
    }).pipe(Effect.provide(HydraNodeTestLayer)),
);

it.scopedLive(
  "timeouts a hydra node initialization when no message is received",
  () =>
    Effect.gen(function* () {
      const server = yield* makeServer;
      const hydraNode = yield* HydraNode.HydraNode;
      const fiber = yield* Effect.fork(hydraNode.initialize);
      expect(yield* Effect.promise(() => server.nextMessage)).toEqual(
        JSON.stringify({
          tag: "Init",
        }),
      );
      yield* sleep(1000);
      server.send(
        JSON.stringify({
          tag: "HeadIsInitializing",
        }),
      );
      const result = yield* fiber.await;
      expect(result._tag).toEqual("Failure");
    }).pipe(Effect.provide(HydraNodeTestLayer)),
);

it.scopedLive("submits a initializes command from a hydra head ", () =>
  Effect.gen(function* () {
    const server = yield* makeServer;
    const hydraHead = yield* HydraHead.HydraHead;
    const fiber = yield* Effect.fork(hydraHead.mainNode.initialize);
    expect(yield* Effect.promise(() => server.nextMessage)).toEqual(
      JSON.stringify({
        tag: "Init",
      }),
    );
    server.send(
      JSON.stringify({
        tag: "HeadIsInitializing",
      }),
    );
    const result = yield* fiber.await;
    expect(result._tag).toEqual("Success");
  }).pipe(Effect.provide(HydraHeadTestLayer)),
);
