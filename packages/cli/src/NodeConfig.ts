import { CML } from "@lucid-evolution/lucid";
import { Context, Effect, Schema } from "effect";

export const SKSchema = Schema.Struct({
  type: Schema.String,
  cborHex: Schema.String,
});

export type SK = typeof SKSchema.Type;

export const FaucetWalletSchema = Schema.Struct({
  name: Schema.String,
  sk: SKSchema,
})

export type FaucetWallet = typeof FaucetWalletSchema.Type;

export const NodeConfigSchema = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  nodeWalletSK: SKSchema,
  hydraSK: SKSchema,
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

export function cborHexToPrivateKey(cborHex: string): string {
  return CML.PrivateKey.from_normal_bytes(
    Buffer.from((cborHex as string).substring(4), "hex"),
  ).to_bech32();
}

// TODO: add PKs to config and a converter
