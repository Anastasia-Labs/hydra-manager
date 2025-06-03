import { Command } from "@effect/platform"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"

const command = Command.make("whoami")

export const commandProgram = Effect.gen(function* () {
  yield* Effect.log("Called start command")
  return yield* Command.string(command)
})

export const startApiHandler =
  commandProgram.pipe(Effect.provide(NodeContext.layer),
  Effect.catchAll((error) => {
    return Effect.fail(new Error(JSON.stringify(error)))
  })
)

