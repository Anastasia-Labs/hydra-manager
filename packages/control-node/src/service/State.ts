import { Effect, Schema } from "effect";

export const HeadStateSchema = Schema.Union(
  Schema.Literal("IDLE"),
  Schema.Literal("INITIALIZING"),
  Schema.Literal("RUNNING")
);
export type HeadState = typeof HeadStateSchema.Type;

export class State extends Effect.Service<State>()("State", {
  effect: Effect.gen(function* () {
    let headState: HeadState = "IDLE";

    return {
      headState: () => Effect.succeed(headState),
      setState: (state: HeadState) => {
        headState = state;
        return Effect.void;
      },
    };
  }),
}) {}
