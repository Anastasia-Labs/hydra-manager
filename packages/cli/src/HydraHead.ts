import type { LucidEvolution, Provider, UTxO } from "@lucid-evolution/lucid";
import { CML, Lucid, Network } from "@lucid-evolution/lucid";
import { Context, Effect, Layer, Schedule } from "effect";
import * as ProjectConfig from "./ProjectConfig.js";
import { ProviderEffect } from "./Provider.js";
import { HydraNode } from "./HydraNode.js";
import { HydraWrapper } from "./lucid/HydraWrapper.js";
import * as NodeConfig from "./NodeConfig.js";
import { Option } from "effect";

export class HydraHead extends Effect.Service<HydraHead>()("HydraHead", {
  effect: Effect.gen(function* () {
    yield* Effect.log("HydraHead was created");

    const config = yield* ProjectConfig.ProjectConfigService;
    const providerEffect = yield* ProviderEffect;

    const providerLucidRetryPolicy = Schedule.addDelay(
      Schedule.recurs(10),
      () => "100 millis",
    );
    const providerLucidL1: LucidEvolution = yield* Effect.retry(
      Effect.tryPromise({
        try: () => Lucid(providerEffect.provider, config.projectConfig.network),
        catch: (e) => new Error(`Failed to get LucidEvolution object: ${e}`),
      }),
      providerLucidRetryPolicy,
    );

    const nodeNames: Array<string> = config.projectConfig.nodes.map(
      (node) => node.name,
    );
    const nodeConfigs = yield* Effect.forEach(nodeNames, (name) =>
      config.getNodeConfigByName(name),
    );

    const nodeConfigLayers = nodeConfigs.map((conf) =>
      Layer.succeed(NodeConfig.NodeConfigService, {
        nodeConfig: conf,
      }),
    );

    const hydraNodes : Array<HydraNode> = yield* Effect.forEach(nodeConfigLayers, (nodeConfig) => {
      const hydraLayer = Layer.provide(HydraNode.Default, nodeConfig);
      const hydraNode = HydraNode.pipe(Effect.provide(hydraLayer));
      return hydraNode;
    });

    const findHydraNode = (nodeName: string) =>
      Effect.gen(function* () {
        const node : (HydraNode | undefined) = hydraNodes.find(
          (node) => node.nodeName === nodeName,
        );
        if (node !== undefined) {
          return node
        } else {
          return yield* Effect.fail(
            new Error(
              `Failed to find node with a name ${nodeName}`,
            ),
          );
        }
      })

    const mainNode = yield* findHydraNode(config.projectConfig.mainNodeName);

    const nodesL2 = (nodeName: String) =>
      Effect.gen(function* () {
        const mbNode = config.projectConfig.nodes.find(
          (node) => node.name === nodeName,
        );
        if (mbNode !== undefined) {
          const nodeConf: NodeConfig.NodeConfig = mbNode;
          const hydra = new HydraWrapper(
            nodeConf.url,
            config.projectConfig.network,
          );
          return yield* Effect.succeed(hydra);
        }
        return yield* Effect.fail(
          new Error(`Failed to find config for node with a name ${nodeName}`),
        );
      });

    const getFundsUTxOs = (
      nodeName: string,
    ): Effect.Effect<Array<UTxO>, Error> => {
      return Effect.gen(function* () {
        const nodeConfig = yield* config.getNodeConfigByName(nodeName);
        const address = yield* NodeConfig.skToAddress(nodeConfig.fundsWalletSK);
        return yield* Effect.tryPromise({
          try: () => providerLucidL1.utxosAt(address),
          catch: (e) => new Error(`Failed to get UTxOs at ${address}: ${e}`),
        });
      });
    };

    const getNodeUTxOs = (
      nodeName: string,
    ): Effect.Effect<Array<UTxO>, Error> => {
      return Effect.gen(function* () {
        const nodeConfig = yield* config.getNodeConfigByName(nodeName);
        const address = yield* NodeConfig.skToAddress(nodeConfig.nodeWalletSK);
        return yield* Effect.tryPromise({
          try: () => providerLucidL1.utxosAt(address),
          catch: (e) => new Error(`Failed to get UTxOs at ${address}: ${e}`),
        });
      });
    };

    const logUTxOs = (nodeName: string) =>
      Effect.gen(function* () {
        const fundsUTxOs: Array<UTxO> = yield* getFundsUTxOs(nodeName);
        const nodeUTxOs: Array<UTxO> = yield* getNodeUTxOs(nodeName);

        const nodeConfig = yield* config.getNodeConfigByName(nodeName);
        const fundsAddress = yield* NodeConfig.skToAddress(
          nodeConfig.fundsWalletSK,
        );
        const nodeAddress = yield* NodeConfig.skToAddress(
          nodeConfig.nodeWalletSK,
        );

        yield* Effect.log(`${nodeName} UTxOs:`);
        yield* Effect.log(`  - funds address ${fundsAddress} UTxOs are:`);
        const strFundsUTxOs = JSON.stringify(fundsUTxOs, (_, v) =>
          typeof v === "bigint" ? v.toString() : v,
        );
        yield* Effect.log(strFundsUTxOs);

        yield* Effect.log(`  - node address ${nodeAddress} UTxOs are:`);

        const strNodeUTxOs = JSON.stringify(nodeUTxOs, (_, v) =>
          typeof v === "bigint" ? v.toString() : v,
        );
        yield* Effect.log(strNodeUTxOs);
      });

    const logAllUTxOs = Effect.forEach(nodeNames, (nodeName) =>
      logUTxOs(nodeName),
    );

    const logBalance = (nodeName: string) =>
      Effect.gen(function* () {
        const fundsUTxOs: Array<UTxO> = yield* getFundsUTxOs(nodeName);
        const nodeUTxOs: Array<UTxO> = yield* getNodeUTxOs(nodeName);

        const fundsBalance: bigint =
          fundsUTxOs.reduce(
            (acc, utxo) => acc + utxo.assets["lovelace"].valueOf(),
            0n,
          ) / 1000000n;
        const nodeBalance: bigint =
          nodeUTxOs.reduce(
            (acc, utxo) => acc + utxo.assets["lovelace"].valueOf(),
            0n,
          ) / 1000000n;

        const nodeConfig = yield* config.getNodeConfigByName(nodeName);
        const fundsAddress = yield* NodeConfig.skToAddress(
          nodeConfig.fundsWalletSK,
        );
        const nodeAddress = yield* NodeConfig.skToAddress(
          nodeConfig.nodeWalletSK,
        );

        yield* Effect.log(`${nodeName} balances:`);
        yield* Effect.log(
          `  - funds address ${fundsAddress} balance is ${fundsBalance}`,
        );
        yield* Effect.log(
          `  - node address ${nodeAddress} balance is ${nodeBalance}`,
        );
      });

    const logBalances = Effect.forEach(nodeNames, (nodeName) =>
      logBalance(nodeName),
    );

    const commit = (nodeName: string, utxos: Array<UTxO>, commiterName: Option.Option<string>) =>
      Effect.gen(function* () {
        const node = yield* findHydraNode(nodeName)
        const unwitnessedTransaction = yield* node.commitHTTPHandle(utxos)

        const unsignedTx = CML.Transaction.from_cbor_hex(unwitnessedTransaction.cborHex)
        const witnessSet = unsignedTx.witness_set()
        const signedSet = yield* Effect.tryPromise({
          try: () => providerLucidL1.wallet().signTx(unsignedTx),
          catch: (e) => new Error(`Failed to sign transaxction object: ${e}`),
        })

        witnessSet.add_all_witnesses(signedSet)

        const signedTx = CML.Transaction.new(
          unsignedTx.body(),
          witnessSet,
          true,
          unsignedTx.auxiliary_data()
        )

        yield* node.cardanoTransactionHTTPHandle(signedTx)
      })

    return {
      providerLucidL1,
      mainNode,
      hydraNodes,
      nodesL2,
      logUTxOs,
      logAllUTxOs,
      logBalance,
      logBalances,
    };
  }),
}) {}
