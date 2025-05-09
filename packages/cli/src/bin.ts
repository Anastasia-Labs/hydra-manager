#!/usr/bin/env node

import * as NodeContext from "@effect/platform-node/NodeContext";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Effect from "effect/Effect";
import { runCommands } from "./Cli.js";
import { Console, Context, Layer } from "effect";
import { HydraHead } from "./HydraHead.js";
import { ProviderEffect } from "./Provider.js";
import { ProjectConfig } from "./ProjectConfig.js";

runCommands(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  Effect.provide(HydraHead.Default),
  Effect.scoped,
  NodeRuntime.runMain()
)
