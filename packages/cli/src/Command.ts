import { HydraHead } from "./HydraHead.js";

import { Args, Command, Options } from "@effect/cli";
import { Effect, Option, Schedule, pipe } from "effect";

export const initCommand = Command.make("init", {}).pipe(
  Command.withHandler(() => initHead),
);

export const initHead = Effect.gen(function* () {
  const hydraHead = yield* HydraHead;
  yield* hydraHead.mainNode.initialize;
});

export const closeCommand = Command.make("close", {}).pipe(
  Command.withHandler(() => closeHead),
);

export const closeHead = Effect.gen(function* () {
  const hydraHead = yield* HydraHead;
  yield* hydraHead.mainNode.close;
});

export const fanoutCommand = Command.make("fanout", {}).pipe(
  Command.withHandler(() => fanoutHead),
);

export const fanoutHead = Effect.gen(function* () {
  const hydraHead = yield* HydraHead;
  yield* hydraHead.mainNode.fanout;
});

const nodeNameArgs = Args.text({name: "nodeName"})

export const balanceCommand = Command.make("balance", { nodeNameArgs }).pipe(
  Command.withHandler((args) => balanceHead(args.nodeNameArgs)),
);

export const balanceHead = (nodeName: string) => Effect.gen(function* () {
  const hydraHead = yield* HydraHead;
  yield* hydraHead.logBalance(nodeName);
});

export const balancesCommand = Command.make("balances", {}).pipe(
  Command.withHandler(() => balancesHead),
);

export const balancesHead = Effect.gen(function* () {
  const hydraHead = yield* HydraHead;
  yield* hydraHead.logBalances;
});

