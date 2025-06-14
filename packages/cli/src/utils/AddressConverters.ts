import { CML } from "@lucid-evolution/lucid";
import { Effect } from "effect";
import * as Common from "@hydra-manager/common";

export function skToAddress(
  nodeSK: Common.PrivateKeyEnvelope,
): Effect.Effect<string, Error> {
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

export function vkToAddress(
  vk: Common.PublicKeyEnvelope,
): Effect.Effect<string, Error> {
  if (vk.cborHex.startsWith("5820")) {
    const publicKey = CML.PublicKey.from_bytes(
      Buffer.from(vk.cborHex.substring(4), "hex"),
    );
    const pkHash = CML.Credential.new_pub_key(publicKey.hash());
    const address = CML.EnterpriseAddress.new(0, pkHash)
      .to_address()
      .to_bech32();
    return Effect.succeed(address);
  } else {
    return Effect.fail(new Error(`Wrong VK format provided for: ${vk}`));
  }
}

export function cborHexToPrivateKey(cborHex: string): string {
  return CML.PrivateKey.from_normal_bytes(
    Buffer.from((cborHex as string).substring(4), "hex"),
  ).to_bech32();
}

// TODO: add PKs to config and a converter
