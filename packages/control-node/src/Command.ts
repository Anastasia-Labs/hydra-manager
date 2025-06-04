import { Command } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  Socket,
} from "@effect/platform";

const podNodeUrls = ["http://localhost:3001"];

const startCommandProgram = Effect.gen(function* () {
  yield* Effect.log("Called start command");
  const httpClient = yield* HttpClient.HttpClient;

  const responses = yield* httpClient.get(`http://localhost:3001/start`);


});

export const startApiHandler = startCommandProgram.pipe(
  Effect.provide(NodeContext.layer),
  Effect.catchAll((error) => {
    return Effect.fail(`Failed with error: ${JSON.stringify(error)}`);
  }),
);
