import type { LucidEvolution, Provider } from "@lucid-evolution/lucid"
import { Lucid, Network } from "@lucid-evolution/lucid"
import { EventEmitter } from "node:events"

import { Context, Effect } from "effect"
import { NodeConfigType, NodeNameConfig, ProjectConfig } from "./ProjectConfig.js";
import { ProviderEffect } from "./Provider.js";
import { HydraNode } from "./HydraNode.js";

type HydraHeadType = {
    provider_lucid_L1: LucidEvolution;
};

export class HydraHead extends Effect.Service<HydraHead>()(
    "HydraHead",
    {
        effect: Effect.gen(function* () {
                const config = yield* ProjectConfig
                const providerEffect = yield* ProviderEffect

                const provider_lucid_L1 : LucidEvolution = yield* Effect.tryPromise({
                    try: () => Lucid(providerEffect.provider, config.projectConfig.network),
                    catch: (e) => new Error(`Failed to get LucidEvolution object for provider: ${e}`)
                })

                const nodeNames = config.projectConfig.nodes.map((node) => node.name)
                const nodeConfigs : NodeConfigType[] = nodeNames.map((name) => yield* config.nodeConfigByName(name))
                const hydra_nodes = yield* Effect.forEach(
                    nodeConfigs,
                    (config) => HydraNode.pipe(Effect.provide(config))
                  );

                const res : HydraHeadType = { provider_lucid_L1: provider_lucid_L1 }
                return res
            })
    },
) {}
