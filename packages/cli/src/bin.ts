#!/usr/bin/env node

import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import { runCommands } from "./Cli.js"
import { Context, Layer } from "effect"
import { HydraHead } from "./HydraHead.js"
import { ProviderEffect } from "./Provider.js"
import { ProjectConfig } from "./ProjectConfig.js"


const subLayer = Layer.provide(
    ProviderEffect.DefaultWithoutDependencies,
    ProjectConfig.Default.pipe(Layer.provide(NodeContext.layer))
);

const hydraHeadLayer = Layer.provide(
    HydraHead.Default.pipe(
      Layer.provide(ProviderEffect.DefaultWithoutDependencies)
    )
);


// runCommands(process.argv).pipe(
//   Effect.provide(hydraHeadLayer),
//   NodeRuntime.runMain({ disableErrorReporting: false })
// )
