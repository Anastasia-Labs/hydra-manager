import { Path, FileSystem } from "@effect/platform";
import { Config, Context, Effect, JSONSchema, Layer, Schema } from "effect";
import * as Option from "effect/Option";

const CardanoProvider = Schema.Union(
  Schema.Struct({
    blockfrostProjectId: Schema.String,
  }),
  Schema.Struct({
    koiosProjectId: Schema.String,
  }),
);

const SKSchema = Schema.Struct({
  type: Schema.String,
  description: Schema.String,
  cborHex: Schema.String,
});

const NodeSchema = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  fundsWalletSK: SKSchema,
  nodeWalletSK: SKSchema,
  hydraSK: SKSchema,
  // TODO: add other SKs
});

const ProjectConfigSchema = Schema.Struct({
  network: Schema.Literal("Preprod", "Preview", "Mainnet", "Custom"),
  providerId: CardanoProvider,
  contractsReferenceTxIds: Schema.String,
  mainNodeName: Schema.String,
  nodes: Schema.Array(NodeSchema),
});

export type ProjectConfigType = Schema.Schema.Type<typeof ProjectConfigSchema>;
export type NodeConfigType = Schema.Schema.Type<typeof NodeSchema>;

export class NodeConfig extends Context.Tag("NodeConfig")<
  NodeConfig,
  { readonly nodeConfig: Effect.Effect<NodeConfigType> }
>() {}

export class ProjectConfig extends Effect.Service<ProjectConfig>()(
  "ProjectConfig",
  {
    effect: Effect.gen(function* () {
      const path = yield* Path.Path;
      const fs = yield* FileSystem.FileSystem;
      const configRaw = yield* fs.readFileString(
        path.join(path.resolve(), "config.json"),
      );
      const configJSON = Schema.decodeUnknownSync(Schema.parseJson())(
        configRaw,
      );
      const configEffect =
        Schema.decodeUnknown(ProjectConfigSchema)(configJSON);
      const projectConfig: ProjectConfigType = yield* checkConfig(configEffect);

      const nodeConfigByName = (nodeName: String) =>
        Effect.gen(function* () {
          const mbNode = projectConfig.nodes.find(
            (node) => node.name === nodeName,
          );
          if (mbNode !== undefined) {
            const nodeConf: NodeConfigType = mbNode;
            return yield* Effect.succeed(nodeConf);
          }
          return yield* Effect.fail(
            new Error(
              `Failed to produce node config for node with a name ${nodeName}`,
            ),
          );
        });

      return { projectConfig, nodeConfigByName };
      // TODO: add environment configuration lookups
    }),
  },
) {}

function checkConfig(
  effectConfig: Effect.Effect<ProjectConfigType, Error, never>,
): Effect.Effect<ProjectConfigType, Error, never> {
  return Effect.gen(function* () {
    const config = yield* effectConfig;

    if (!(config.network == "Preprod")) {
      Error("The network is not Preprod");
    }

    if ("blockfrostProjectId" in config.providerId) {
      if (
        !config.providerId.blockfrostProjectId.startsWith(
          config.network.toLowerCase(),
        )
      ) {
        Error("The blockfrostProjectId is from a wrong network");
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
        .every((type) => type == "PaymentSigningKeyShelley_ed25519")
    ) {
      Error(
        "One wallet secret key or more have non PaymentSigningKeyShelley_ed25519 type field",
      );
    }
    if (
      !walletSKs.map((sk) => sk.cborHex).every((hex) => hex.startsWith("5820"))
    ) {
      Error("One wallet secret key or more starts not with 5820");
    }

    const hydraSKs = nodes.map((node) => node.hydraSK);
    if (
      !hydraSKs
        .map((sk) => sk.type)
        .every((type) => type == "HydraSigningKey_ed25519")
    ) {
      Error(
        "One hydra secret key or more have non HydraSigningKey_ed25519 type field",
      );
    }
    if (
      !hydraSKs.map((sk) => sk.cborHex).every((hex) => hex.startsWith("5820"))
    ) {
      Error("One hydra secret key or more starts not with 5820");
    }

    return config;
  });
}

// Simulate a project config for testing purposes
export const testLayer = Layer.succeed(
  ProjectConfig,
  ProjectConfig.make({
    projectConfig: {
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
        },
      ],
    },
    nodeConfigByName: (nodeName) =>
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
      }),
  }),
);
