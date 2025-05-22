import { CML } from "@lucid-evolution/lucid";
import { Effect } from "effect";

import { Schema } from "effect";

export const PrivateKeyEnvelopeTypeSchema = Schema.Union(
  Schema.Literal("HydraSigningKey_ed25519"),
  Schema.Literal("PaymentSigningKeyShelley_ed25519")
);
export type PrivateKeyEnvelopeType = typeof PrivateKeyEnvelopeTypeSchema.Type;

export class PrivateKeyEnvelope extends Schema.Class<PrivateKeyEnvelope>(
  "PrivateKeyEnvelope"
)({
  type: PrivateKeyEnvelopeTypeSchema,
  description: Schema.String,
  cborHex: Schema.String,
}) {
  static generateRandomEd25519PrivateKey(type: PrivateKeyEnvelopeType) {
    return Effect.gen(function* () {
      const randomPrivateKey = CML.PrivateKey.generate_ed25519();
      const key = PrivateKeyEnvelope.make({
        type: type,
        description: "",
        cborHex:
          "8020" + Buffer.from(randomPrivateKey.to_raw_bytes()).toString("hex"),
      });

      yield* Effect.log("Generated key: ", key);

      return key;
    });
  }
}

export const PublicKeyEnvelopeTypeSchema = Schema.Union(
  Schema.Literal("PaymentVerificationKeyShelley_ed25519"),
  Schema.Literal("HydraVerificationKey_ed25519")
);
export type PublicKeyEnvelopeType = typeof PublicKeyEnvelopeTypeSchema.Type;

export class PublicKeyEnvelope extends Schema.Class<PublicKeyEnvelope>(
  "PublicKeyEnvelope"
)({
  type: PublicKeyEnvelopeTypeSchema,
  description: Schema.String,
  cborHex: Schema.String,
}) {
  static getPublicKeyFromEd25519PrivateKey(privateKey: PrivateKeyEnvelope) {
    return Effect.gen(function* () {
      try {
        const privateKeyCore = CML.PrivateKey.from_normal_bytes(
          Buffer.from(privateKey.cborHex.substring(4), "hex")
        );
        const publicKeyCore = privateKeyCore.to_public();
        const publicKey = PublicKeyEnvelope.make({
          type:
            privateKey.type === "HydraSigningKey_ed25519"
              ? "HydraVerificationKey_ed25519"
              : "PaymentVerificationKeyShelley_ed25519",
          description: "",
          cborHex:
            "8020" + Buffer.from(publicKeyCore.to_raw_bytes()).toString("hex"),
        });

        return publicKey;
      } catch (error) {
        if (error instanceof Error) {
          yield* Effect.fail(error);
        } else {
          yield* Effect.fail(
            new Error("Failed to get public key from private key")
          );
        }
      }
    });
  }
}
