import { HydraHead } from "./HydraHead.js";

import { Command, Options } from "@effect/cli";
import { Effect, Option, Schedule, pipe } from "effect";

export const initCommand = Command.make("init", {}).pipe(
  Command.withHandler(() => initHeadCommand),
);

export const initHeadCommand = Effect.gen(function* () {
  const hydraHead = yield* HydraHead;
  yield* hydraHead.mainNode.initialize;
});

export const closeCommand = Command.make("close", {}).pipe(
  Command.withHandler(() => closeHeadCommand),
);

export const closeHeadCommand = Effect.gen(function* () {
  const hydraHead = yield* HydraHead;
  yield* hydraHead.mainNode.close;
});

export const fanoutCommand = Command.make("fanout", {}).pipe(
  Command.withHandler(() => fanoutHeadCommand),
);

export const fanoutHeadCommand = Effect.gen(function* () {
  const hydraHead = yield* HydraHead;
  yield* hydraHead.mainNode.fanout;
});
