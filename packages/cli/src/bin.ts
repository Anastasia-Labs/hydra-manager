#!/usr/bin/env node

import * as NodeContext from "@effect/platform-node/NodeContext";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Effect from "effect/Effect";
import { runCommands } from "./Cli.js";
import { Layer } from "effect";
import { HydraHead } from "./HydraHead.js";
import { ProviderContext } from "./Provider.js";
import * as ProjectConfig from "./ProjectConfig.js";

const HydraHeadLayer = Layer.provide(
  HydraHead.Default,
  Layer.provideMerge(
    ProviderContext.Default,
    ProjectConfig.ProjectConfigFSLayer,
  ),
);
const AppLayer = Layer.merge(HydraHeadLayer, NodeContext.layer);

runCommands(process.argv).pipe(
  Effect.provide(AppLayer),
  Effect.scoped,
  NodeRuntime.runMain(),
);
