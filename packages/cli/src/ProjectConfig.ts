import { Path, FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Config, Context, Effect, Layer, pipe, Schema } from "effect";
import * as NodeConfig from "./NodeConfig.js";

const CardanoProvider = Schema.Union(
  Schema.Struct({
    blockfrostProjectId: Schema.String,
  }),
  Schema.Struct({
    koiosProjectId: Schema.String,
  }),
);

const ProjectConfig = Schema.Struct({
  network: Schema.Literal("Preprod", "Preview", "Mainnet", "Custom"),
  providerId: CardanoProvider,
  contractsReferenceTxIds: Schema.String,
  mainNodeName: Schema.String,
  nodes: Schema.Array(NodeConfig.NodeConfig),
});

export type ProjectConfig = typeof ProjectConfig.Type;

export class ProjectConfigService extends Context.Tag("ProjectConfigService")<
  ProjectConfigService,
  {
    projectConfig: ProjectConfig;
    getNodeConfigByName: (
      nodeName: String,
    ) => Effect.Effect<NodeConfig.NodeConfig, Error>;
  }
>() {}

const fileSystemImpl = Effect.gen(function* () {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;

  const projectConfig: ProjectConfig = yield* pipe(
    fs.readFileString(path.join(path.resolve(), "config.json")),
    Effect.flatMap((configString) =>
      Schema.decodeUnknown(Schema.parseJson(ProjectConfig))(configString),
    ),
    Effect.flatMap((config) => validateConfig(config)),
  );

  const getNodeConfigByName = (nodeName: String) =>
    Effect.gen(function* () {
      const maybeNode = projectConfig.nodes.find(
        (node) => node.name === nodeName,
      );
      if (maybeNode === undefined) {
        return yield* Effect.fail(
          new Error(`Failed to find node with a name ${nodeName}`),
        );
      }
      return maybeNode;
    });

  return { projectConfig, getNodeConfigByName };
  // TODO: add environment configuration lookups
});

export const ProjectConfigFSLayer = Layer.effect(
  ProjectConfigService,
  fileSystemImpl,
).pipe(Layer.provide(NodeContext.layer));

const testImpl = Effect.gen(function* () {
  const projectConfig: ProjectConfig = {
    network: "Preprod",
    providerId: {
      blockfrostProjectId: "validID",
    },
    contractsReferenceTxIds: "",
    mainNodeName: "Alice",
    nodes: [
      {
        name: "Alice",
        url: "ws://localhost:4001",
        fundsWalletSK: {
          type: "PaymentSigningKeyShelley_ed25519",
          cborHex: "5820...",
        },
        nodeWalletSK: {
          type: "PaymentSigningKeyShelley_ed25519",
          cborHex: "5820...",
        },
        hydraSK: {
          type: "HydraSigningKey_ed25519",
          cborHex: "5820...",
        },
      },
    ],
  };
  const getNodeConfigByName = (nodeName: String) =>
    Effect.succeed({
      name: "Alice",
      url: "ws://localhost:4001",
      fundsWalletSK: {
        type: "PaymentSigningKeyShelley_ed25519",
        description: "Payment Signing Key",
        cborHex: "5820...",
      },
      nodeWalletSK: {
        type: "PaymentSigningKeyShelley_ed25519",
        description: "Payment Signing Key",
        cborHex: "5820...",
      },
      hydraSK: {
        type: "HydraSigningKey_ed25519",
        description: "",
        cborHex: "5820...",
      },
    });
  return { projectConfig, getNodeConfigByName };
});
export const ProjectConfigTestLayer = Layer.effect(
  ProjectConfigService,
  testImpl,
);

const validateConfig = (projectConfig: ProjectConfig) =>
  Effect.gen(function* () {
    const config = projectConfig;

    if (!(config.network == "Preprod")) {
      yield* Effect.fail(new Error("The network is not Preprod"));
    }

    if ("blockfrostProjectId" in config.providerId) {
      if (
        !config.providerId.blockfrostProjectId.startsWith(
          config.network.toLowerCase(),
        )
      ) {
        yield* Effect.fail(
          new Error("The blockfrostProjectId is from a wrong network"),
        );
      }
    }

    // TODO: The same for Koios?

    const nodes = config.nodes;
    const walletSKs = nodes
      .map((node) => node.fundsWalletSK)
      .concat(nodes.map((node) => node.nodeWalletSK));
    if (
      !walletSKs
        .map((sk) => sk.type)
        .every((type) => type === "PaymentSigningKeyShelley_ed25519")
    ) {
      yield* Effect.fail(
        new Error(
          "One wallet secret key or more have non PaymentSigningKeyShelley_ed25519 type field",
        ),
      );
    }
    if (
      !walletSKs.map((sk) => sk.cborHex).every((hex) => hex.startsWith("5820"))
    ) {
      yield* Effect.fail(
        new Error("One wallet secret key or more starts not with 5820"),
      );
    }

    const hydraSKs = nodes.map((node) => node.hydraSK);
    if (
      !hydraSKs
        .map((sk) => sk.type)
        .every((type) => type == "HydraSigningKey_ed25519")
    ) {
      yield* Effect.fail(
        new Error(
          "One hydra secret key or more have non HydraSigningKey_ed25519 type field",
        ),
      );
    }
    if (
      !hydraSKs.map((sk) => sk.cborHex).every((hex) => hex.startsWith("5820"))
    ) {
      yield* Effect.fail(
        new Error("One hydra secret key or more starts not with 5820"),
      );
    }

    return config;
  });

// // Simulate a project config for testing purposes
// export const testLayer = Layer.succeed(
//   ProjectConfigService,
//   ProjectConfigService.make({
//     projectConfig: {
//       network: "Preprod",
//       providerId: {
//         blockfrostProjectId: "validID",
//       },
//       contractsReferenceTxIds: "",
//       mainNodeName: "Alice",
//       nodes: [
//         {
//           name: "Alice",
//           url: "ws://localhost:4001",
//           fundsWalletSK: {
//             type: "PaymentSigningKeyShelley_ed25519",
//             cborHex: "5820...",
//           },
//           nodeWalletSK: {
//             type: "PaymentSigningKeyShelley_ed25519",
//             cborHex: "5820...",
//           },
//           hydraSK: {
//             type: "HydraSigningKey_ed25519",
//             cborHex: "5820...",
//           },
//         },
//       ],
//     },
//     getNodeConfigByName: (nodeName) =>
//       Effect.succeed({
//         name: "Alice",
//         url: "ws://localhost:4001",
//         fundsWalletSK: {
//           type: "PaymentSigningKeyShelley_ed25519",
//           description: "Payment Signing Key",
//           cborHex: "5820...",
//         },
//         nodeWalletSK: {
//           type: "PaymentSigningKeyShelley_ed25519",
//           description: "Payment Signing Key",
//           cborHex: "5820...",
//         },
//         hydraSK: {
//           type: "HydraSigningKey_ed25519",
//           description: "",
//           cborHex: "5820...",
//         },
//       }),
//   })
// );
