import { Schema } from "effect";

export const KeyEnvelopeSchema = Schema.Struct({
  type: Schema.String,
  description: Schema.String,
  cborHex: Schema.String,
});

export type KeyEnvelope = typeof KeyEnvelopeSchema.Type;
// kk jjkkjfkdsajfdasjdksjdksjjj
