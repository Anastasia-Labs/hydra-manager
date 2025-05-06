import type { LucidEvolution, Provider } from "@lucid-evolution/lucid"
import { Lucid, Network } from "@lucid-evolution/lucid"
import { EventEmitter } from "node:events"

import { Context, Effect } from "effect"
import { ProjectConfig } from "./ProjectConfig.js";
import { ProviderEffect } from "./Provider.js";

type HydraHeadType = {
    provider_lucid_L1: LucidEvolution;
};

export class HHead extends Effect.Service<HHead>()(
    "HHead",
    {
        effect: Effect.gen(function* () {
                const config = yield* ProjectConfig
                const providerEffect = yield* ProviderEffect
                const provider_lucid_L1 : LucidEvolution = yield* Effect.tryPromise({
                    try: () => Lucid(providerEffect.provider, config.projectConfig.network),
                    catch: (e) => new Error(`Failed to get LucidEvolution object for provider: ${e}`)
                })

                return { provider_lucid_L1: provider_lucid_L1 }
            })
    },
) {}
