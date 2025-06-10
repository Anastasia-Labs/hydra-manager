import { Command } from "@effect/cli";
import {
  FileSystem,
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
  HttpApiSwagger,
  HttpServer,
} from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";
import { Context, Effect, Layer, Redacted, Schema } from "effect";
import * as HTTPS from "node:https";
import * as HTTP from "node:http";
import { startAllApiHandler, stopAllApiHandler } from "./Command.js";
import { FetchHttpClient } from "@effect/platform";

class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  // Specify the HTTP status code for unauthorized errors
  HttpApiSchema.annotations({ status: 401 })
) {}

class Authorization extends HttpApiMiddleware.Tag<Authorization>()(
  "Authorization",
  {
    failure: Unauthorized,
    security: {
      myBearer: HttpApiSecurity.bearer
    }
  }
) {}

const managementGroup = HttpApiGroup.make("Management")
  .add(
    HttpApiEndpoint.get("startAll", "/startAll")
      .addSuccess(Schema.String, { status: 200 })
      .addError(Schema.String, { status: 400 }),
  )
  .add(
    HttpApiEndpoint.get("stopAll", "/stopAll")
      .addSuccess(Schema.String, { status: 200 })
      .addError(Schema.String, { status: 400 }),
  ).middleware(Authorization);

const Api = HttpApi.make("hydra-manager-control-node").add(managementGroup);

const ManagementGroupLive = HttpApiBuilder.group(
  Api,
  "Management",
  (handlers) =>
    Effect.gen(function* () {
      return handlers
        .handle("startAll", () => startAllApiHandler)
        .handle("stopAll", () => stopAllApiHandler);
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

const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    return {
      // Define the handler for the Bearer token
      // The Bearer token is redacted for security
      myBearer: (bearerToken) =>
        Effect.gen(function* () {
          yield* Effect.log(
            "checking bearer token",
            Redacted.value(bearerToken)
          )
          // Return a mock User object as the CurrentUser
          return ""
        })
    }
  })
)

const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(ManagementGroupLive),
);

const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(ApiLive),
  // Layer.provide(ServerEffectfullLive),
  Layer.provide(NodeHttpServer.layer(HTTP.createServer, { port: 3011 })),
  Layer.provide(FetchHttpClient.layer),
);

/*
Output:
timestamp=... level=INFO fiber=#0 message="Listening on https://localhost:3000"
*/
export const serveCommand = Command.make("serve", {}, () =>
  Layer.launch(ServerLive),
);
