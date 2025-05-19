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

const nodeNameOption = Options.text("node-name")
  .pipe(Options.withDescription("Name of the node you wish to interact with"))
  .pipe(Options.optional);

export const utxosCommand = Command.make("utxos", { nodeNameOption }).pipe(
  Command.withHandler((options) => utxosHead(options.nodeNameOption)),
);

export const utxosHead = (nodeName: Option.Option<string>) =>
  Effect.gen(function* () {
    const hydraHead = yield* HydraHead;
    yield* Option.match(nodeName, {
      onNone: () => hydraHead.logAllUTxOs,
      onSome: (nodeName) => hydraHead.logUTxOs(nodeName),
    });
  });

export const balanceCommand = Command.make("balance", { nodeNameOption }).pipe(
  Command.withHandler((options) => {
    return balancesHead(options.nodeNameOption);
  }),
);

export const balancesHead = (nodeName: Option.Option<string>) =>
  Effect.gen(function* () {
    const hydraHead = yield* HydraHead;
    yield* Option.match(nodeName, {
      onNone: () => hydraHead.logBalances,
      onSome: (nodeName) => hydraHead.logBalance(nodeName),
    });
  });
