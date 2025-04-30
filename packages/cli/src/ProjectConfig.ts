import { Path, FileSystem } from "@effect/platform";
import { Config, Effect, JSONSchema, Layer, Schema } from "effect";
import * as Option from "effect/Option";

const CardanoProvider = Schema.Union(
  Schema.Struct({
    blockfrostProjectId: Schema.String
  }),
  Schema.Struct({
    koiosProjectId: Schema.String
  }),
)

const SKSchema = Schema.Struct({
  type: Schema.String,
  description: Schema.String,
  cborHex: Schema.String,
})

const NodeSchema = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  fundsWalletSK: SKSchema,
  nodeWalletSK: SKSchema,
  hydraSK: SKSchema,
  // TODO: add other SKs
})

const ProjectConfigSchema = Schema.Struct({
  network: Schema.String,
  providerId: CardanoProvider,
  contractsReferenceTxIds: Schema.Array(Schema.String),
  nodes: Schema.Array(NodeSchema),
})

export class ProjectConfig extends Effect.Service<ProjectConfig>()(
  "ProjectConfig",
  {
    effect: Effect.gen(function* () {
      const path = yield* Path.Path;
      const fs = yield* FileSystem.FileSystem;
      const configRaw = yield* fs.readFileString(path.join(path.resolve(), "config.json"));
      // TODO: add environment configuration lookups
      return Schema.decodeUnknownSync(ProjectConfigSchema)(configRaw)
    })
  },
) {}

// Simulate a project config for testing purposes
export const testLayer = Layer.succeed(
  ProjectConfig,
  ProjectConfig.make({
    network: "preprod",
    providerId: {
      blockfrostProjectId: "validID"
    },
    contractsReferenceTxIds: [""],
    nodes: [
      {
        "name": "Alice",
        "url": "ws://localhost:4001",
        "fundsWalletSK": {
          "type": "PaymentSigningKeyShelley_ed25519",
          "description": "Payment Signing Key",
          "cborHex": "5820..."
        },
        "nodeWalletSK": {
          "type": "PaymentSigningKeyShelley_ed25519",
          "description": "Payment Signing Key",
          "cborHex": "5820..."
        },
        "hydraSK": {
          "type": "HydraSigningKey_ed25519",
          "description": "",
          "cborHex": "5820..."
        }
      },
    ]
  }),
);
