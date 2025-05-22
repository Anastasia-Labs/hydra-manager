import { HydraHead } from "./HydraHead.js";

import { Command, Options } from "@effect/cli";
import { Effect, Option, Schedule, pipe, Schema } from "effect";
import { UTxO } from "@lucid-evolution/lucid";

export const statusCommand = Command.make("status", {}).pipe(
  Command.withHandler(() => statusHead),
);

export const statusHead = Effect.gen(function* () {
  const hydraHead = yield* HydraHead;
  yield* hydraHead.logNodesStatuses;
});

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

const faucetName = Options.text("faucet-name").pipe(
  Options.withDescription("Name of the faucet wallet you wish to interact with"),
);

const nodeNameOptional = Options.text("node-name-opt").pipe(
  Options.withDescription("Name of the node you wish to interact with"),
  Options.optional
);

const faucetNameOptional = Options.text("faucet-name-opt").pipe(
  Options.withDescription("Name of the faucet wallet you wish to interact with"),
  Options.optional
);

const utxos = Options.text("utxos").pipe(
  Options.withDescription("Array of UTxOs you wish to interact with"),
);

export const nodeSnapshotUtxosCommand = Command.make("node-snapshot-utxos", { nodeName }).pipe(
  Command.withHandler((options) => nodeSnapshotUtxosHead(options.nodeName)),
);

export const nodeSnapshotUtxosHead = (nodeName: string) =>
  Effect.gen(function* () {
    const hydraHead = yield* HydraHead;
    yield* Effect.log(`Called nodeSnapshotUtxosHead`)
    yield* hydraHead.logNodeSnapshotUTxOs(nodeName)
  });

export const nodeUtxosCommand = Command.make("node-utxos", { nodeNameOptional }).pipe(
  Command.withHandler((options) => nodeUtxosHead(options.nodeNameOptional)),
);

export const nodeUtxosHead = (nodeNameOpt: Option.Option<string>) =>
  Effect.gen(function* () {
    const hydraHead = yield* HydraHead;
    yield* Option.match(nodeNameOpt, {
      onNone: () => hydraHead.logAllNodesUTxOs,
      onSome: (nodeName) => hydraHead.logNodeUTxOs(nodeName),
    });
  });

export const nodeBalanceCommand = Command.make("node-balance", {
  nodeNameOptional,
}).pipe(
  Command.withHandler((options) => {
    return nodeBalancesHead(options.nodeNameOptional);
  }),
);

export const nodeBalancesHead = (nodeNameOpt: Option.Option<string>) =>
  Effect.gen(function* () {
    const hydraHead = yield* HydraHead;
    yield* Option.match(nodeNameOpt, {
      onNone: () => hydraHead.logAllNodesBalances,
      onSome: (nodeName) => hydraHead.logNodeBalance(nodeName),
    });
  });

export const faucetWalletUtxosCommand = Command.make("faucet-wallet-utxos", { faucetNameOptional }).pipe(
  Command.withHandler((options) => faucetWalletUtxosHead(options.faucetNameOptional)),
);

export const faucetWalletUtxosHead = (faucetNameOpt: Option.Option<string>) =>
  Effect.gen(function* () {
    const hydraHead = yield* HydraHead;
    yield* Option.match(faucetNameOpt, {
      onNone: () => hydraHead.logAllFaucetWalletsUTxOs,
      onSome: (faucetWalletName) => hydraHead.logFaucetWalletUTxOs(faucetWalletName),
    });
  });

export const faucetWalletBalanceCommand = Command.make("faucet-wallet-balance", {
  faucetNameOptional,
}).pipe(
  Command.withHandler((options) => {
    return faucetWalletBalancesHead(options.faucetNameOptional);
  }),
);

export const faucetWalletBalancesHead = (faucetNameOpt: Option.Option<string>) =>
  Effect.gen(function* () {
    const hydraHead = yield* HydraHead;
    yield* Option.match(faucetNameOpt, {
      onNone: () => hydraHead.logAllFaucetWalletsBalances,
      onSome: (faucetName) => hydraHead.logFaucetWalletBalance(faucetName),
    });
  });

export const commitCommand = Command.make("commit", {
  nodeName,
  utxos,
  faucetName,
}).pipe(
  Command.withHandler((options) => {
    return commitHead(
      options.nodeName,
      options.utxos,
      options.faucetName,
    );
  }),
);

export const commitHead = (
  nodeName: string,
  utxosString: string,
  faucetWalletName: string,
) =>
  Effect.gen(function* () {
    const hydraHead = yield* HydraHead;
    const utxos: Array<UTxO> = JSON.parse(utxosString);
    yield* Effect.log(`utxos type is: ${typeof utxos}`);
    yield* hydraHead.commit(nodeName, utxos, faucetWalletName);
  });
