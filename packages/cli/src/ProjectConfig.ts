import { Path, FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Context, Effect, Layer, pipe, Schema, Option } from "effect";
import * as NodeConfig from "./NodeConfig.js";
import * as Common from "@hydra-manager/common"

const CardanoProviderSchema = Schema.Union(
  Schema.Struct({
    blockfrostProjectId: Schema.String,
  }),
  Schema.Struct({
    koiosProjectId: Schema.String,
  }),
);

const ProjectConfigSchema = Schema.Struct({
  network: Schema.Literal("Preprod", "Preview", "Mainnet", "Custom"),
  providerId: CardanoProviderSchema,
  contractsReferenceTxIds: Schema.String,
  faucetWallets: Schema.Array(NodeConfig.FaucetWalletSchema),
  nodes: Schema.Array(Common.NodeConfigSchema),
  privateNodes: Schema.Array(Common.PrivateNodeConfigSchema),
});

export type ProjectConfig = typeof ProjectConfigSchema.Type;

export class ProjectConfigService extends Context.Tag("ProjectConfigService")<
  ProjectConfigService,
  {
    projectConfig: ProjectConfig;
    getNodeConfigByName: (
      nodeName: string,
    ) => Effect.Effect<NodeConfig.NodeConfig, Error>;
    getFaucetWalletByName: (
      faucetWalletName: string,
    ) => Effect.Effect<NodeConfig.FaucetWallet, Error>;
  }
>() {}

const fileSystemImpl = Effect.gen(function* () {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;

  const projectConfig: ProjectConfig = yield* pipe(
    fs.readFileString(path.join(path.resolve(), "config.json")),
    Effect.flatMap((configString) =>
      Schema.decodeUnknown(Schema.parseJson(ProjectConfigSchema))(configString),
    ),
    Effect.flatMap((config) => validateConfig(config)),
  );

  const getNodeConfigByName = (nodeName: string) =>
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

  const getFaucetWalletByName = (walletName: string) =>
    Effect.gen(function* () {
      const maybeWallets = projectConfig.faucetWallets.find(
        (node) => node.name === walletName,
      );
      if (maybeWallets === undefined) {
        return yield* Effect.fail(
          new Error(`Failed to find faucet wallet with a name ${walletName}`),
        );
      }
      return maybeWallets;
    });

  return { projectConfig, getNodeConfigByName, getFaucetWalletByName };
});

export const ProjectConfigFSLayer = Layer.effect(
  ProjectConfigService,
  fileSystemImpl,
).pipe(Layer.provide(NodeContext.layer));

const testImpl = Effect.gen(function* () {
  const projectConfig: ProjectConfig = {
    network: "Preprod",
    providerId: {
      blockfrostProjectId: "invalidID",
    },
    contractsReferenceTxIds: "",
    faucetWallets: [
      {
        name: "FaucetWallet",
        sk: {
          type: "PaymentSigningKeyShelley_ed25519",
          cborHex: "5820...",
        }
      },
    ],
    nodes: [
      {
        name: "Alice",
        url: "ws://localhost:4001",
        nodeWalletVK: {
          type: "PaymentVerificationKeyShelley_ed25519",
          cborHex: "5820...",
          description: "",
        },
        hydraVK: {
          type: "HydraVerificationKey_ed25519",
          cborHex: "5820...",
          description: ""
        },
      },
    ],
    privateNodes: [
      {
      "name": "Alice",
      "url": "ws://localhost:4001",
      "nodeWalletSK": {
        "type": "PaymentSigningKeyShelley_ed25519",
        "cborHex": "58206d92b3dc42bba5840aeeb8dd3d3c7a3ce71721935483c238ecb2f3e1b5f2b5d0",
        "description": ""
      },
      "hydraSK": {
        "type": "HydraSigningKey_ed25519",
        "cborHex": "5820fb5816d4efa1fe4d853396cd84a80df4b7f78ccd7314a27ebe93483d06d31091",
        "description": ""
      }
    }
    ]
  };
  const getNodeConfigByName = (nodeName: string) =>
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
  const getFaucetWalletByName = (walletName: string) =>
    Effect.succeed({
        name: "FaucetWallet",
        sk: {
          type: "PaymentSigningKeyShelley_ed25519",
          cborHex: "5820...",
        }
      });

  return { projectConfig, getNodeConfigByName, getFaucetWalletByName };
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
    const walletVKs = nodes
      .map((node) => node.nodeWalletVK)
    if (
      !walletVKs
        .map((sk) => sk.type)
        .every((type) => type === "PaymentVerificationKeyShelley_ed25519")
    ) {
      yield* Effect.fail(
        new Error(
          "One wallet secret key or more have non PaymentSigningKeyShelley_ed25519 type field",
        ),
      );
    }
    if (
      !walletVKs.map((sk) => sk.cborHex).every((hex) => hex.startsWith("5820"))
    ) {
      yield* Effect.fail(
        new Error("One wallet secret key or more starts not with 5820"),
      );
    }

    const hydraVKs = nodes.map((node) => node.hydraVK);
    if (
      !hydraVKs
        .map((sk) => sk.type)
        .every((type) => type == "HydraVerificationKey_ed25519")
    ) {
      yield* Effect.fail(
        new Error(
          "One hydra secret key or more have non HydraVerificationKey_ed25519 type field",
        ),
      );
    }
    if (
      !hydraVKs.map((sk) => sk.cborHex).every((hex) => hex.startsWith("5820"))
    ) {
      yield* Effect.fail(
        new Error("One hydra secret key or more starts not with 5820"),
      );
    }

    return config;
  });
