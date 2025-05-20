import { Effect, Schema } from "effect";
import * as StateService from "./State.js";

export class HeadCreationError extends Schema.TaggedError<HeadCreationError>()(
  "HeadCreationError",
  {
    message: Schema.String,
  }
) {}

export const handle = () =>
  Effect.gen(function* () {
    // Check if the head is running, if a head is running,
    // throw an error. If not, create a new head.
    const state = yield* StateService.State;

    const headState = yield* state.headState();

    if (headState !== "IDLE") {
      yield* new HeadCreationError({
        message: `A head is already running, currently in state: ${headState}`,
      });
    }

    state.setState("INITIALIZING");

    return "Head created";
  });
