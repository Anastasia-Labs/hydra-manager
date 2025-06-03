import { Command } from "@effect/platform"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"

const command = Command.make("ls", "-al")

export const program = Effect.gen(function* () {
  const output = yield* Command.string(command)
  return output
})

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)))
