#!/usr/bin/env node

import * as NodeContext from "@effect/platform-node/NodeContext";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Effect from "effect/Effect";
import { runCommands } from "./Cli.js";
import { Layer } from "effect";
import { HydraHead } from "./HydraHead.js";
import { ProviderEffect } from "./Provider.js";
import * as ProjectConfig from "./ProjectConfig.js";

const HydraHeadTestLayer = Layer.provide(
  HydraHead.Default,
  Layer.provideMerge(
    ProviderEffect.Default,
    ProjectConfig.ProjectConfigTestLayer,
  ),
);
const AppLayerTest = Layer.merge(HydraHeadTestLayer, NodeContext.layer);

// pnpx tsx packages/cli/src/bin.ts init
runCommands(process.argv).pipe(
  Effect.provide(AppLayerTest),
  Effect.scoped,
  NodeRuntime.runMain(),
);
