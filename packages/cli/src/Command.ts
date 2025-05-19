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

const nodeNameOption = Options.text("node-name").pipe(
  Options.withDescription("Name of the node you wish to interact with")
)

export const utxosCommand = Command.make("utxos", {nodeNameOption}).pipe(
  Command.withHandler((options) => balanceHead(options.nodeNameOption))
)

export const utxosHead = (nodeName: string) => Effect.gen(function* () {
  const hydraHead = yield* HydraHead;
  yield* hydraHead.logUTxOs(nodeName);
});

export const utxosAllCommand = Command.make("utxos-all", {}).pipe(
  Command.withHandler(() => utxosAllHead),
);

export const utxosAllHead = Effect.gen(function* () {
  const hydraHead = yield* HydraHead;
  yield* hydraHead.logAllUTxOs;
});


export const balanceCommand = Command.make("balance", {nodeNameOption}).pipe(
  Command.withHandler((options) => balanceHead(options.nodeNameOption))
)

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

