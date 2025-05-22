import { Effect, Layer } from "effect";
import { ProviderContext } from "./Provider.js";
import * as ProjectConfig from "./ProjectConfig.js";
import { NodeContext, NodeRuntime } from "@effect/platform-node";

const program = Effect.gen(function* () {
  const provider = yield* ProviderContext;
  const protocol = yield* provider.getProtocolParameters();
  yield* Effect.log(`coinsPerUtxoByte: ${protocol.coinsPerUtxoByte}`);
});

// Simulate a project config for testing purposes
const testLayer = Layer.provide(
  ProviderContext.Default,
  ProjectConfig.ProjectConfigTestLayer,
);

const mainLayer = Layer.provide(
  ProviderContext.Default,
  ProjectConfig.ProjectConfigFSLayer,
);

const runnable = program.pipe(Effect.provide(mainLayer));
NodeRuntime.runMain(runnable);
