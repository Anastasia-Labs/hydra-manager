import { Command, HttpClientRequest } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { HttpClient } from "@effect/platform";

const podNodeUrls = ["http://localhost:3001"];

const startAllCommandProgram = Effect.gen(function* () {
  yield* Effect.log("Called start command");

  const httpClient = yield* HttpClient.HttpClient;
  const httpClientOk = httpClient.pipe(
    HttpClient.mapRequest(HttpClientRequest.updateUrl((url) => url + "/start")),
    HttpClient.filterStatusOk,
  );

  const responses = yield* Effect.forEach(podNodeUrls, (url) =>
    httpClientOk.get(url),
  );
  yield* Effect.logDebug(`Responses from pods: ${JSON.stringify(responses)}`);

  return "Started All Node Pods";
});

export const startAllApiHandler = startAllCommandProgram.pipe(
  Effect.provide(NodeContext.layer),
  Effect.catchAll((error) => {
    return Effect.fail(`Failed with error: ${JSON.stringify(error)}`);
  }),
);

const stopAllCommandProgram = Effect.gen(function* () {
  yield* Effect.log("Called stop command");

  const httpClient = yield* HttpClient.HttpClient;
  const httpClientOk = httpClient.pipe(
    HttpClient.mapRequest(HttpClientRequest.updateUrl((url) => url + "/stop")),
    HttpClient.filterStatusOk,
  );

  const responses = yield* Effect.forEach(podNodeUrls, (url) =>
    httpClientOk.get(url),
  );
  yield* Effect.logDebug(`Responses from pods: ${JSON.stringify(responses)}`);

  return "Stopped All Node Pods";
});

export const stopAllApiHandler = stopAllCommandProgram.pipe(
  Effect.provide(NodeContext.layer),
  Effect.catchAll((error) => {
    return Effect.fail(`Failed with error: ${JSON.stringify(error)}`);
  }),
);
