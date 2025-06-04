import { Command } from "@effect/cli";
import {
  FileSystem,
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiSwagger,
  HttpServer,
} from "@effect/platform";
import { NodeContext, NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, Schema, pipe } from "effect";
import * as HTTPS from "node:https";
import * as HTTP from "node:http";
import { startApiHandler, stopApiHandler } from "./Command.js";

const managementGroup = HttpApiGroup.make("Management")
  .add(
    HttpApiEndpoint.get("start", "/start")
      .addSuccess(Schema.String, { status: 200 })
      .addError(Schema.String, { status: 400 }),
  )
  .add(
    HttpApiEndpoint.get("stop", "/stop")
      .addSuccess(Schema.String, { status: 200 })
      .addError(Schema.String, { status: 400 }),
  );

const Api = HttpApi.make("hydra-manager-pod-node").add(managementGroup);

const ManagementGroupLive = HttpApiBuilder.group(
  Api,
  "Management",
  (handlers) =>
    Effect.gen(function* () {
      return handlers
        .handle("start", () => startApiHandler)
        .handle("stop", () => stopApiHandler);
    }),
);
// Set up the application server with logging

// Specify the port
const port = 3000;

const getFiles = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;

  return {
    key: yield* fs.readFileString("certificates/private-key.pem"),
    cert: yield* fs.readFileString("certificates/certificate.pem"),
  };
});

const ServerEffectfullLive = Layer.mergeAll(
  Layer.scoped(
    HttpServer.HttpServer,
    getFiles.pipe(
      Effect.flatMap(
        ({ key, cert }) =>
          NodeHttpServer.make(() => HTTPS.createServer({ key, cert }), {
            port,
          }),
        // NodeHttpServer.make(() => createServer(), { port })
      ),
    ),
  ),
  NodeHttpServer.layerContext,
);

const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(ManagementGroupLive),
);

const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(ApiLive),
  Layer.provide(NodeHttpServer.layer(HTTP.createServer, { port: 3001 })),
);

/*
Output:
timestamp=... level=INFO fiber=#0 message="Listening on https://localhost:3000"
*/
export const serveCommand = Command.make("serve", {}, () =>
  Layer.launch(ServerLive),
);
