import { Context, Schema } from "effect";
import { PrivateKeyEnvelope, PublicKeyEnvelope } from "./Keys.js";

export const FaucetWalletSchema = Schema.Struct({
  name: Schema.String,
  sk: PrivateKeyEnvelope,
});

export type FaucetWallet = typeof FaucetWalletSchema.Type;

export const PrivateNodeConfigSchema = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  hydraUrl: Schema.optionalWith(Schema.String, { exact: true }),
  nodeWalletSK: PrivateKeyEnvelope,
  hydraSK: PrivateKeyEnvelope,
});

export type PrivateNodeConfig = typeof PrivateNodeConfigSchema.Type;

export const NodeConfigSchema = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  hydraUrl: Schema.optionalWith(Schema.String, { exact: true }),
  nodeWalletVK: PublicKeyEnvelope,
  hydraVK: PublicKeyEnvelope,
});

export type NodeConfig = typeof NodeConfigSchema.Type;

export class NodeConfigService extends Context.Tag("NodeConfig")<
  NodeConfigService,
  { readonly nodeConfig: NodeConfig }
>() {}

export const CardanoProviderSchema = Schema.Union(
  Schema.Struct({
    blockfrostProjectId: Schema.String,
  }),
  Schema.Struct({
    koiosProjectId: Schema.String,
  }),
);

export const HeadConfigSchema = Schema.Struct({
  network: Schema.Literal("Preprod", "Preview", "Mainnet", "Custom"),
  providerId: CardanoProviderSchema,
  contractsReferenceTxIds: Schema.String,
  faucetWallets: Schema.Array(FaucetWalletSchema),
  privateNodes: Schema.Array(PrivateNodeConfigSchema),
  // I put nodes, we must add also the private nodes.
  // The idea is to have a list of nodes including the private ones.
  // In this way we simplify the code
  nodes: Schema.Array(NodeConfigSchema),
});

export type HeadConfig = typeof HeadConfigSchema.Type;
