import type { LucidEvolution, Provider, UTxO } from "@lucid-evolution/lucid";
import { CML, Lucid, Network } from "@lucid-evolution/lucid";
import { Console, Context, Effect, Layer, Schedule } from "effect";
import * as ProjectConfig from "./ProjectConfig.js";
import { ProviderContext } from "./Provider.js";
import { HydraNode } from "./HydraNode.js";
import { HydraWrapper } from "./lucid/HydraWrapper.js";
import * as NodeConfig from "./NodeConfig.js";
import { Option } from "effect";
import * as HydraMessage from "./HydraMessage.js";

export class HydraHead extends Effect.Service<HydraHead>()("HydraHead", {
  effect: Effect.gen(function* () {
    yield* Effect.log("HydraHead was created");

    const config = yield* ProjectConfig.ProjectConfigService;
    const providerContext = yield* ProviderContext;

    const providerLucidRetryPolicy = Schedule.addDelay(
      Schedule.recurs(10),
      () => "100 millis",
    );
    const providerLucidL1: LucidEvolution = yield* Effect.retry(
      Effect.tryPromise({
        try: () => Lucid(providerContext.provider, config.projectConfig.network),
        catch: (e) => new Error(`Failed to get LucidEvolution object: ${e}`),
      }),
      providerLucidRetryPolicy,
    );

    const faucetWalletNames: Array<string> = config.projectConfig.faucetWallets.map(
      (faucetWallet) => faucetWallet.name,
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

    const hydraNodes: Array<HydraNode> = yield* Effect.forEach(
      nodeConfigLayers,
      (nodeConfig) => {
        const hydraLayer = Layer.provide(HydraNode.Default, nodeConfig);
        const hydraNode = HydraNode.pipe(Effect.provide(hydraLayer));
        return hydraNode;
      },
    );

    const findHydraNode = (nodeName: string) =>
      Effect.gen(function* () {
        const node: HydraNode | undefined = hydraNodes.find(
          (node) => node.nodeName === nodeName,
        );
        if (node !== undefined) {
          return node;
        } else {
          return yield* Effect.fail(
            new Error(`Failed to find node with a name ${nodeName}`),
          );
        }
      });

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

    const getFaucetWalletUTxOs = (
      faucetWalletName: string,
    ): Effect.Effect<Array<UTxO>, Error> => {
      return Effect.gen(function* () {
        const faucetWallet = yield* config.getFaucetWalletByName(faucetWalletName);
        const address = yield* NodeConfig.skToAddress(faucetWallet.sk);
        return yield* Effect.tryPromise({
          try: () => providerLucidL1.utxosAt(address),
          catch: (e) => new Error(`Failed to get UTxOs at ${address}: ${e}`),
        });
      });
    };

    const logNodeUTxOs = (nodeName: string) =>
      Effect.gen(function* () {
        const nodeUTxOs: Array<UTxO> = yield* getNodeUTxOs(nodeName);

        const nodeConfig = yield* config.getNodeConfigByName(nodeName);
        const nodeAddress = yield* NodeConfig.skToAddress(
          nodeConfig.nodeWalletSK,
        );

        yield* Effect.log(`${nodeName} UTxOs at ${nodeAddress} address:`);
        yield* Effect.log(HydraMessage.utxosToString(nodeUTxOs));
      });

    const logAllNodesUTxOs = Effect.forEach(nodeNames, (nodeName) =>
      logNodeUTxOs(nodeName),
    );

    const logNodeBalance = (nodeName: string) =>
      Effect.gen(function* () {
        const nodeUTxOs: Array<UTxO> = yield* getNodeUTxOs(nodeName);
        const nodeBalance: bigint =
          nodeUTxOs.reduce(
            (acc, utxo) => acc + utxo.assets["lovelace"].valueOf(),
            0n,
          ) / 1000000n;

        const nodeConfig = yield* config.getNodeConfigByName(nodeName);
        const nodeAddress = yield* NodeConfig.skToAddress(
          nodeConfig.nodeWalletSK,
        );

        yield* Effect.log(
          `${nodeName} balance at ${nodeAddress} is ${nodeBalance}`,
        );
      });

    const logAllNodesBalances = Effect.forEach(nodeNames, (nodeName) =>
      logNodeBalance(nodeName),
    );

    const logFaucetWalletUTxOs = (faucetWalletName: string) =>
      Effect.gen(function* () {
        const faucetWalletUTxOs: Array<UTxO> = yield* getFaucetWalletUTxOs(faucetWalletName);

        const faucetWallet = yield* config.getFaucetWalletByName(faucetWalletName);
        const faucetWalletAddress = yield* NodeConfig.skToAddress(
          faucetWallet.sk,
        );

        yield* Effect.log(`${faucetWalletName} UTxOs at ${faucetWalletAddress} address:`);
        yield* Effect.log(HydraMessage.utxosToString(faucetWalletUTxOs));
      });

    const logAllFaucetWalletsUTxOs = Effect.forEach(faucetWalletNames, (faucetWalletName) =>
      logFaucetWalletUTxOs(faucetWalletName),
    );

    const logFaucetWalletBalance = (faucetWalletName: string) =>
      Effect.gen(function* () {
        const faucetWalletUTxOs: Array<UTxO> = yield* getFaucetWalletUTxOs(faucetWalletName);
        const  faucetWalletBalance: bigint =
          faucetWalletUTxOs.reduce(
            (acc, utxo) => acc + utxo.assets["lovelace"].valueOf(),
            0n,
          ) / 1000000n;

        const faucetWallet = yield* config.getFaucetWalletByName(faucetWalletName);
        const faucetWalletAddress = yield* NodeConfig.skToAddress(
          faucetWallet.sk,
        );
        yield* Effect.log(
          `${faucetWalletName} balance at ${faucetWalletAddress} is ${faucetWalletBalance}`,
        );
      });

    const logAllFaucetWalletsBalances = Effect.forEach(faucetWalletNames, (faucetWalletName) =>
      logFaucetWalletBalance(faucetWalletName),
    );

    const witnessTransaction = (
      unwitnessedTransaction: HydraMessage.DraftCommitTxResponseType,
      commiterSK: NodeConfig.SK,
    ) =>
      Effect.gen(function* () {
        yield* Effect.log(`Witnessing transaction`);
        const unsignedTx = CML.Transaction.from_cbor_hex(
          unwitnessedTransaction.cborHex,
        );
        const witnessSet = unsignedTx.witness_set();
        const privateKey = NodeConfig.cborHexToPrivateKey(
          commiterSK.cborHex,
        );
        providerLucidL1.selectWallet.fromPrivateKey(privateKey);

        const signedSet = yield* Effect.tryPromise({
          try: () => providerLucidL1.wallet().signTx(unsignedTx),
          catch: (e) => new Error(`Failed to sign transaction object: ${e}`),
        });
        witnessSet.add_all_witnesses(signedSet);

        const signedTx = CML.Transaction.new(
          unsignedTx.body(),
          witnessSet,
          true,
          unsignedTx.auxiliary_data(),
        );

        const witnessedTransaction = {
          ...unwitnessedTransaction,
          cborHex: signedTx.to_cbor_hex(),
        };

        return yield* Effect.succeed(witnessedTransaction);
      });

    const getUnwitnessedTransaction = (
      nodeName: string,
      utxos: Array<UTxO>,
      commiterName: Option.Option<string>,
    ) => Effect.gen(function* () {
      // TODO
    });

    const signAndCommitTransaction = (
      nodeName: string,
      utxos: Array<UTxO>,
      commiterName: Option.Option<string>,
    ) => Effect.gen(function* () {
      // TODO
    });

    const commit = (
      nodeName: string,
      utxos: Array<UTxO>,
      faucetWalletName: string,
    ) =>
      Effect.gen(function* () {
        yield* Effect.log(
          `Called commit action for ${nodeName}, faucetWalletName is ${faucetWalletName}`,
        );
        yield* Effect.log(`Provided utxos are:`);
        yield* Effect.log(`${HydraMessage.utxosToString(utxos)}`);

        const node = yield* findHydraNode(nodeName);
        const unwitnessedTransaction = yield* node.commitHTTPHandle(utxos);
        const faucetWallet = yield* config.getFaucetWalletByName(faucetWalletName)
        const witnessedTransaction = yield* witnessTransaction(
          unwitnessedTransaction,
          faucetWallet.sk,
        );
        yield* node.cardanoTransactionHTTPHandle(witnessedTransaction);
      });

    return {
      providerLucidL1,
      mainNode,
      hydraNodes,
      nodesL2,
      commit,
      logNodeUTxOs,
      logAllNodesUTxOs,
      logNodeBalance,
      logAllNodesBalances,
      logFaucetWalletUTxOs,
      logAllFaucetWalletsUTxOs,
      logFaucetWalletBalance,
      logAllFaucetWalletsBalances,
    };
  }),
}) {
  logAllUTxOs: any;
}


