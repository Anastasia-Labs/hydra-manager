import { Context, Schema } from "effect";

export const SKSchema = Schema.Struct({
  type: Schema.String,
  cborHex: Schema.String,
});

export const NodeConfig = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  fundsWalletSK: SKSchema,
  nodeWalletSK: SKSchema,
  hydraSK: SKSchema,
  // TODO: add other SKs
});

export type NodeConfig = typeof NodeConfig.Type;

export class NodeConfigService extends Context.Tag("NodeConfig")<
  NodeConfigService,
  { readonly nodeConfig: NodeConfig }
>() {}
