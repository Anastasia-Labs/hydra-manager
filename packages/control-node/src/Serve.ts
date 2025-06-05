import { Command } from "@effect/cli";
import {
  FileSystem,
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSwagger,
  HttpServer,
} from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, Schema } from "effect";
import * as HTTPS from "node:https";
import * as HTTP from "node:http";
import * as CreateService from "./service/Create.js";
import * as StateService from "./service/State.js";
import { startAllApiHandler } from "./Command.js";

const managementGroup = HttpApiGroup.make("Management").add(
  HttpApiEndpoint.get("startAll", "/startAll")
    .addSuccess(Schema.String)
    .addError(Schema.Any, { status: 400 }),
);

const Api = HttpApi.make("hydra-manager-control-node").add(managementGroup);

const ManagementGroupLive = HttpApiBuilder.group(
  Api,
  "Management",
  (handlers) =>
    Effect.gen(function* () {
      return handlers
        .handle("startAll", () => startAllApiHandler)
        // .handle("stop", () => stopApiHandler);
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
  // Layer.provide(ServerEffectfullLive),
  Layer.provide(NodeHttpServer.layer(HTTP.createServer, { port: 3011 })),
);

/*
Output:
timestamp=... level=INFO fiber=#0 message="Listening on https://localhost:3000"
*/
export const serveCommand = Command.make("serve", {}, () =>
  Layer.launch(ServerLive),
);
