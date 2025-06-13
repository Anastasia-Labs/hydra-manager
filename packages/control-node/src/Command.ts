import { Command, HttpClientRequest, HttpClientResponse } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { HttpClient } from "@effect/platform";
import { Input } from "@effect/platform/Headers";

const podNodeUrls = ["http://localhost:3001"];

const startAllCommandProgram = (headers: Input) => Effect.gen(function* () {
  yield* Effect.log("Called start command");
  const httpClient = yield* HttpClient.HttpClient;
  const httpClientOk = httpClient.pipe(
    HttpClient.mapRequest(HttpClientRequest.updateUrl((url) => url + "/start")),
    HttpClient.mapRequest(HttpClientRequest.setHeaders(headers)),
    HttpClient.filterStatusOk,
  );

  const responses : Array<HttpClientResponse.HttpClientResponse> =
    yield* Effect.forEach(podNodeUrls, (url) =>
      httpClientOk.get(url),
    );
  yield* Effect.logDebug(`Responses from pods: ${JSON.stringify(responses)}`);

  return "Started All Node Pods";
});

export const startAllApiHandler = (headers: Input) => startAllCommandProgram(headers).pipe(
  Effect.provide(NodeContext.layer),
  Effect.catchAll((error) => {
    return Effect.fail(`Failed with error: ${JSON.stringify(error)}`);
  }),
);

const stopAllCommandProgram = (headers: Input) => Effect.gen(function* () {
  yield* Effect.log("Called stop command");

  const httpClient = yield* HttpClient.HttpClient;
  const httpClientOk = httpClient.pipe(
    HttpClient.mapRequest(HttpClientRequest.updateUrl((url) => url + "/stop")),
    HttpClient.mapRequest(HttpClientRequest.setHeaders(headers)),
    HttpClient.filterStatusOk,
  );

  const responses : Array<HttpClientResponse.HttpClientResponse> =
    yield* Effect.forEach(podNodeUrls, (url) =>
      httpClientOk.get(url),
    );
  yield* Effect.logDebug(`Responses from pods: ${JSON.stringify(responses)}`);

  return "Stopped All Node Pods";
});

export const stopAllApiHandler = (headers: Input) => stopAllCommandProgram(headers).pipe(
  Effect.provide(NodeContext.layer),
  Effect.catchAll((error) => {
    return Effect.fail(`Failed with error: ${JSON.stringify(error)}`);
  }),
);
