import { Effect, Layer } from "effect";
import * as ProviderEffect from "./Provider.js";
import * as ProjectConfig from "./ProjectConfig.js";
import { NodeContext, NodeRuntime } from "@effect/platform-node";

const program = Effect.gen(function* () {
  const provider = yield* ProviderEffect.ProviderEffect;
  const protocol = yield* provider.getProtocolParameters();
  yield* Effect.log(`coinsPerUtxoByte: ${protocol.coinsPerUtxoByte}`);
});

// Simulate a project config for testing purposes
const testLayer = Layer.provide(
  ProviderEffect.ProviderEffect.DefaultWithoutDependencies,
  ProjectConfig.testLayer,
);

const mainLayer = Layer.provide(
  ProviderEffect.ProviderEffect.DefaultWithoutDependencies,
  ProjectConfig.ProjectConfig.Default.pipe(Layer.provide(
    NodeContext.layer
  ))
);

const runnable = program.pipe(Effect.provide(mainLayer));
NodeRuntime.runMain(runnable);
