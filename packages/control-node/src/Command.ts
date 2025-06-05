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

const startAllCommandProgram = Effect.gen(function* () {
  yield* Effect.log("Called start command");
  yield* Effect.log("Hi");

  const httpClient = yield* HttpClient.HttpClient;
  const httpClientOk = httpClient.pipe(
      HttpClient.filterStatusOk,
  )

  yield* Effect.log("Hi2");


  yield* Effect.log("Called 3001");
  const res = httpClient.get("http://localhost:3001")
  yield* Effect.log(`Got: ${JSON.stringify(res)}`);


  const responses = yield* Effect.forEach(podNodeUrls, (url) => httpClient.get(url))
  Effect.log(`Responses: ${JSON.stringify(responses)}`)
  return "Hello"
});

export const startAllApiHandler = startAllCommandProgram.pipe(
  Effect.provide(NodeContext.layer),
  Effect.catchAll((error) => {
    return Effect.fail(`Failed with error: ${JSON.stringify(error)}`);
  }),
);
