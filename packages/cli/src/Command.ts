import { HydraHead } from "./HydraHead.js"

import { Command, Options } from "@effect/cli"
import { Effect, Option, Schedule, pipe } from "effect"

export const initCommand = Command.make("init", {}).pipe(
  Command.withHandler(() => initHeadCommand)
)

export const initHeadCommand = Effect.gen(function* () {
    const hydraHead = yield* HydraHead
    yield* hydraHead.main_node.initialize
  })
