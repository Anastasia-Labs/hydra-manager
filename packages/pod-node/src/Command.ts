import { Command } from "@effect/platform"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"

const command = Command.make("whoami")

const isActive = Command.make("systemctl is-active hydra-node")
const startHydraNode = Command.make("systemctl start hydra-node")
const stopHydraNode = Command.make("systemctl stop hydra-node")

const startCommandProgram = Effect.gen(function* () {
  yield* Effect.log("Called start command")
  const isNodeActive = yield* Command.string(isActive)
  yield* Effect.log(`hydra-node is ${isNodeActive}`)

  let res = ""
  if (isNodeActive === "inactive") {
    yield* Effect.log(`Starting the hydra-node`)
    res = yield* Command.string(startHydraNode)
  } else {
    yield* Effect.log(`hydra-node is already running`)
  }
  return res
})

const stopCommandProgram = Effect.gen(function* () {
  yield* Effect.log("Called stop command")
  const isNodeActive = yield* Command.string(isActive)
  yield* Effect.log(`hydra-node is ${isNodeActive}`)

  let res = ""
  if (isNodeActive === "active") {
    yield* Effect.log(`Stopping the hydra-node`)
    res = yield* Command.string(stopHydraNode)
  } else {
    yield* Effect.log(`hydra-node is already stopped`)
  }
  return res
})

export const startApiHandler =
  startCommandProgram.pipe(Effect.provide(NodeContext.layer),
  Effect.catchAll((error) => {
    return Effect.fail(new Error(JSON.stringify(error)))
  })
)

export const stopApiHandler =
  stopCommandProgram.pipe(Effect.provide(NodeContext.layer),
  Effect.catchAll((error) => {
    return Effect.fail(new Error(JSON.stringify(error)))
  })
)

