import type { LucidEvolution, Provider } from "@lucid-evolution/lucid";
import { Lucid, Network } from "@lucid-evolution/lucid";

import { Context, Effect, Layer } from "effect";
import { NodeConfig, NodeConfigType, ProjectConfig } from "./ProjectConfig.js";
import { ProviderEffect } from "./Provider.js";
import { HydraNode } from "./HydraNode.js";
import { HydraWrapper } from "./lucid/HydraWrapper.js";

type HydraHeadType = {
  provider_lucid_L1: LucidEvolution;
  main_node: HydraNode;
  hydra_nodes: HydraNode[];
  node_lucid_L2: (nodeName: string) => HydraWrapper;
};

export class HydraHead extends Effect.Service<HydraHead>()("HydraHead", {
  effect: Effect.gen(function* () {
    const config = yield* ProjectConfig;
    const providerEffect = yield* ProviderEffect;

    const provider_lucid_L1: LucidEvolution = yield* Effect.tryPromise({
      try: () => Lucid(providerEffect.provider, config.projectConfig.network),
      catch: (e) =>
        new Error(`Failed to get LucidEvolution object for provider: ${e}`),
    });

    const nodeNames = config.projectConfig.nodes.map((node) => node.name);
    const nodeConfigs: NodeConfigType[] = nodeNames.map(
      (name) => yield* config.nodeConfigByName(name),
    );
    const nodeConfigLayers = nodeConfigs.map((conf) =>
      Layer.succeed(NodeConfig, {
        nodeConfig: Effect.succeed(conf),
      }),
    );

    const hydra_nodes = yield* Effect.forEach(nodeConfigLayers, (l) =>
      HydraNode.pipe(Effect.provide(l)),
    );

    const main_node = yield* Effect.gen(function* () {
      const mainNodeName = config.projectConfig.mainNodeName
      const mbMainMode = hydra_nodes.find((node) => (node.nodeName === mainNodeName))
      if (mbMainMode !== undefined) {
        const mainNode : HydraNode = mbMainMode
        return yield* Effect.succeed(mainNode);
      }
      return yield* Effect.fail(
        new Error(
          `Failed to find node with a name ${mainNodeName}`,
        ),
      );
    })

    const node_lucid_L2 = (nodeName: String) =>
        yield* Effect.gen(function* () {
        const mbNode = config.projectConfig.nodes.find(
          (node) => node.name === nodeName,
        );
        if (mbNode !== undefined) {
          const nodeConf: NodeConfigType = mbNode;
          const hydra = new HydraWrapper(
            nodeConf.url,
            config.projectConfig.network,
          );
          return yield* Effect.succeed(hydra);
        }
        return yield* Effect.fail(
          new Error(
            `Failed to find config for node with a name ${nodeName}`,
          ),
        );
      });

    const hydra_head: HydraHeadType = {
      provider_lucid_L1: provider_lucid_L1,
      main_node,
      hydra_nodes: hydra_nodes,
      node_lucid_L2,
    };
    return hydra_head;
  }),
}) {}
