import { Command, Options } from "@effect/cli"
import { Effect, Option, Schedule, pipe } from "effect"
import { HydraHead, HydraHeadService } from "../../hydra/head.js"
import {
  initHeadAction,
} from "../interactive/actions/index.js"

export const initCommand = Command.make("init", {}).pipe(
  Command.withHandler(runAction)
)

function runAction() : Effect.Effect<void, Error, HydraHeadService> {
  return Effect.gen(function* () {
    const hydraHeadService = yield* HydraHeadService
    const hydraHead = hydraHeadService.get

    const policy = Schedule.fixed("1000 millis")
    yield* Effect.retry(checkStatus(hydraHead), policy)
    yield* Effect.tryPromise({ try : () => initHeadAction.value(hydraHead),
                               catch: (e) => new Error(`Failed to init head with error: ${e}`)
    })
    hydraHead.mainNode.disconnect()
  })}

const checkStatus = (
  hydraHead: HydraHead,
): Effect.Effect<void, Error, never> => Effect.gen(function* () {
        if (hydraHead.status == "IDLE") {
          console.log(`Success with the status ${hydraHead.status}`)
          return yield* Effect.void
        } else {
          console.log(`Failed with the status ${hydraHead.status}`)
          return yield* Effect.fail(new Error(`Impossible to run Init with state: ${hydraHead.status}`))
        }
})
