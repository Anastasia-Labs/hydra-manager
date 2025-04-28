import { Effect, Layer } from "effect";
import * as ProviderEffect from "./Provider.js";
import * as ProjectConfig from "./ProjectConfig.js";
import { NodeRuntime } from "@effect/platform-node";

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

const runnable = program.pipe(Effect.provide(testLayer));
NodeRuntime.runMain(runnable);
