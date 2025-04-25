#!/usr/bin/env node

import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import { runCommands } from "./Cli.js"
import { HydraHeadService, HydraHead } from "./hydra/head.js"
import { Context } from "effect"
import { getCardanoProvider } from "./utils.js"
import config from "./cli/config.js"

const provider = getCardanoProvider()
const hydraHead = new HydraHead(provider, config.nodes)

const hydraContext = Context.make(
  HydraHeadService, {
    get: hydraHead
  })

runCommands(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  Effect.provide(hydraContext),
  NodeRuntime.runMain({ disableErrorReporting: false })
)
