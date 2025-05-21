import { CML } from "@lucid-evolution/lucid";
import { Context, Effect, Schema } from "effect";

export const SKSchema = Schema.Struct({
  type: Schema.String,
  cborHex: Schema.String,
});

type SK = typeof SKSchema.Type;

export const NodeConfigSchema = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  fundsWalletSK: SKSchema,
  nodeWalletSK: SKSchema,
  hydraSK: SKSchema,
  // TODO: add other SKs
});

export type NodeConfig = typeof NodeConfigSchema.Type;

export class NodeConfigService extends Context.Tag("NodeConfig")<
  NodeConfigService,
  { readonly nodeConfig: NodeConfig }
>() {}

export function skToAddress(nodeSK: SK): Effect.Effect<string, Error> {
  if (nodeSK.cborHex.startsWith("5820")) {
    const privateKey = CML.PrivateKey.from_normal_bytes(
      Buffer.from(nodeSK.cborHex.substring(4), "hex"),
    );
    const pkHash = CML.Credential.new_pub_key(privateKey.to_public().hash());
    const address = CML.EnterpriseAddress.new(0, pkHash)
      .to_address()
      .to_bech32();
    return Effect.succeed(address);
  } else {
    return Effect.fail(new Error(`Wrong SK format provided for: ${nodeSK}`));
  }
}

// TODO: add PKs to config and a converter
