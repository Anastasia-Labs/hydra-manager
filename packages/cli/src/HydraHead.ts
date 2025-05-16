import type { LucidEvolution, Provider, UTxO } from "@lucid-evolution/lucid";
import { Lucid, Network } from "@lucid-evolution/lucid";
import { Context, Effect, Layer, Schedule } from "effect";
import * as ProjectConfig from "./ProjectConfig.js";
import { ProviderEffect } from "./Provider.js";
import { HydraNode } from "./HydraNode.js";
import { HydraWrapper } from "./lucid/HydraWrapper.js";
import * as NodeConfig from "./NodeConfig.js";

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

    const nodeNames : Array<string> = config.projectConfig.nodes.map((node) => node.name);
    const nodeConfigs = yield* Effect.forEach(nodeNames, (name) =>
      config.getNodeConfigByName(name),
    );

    const nodeConfigLayers = nodeConfigs.map((conf) =>
      Layer.succeed(NodeConfig.NodeConfigService, {
        nodeConfig: conf,
      }),
    );

    const hydraNodes = yield* Effect.forEach(nodeConfigLayers, (nodeConfig) => {
      const hydraLayer = Layer.provide(HydraNode.Default, nodeConfig);
      const hydraNode = HydraNode.pipe(Effect.provide(hydraLayer));
      return hydraNode;
    });

    const mainNode = hydraNodes.find(
      (node) => node.nodeName === config.projectConfig.mainNodeName,
    );
    if (mainNode === undefined) {
      return yield* Effect.fail(
        new Error(
          `Failed to find node with a name ${config.projectConfig.mainNodeName}`,
        ),
      );
    }

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

      const getNodeFundsUTxOs = (nodeName: string) : Effect.Effect<Array<UTxO>, Error> => {
        return Effect.gen(function* () {
          const nodeConfig = yield* config.getNodeConfigByName(nodeName)
          const address = yield* NodeConfig.skToAddress(nodeConfig.fundsWalletSK)
          return yield* Effect.tryPromise({
            try: () => providerLucidL1.utxosAt(address),
            catch: (e) =>  new Error(`Failed to get UTxOs at ${address}: ${e}`),
          })
        })
      }

      const logBalances = () : Effect.Effect<void, Error> => {
        return Effect.gen(function* () {
          nodeNames.forEach((name) => {
            Effect.gen(function* () {
              const utxos = yield* getNodeFundsUTxOs(name)

            })
          })
        })

      }

    return {
      providerLucidL1,
      mainNode,
      hydraNodes,
      nodesL2,
    };
  }),
}) {}
