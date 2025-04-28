import { Config, Effect, Layer } from "effect";
import * as Option from "effect/Option";

export class ProjectConfig extends Effect.Service<ProjectConfig>()(
  "ProjectConfig",
  {
    effect: Effect.gen(function* () {
      const network = yield* Config.string("NETWORK");
      const blockfrostProjectId = yield* Config.string(
        "BLOCKFROST_PROJECT_ID",
      ).pipe(Config.option);
      return {
        network,
        blockfrostProjectId,
      } as const;
    }),
  },
) {}

// Simulate a project config for testing purposes
export const testLayer = Layer.succeed(
  ProjectConfig,
  ProjectConfig.make({
    network: "preprod",
    blockfrostProjectId: Option.none(),
  }),
);
