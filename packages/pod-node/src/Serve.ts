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
import { createServer } from "node:https";
import { program } from "./InitCommand.js";

const managementGroup = HttpApiGroup.make("Management").add(
  HttpApiEndpoint.get("start")`/`.addSuccess(Schema.String).addError(Schema.Any),
);

const Api = HttpApi.make("hydra-manager-pod-node").add(managementGroup);

const myApiHandler =
  program.pipe(Effect.provide(NodeContext.layer),
  Effect.catchAll((error) => {
    return Effect.fail(new Error(JSON.stringify(error)))
  })
)

const ManagementGroupLive = HttpApiBuilder.group(
  Api,
  "Management",
  (handlers) =>
    Effect.gen(function*() {
      return handlers
        .handle("start", () => Effect.gen(function* () {
            yield* Effect.log("Here")
            // return yield* myApiHandler
            return "Here"
          })
        )
    })
)
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
          NodeHttpServer.make(() => createServer({ key, cert }), { port }),
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
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3001 })),
);

/*
Output:
timestamp=... level=INFO fiber=#0 message="Listening on https://localhost:3000"
*/
export const serveCommand = Command.make("serve", {}, () =>
  Layer.launch(ServerLive),
);
