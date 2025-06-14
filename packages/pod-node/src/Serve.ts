import { Command } from "@effect/cli";
import {
  FileSystem,
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
  HttpApiSwagger,
  HttpServer,
} from "@effect/platform";
import { NodeContext, NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Context, Effect, Layer, Redacted, Schema, pipe } from "effect";
import * as HTTPS from "node:https";
import * as HTTP from "node:http";
import { startApiHandler, stopApiHandler } from "./Command.js";

class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  // Specify the HTTP status code for unauthorized errors
  HttpApiSchema.annotations({ status: 401 })
) {}

class Authorized extends Schema.Class<Authorized>("Authorized")(
  {},
) {}

class CurrentAuthorized extends Context.Tag("CurrentAuthorized")<CurrentAuthorized, Authorized>() {}

class Authorization extends HttpApiMiddleware.Tag<Authorization>()(
  "Authorization",
  {
    provides: CurrentAuthorized,
    failure: Unauthorized,
    security: {
      myBearer: HttpApiSecurity.bearer
    }
  }
) {}

const managementGroup = HttpApiGroup.make("Management")
  .add(
    HttpApiEndpoint.get("start", "/start")
      .addSuccess(Schema.String, { status: 200 })
      .middleware(Authorization)
      .addError(Schema.String, { status: 400 }),
  ).middleware(Authorization)
  .add(
    HttpApiEndpoint.get("stop", "/stop")
      .addSuccess(Schema.String, { status: 200 })
      .addError(Schema.String, { status: 400 }),
  ).middleware(Authorization)

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
const port = 3001;

const getCertFiles = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return {
    key: yield* fs.readFileString("credentials/privatifte-key.pem"),
    cert: yield* fs.readFileString("certificates/certificate.pem"),
  };
});

const ServerEffectfullLive = Layer.mergeAll(
  Layer.scoped(
    HttpServer.HttpServer,
    getCertFiles.pipe(
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

const getBearerTokenFile = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return {
    token: yield* fs.readFileString("credentials/bearer.txt"),
  };
});

const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const bearer = yield* getBearerTokenFile
    return {
      myBearer: (bearerToken) =>
        Effect.gen(function* () {
          if (Redacted.value(bearerToken).trim() === bearer.token.trim()) {
            yield* Effect.log("Returning Authorized")
            return Authorized
          } else {
            yield* Effect.log("Returning Unauthorized")
            return yield* new Unauthorized
          }
        })
    }
  })
)

const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(ManagementGroupLive),
  Layer.provide(AuthorizationLive),
);

const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(ApiLive),
  Layer.provide(NodeHttpServer.layer(HTTP.createServer, { port: port })),
);

/*
Output:
timestamp=... level=INFO fiber=#0 message="Listening on https://localhost:3000"
*/
export const serveCommand = Command.make("serve", {}, () =>
  Layer.launch(ServerLive),
);
