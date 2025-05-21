import { HydraHead } from "./HydraHead.js";

import { Args, Command, Options } from "@effect/cli";
import { Effect, Option, Schedule, pipe, Schema } from "effect";
import * as HydraMessage from "./HydraMessage.js";
import { UTxO } from "@lucid-evolution/lucid";

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

const nodeName = Options.text("node-name").pipe(
  Options.withDescription("Name of the node you wish to interact with"),
);

const nodeNameOptional = Options.text("node-name-opt")
  .pipe(
    Options.withDescription(
      "Name of the node you wish to interact with, optional",
    ),
  )
  .pipe(Options.optional);

const utxos = Options.text("utxos").pipe(
  Options.withDescription("Array of UTxOs you wish to interact with"),
);

export const utxosCommand = Command.make("utxos", { nodeNameOptional }).pipe(
  Command.withHandler((options) => utxosHead(options.nodeNameOptional)),
);

export const utxosHead = (nodeNameOpt: Option.Option<string>) =>
  Effect.gen(function* () {
    const hydraHead = yield* HydraHead;
    yield* Option.match(nodeNameOpt, {
      onNone: () => hydraHead.logAllUTxOs,
      onSome: (nodeNameOpt) => hydraHead.logUTxOs(nodeNameOpt),
    });
  });

export const balanceCommand = Command.make("balance", {
  nodeNameOptional,
}).pipe(
  Command.withHandler((options) => {
    return balancesHead(options.nodeNameOptional);
  }),
);

export const balancesHead = (nodeNameOpt: Option.Option<string>) =>
  Effect.gen(function* () {
    const hydraHead = yield* HydraHead;
    yield* Option.match(nodeNameOpt, {
      onNone: () => hydraHead.logBalances,
      onSome: (nodeNameOpt) => hydraHead.logBalance(nodeNameOpt),
    });
  });

export const commitCommand = Command.make("commit", {
  nodeName,
  utxos,
  nodeNameOptional,
}).pipe(
  Command.withHandler((options) => {
    return commitHead(
      options.nodeName,
      options.utxos,
      options.nodeNameOptional,
    );
  }),
);

export const commitHead = (
  nodeName: string,
  utxosString: string,
  committerName: Option.Option<string>,
) =>
  Effect.gen(function* () {
    const hydraHead = yield* HydraHead;
    const utxos: Array<UTxO> = JSON.parse(utxosString);
    yield* Effect.log(`utxos type is: ${typeof utxos}`);
    yield* hydraHead.commit(nodeName, utxos, committerName);
  });
