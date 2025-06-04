import { Command } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";

const isActive = Command.make("systemctl", "is-active", "hydra-node");
const startHydraNode = Command.make("systemctl", "start", "hydra-node");
const stopHydraNode = Command.make("systemctl", "stop", "hydra-node");

const startCommandProgram = Effect.gen(function* () {
  yield* Effect.log("Called start command");
  const isNodeActive = yield* Command.string(isActive);

  yield* Effect.log(`hydra-node is ${isNodeActive}`);
  if (isNodeActive === "active") {
    yield* Effect.fail(`hydra-node is already running`);
  }

  yield* Effect.log(`Starting the hydra-node`);
  return yield* Command.string(startHydraNode);
});

const stopCommandProgram = Effect.gen(function* () {
  yield* Effect.log("Called stop command");
  const isNodeActive = yield* Command.string(isActive);

  yield* Effect.log(`hydra-node is ${isNodeActive}`);
  if (isNodeActive === "inactive") {
    yield* Effect.fail(`hydra-node is already stopped`);
  }

  yield* Effect.log(`Stoping the hydra-node`);
  return yield* Command.string(stopHydraNode);
});

export const startApiHandler = startCommandProgram.pipe(
  Effect.provide(NodeContext.layer),
  Effect.catchAll((error) => {
    return Effect.fail(`Failed with error: ${JSON.stringify(error)}`);
  }),
);

export const stopApiHandler = stopCommandProgram.pipe(
  Effect.provide(NodeContext.layer),
  Effect.catchAll((error) => {
    return Effect.fail(`Failed with error: ${JSON.stringify(error)}`);
  }),
);
