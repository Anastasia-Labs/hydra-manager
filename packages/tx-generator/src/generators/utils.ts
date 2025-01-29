import { Writable } from "node:stream";

import {
  applyParamsToScript,
  Assets,
  CML,
  Data,
  Script,
  walletFromSeed,
} from "@lucid-evolution/lucid";

type SerializedAssets = Record<string, string>;

const serializeAssets = (assets: Assets): SerializedAssets => {
  return Object.fromEntries(
    Object.entries(assets).map(([asset, value]) => [asset, value.toString()])
  );
};

const createAlwaysSuccessScript = (): Script => {
  const compiledCode =
    "585c010100323232323223225333004323232323253330093370e900118051baa00113233224a2601a002601a601c00260166ea800458c02cc03000cc028008c024008c024004c018dd50008a4c26cac6eb80055cd2ab9d5573cae855d11";
  const randomString: string = Buffer.from(
    Array.from({ length: 4 }, () => Math.floor((Math.random() * 256) % 256))
  ).toString("hex");
  const appliedCompiledCode = applyParamsToScript(compiledCode, [randomString]);

  const script: Script = {
    type: "PlutusV3",
    script: appliedCompiledCode,
  };
  return script;
};

const parseUnknownKeytoBech32PrivateKey = (unknownKey: unknown): string => {
  if (typeof unknownKey !== "string")
    throw new Error("Expected a string value for the private key");

  if (unknownKey.trim().includes(" ")) {
    const wallet = walletFromSeed(unknownKey.trim(), {
      accountIndex: 0,
      addressType: "Base",
    });
    return wallet.paymentKey;
  } else {
    try {
      const paymentKey = CML.PrivateKey.from_normal_bytes(
        Buffer.from(unknownKey.substring(4), "hex")
      );
      return paymentKey.to_bech32();
    } catch {
      const paymentKey = CML.PrivateKey.from_bech32(unknownKey.trim());
      return paymentKey.to_bech32();
    }
  }
};

const getPublicKeyHashFromPrivateKey = (privateKey: string): string => {
  return CML.PrivateKey.from_bech32(privateKey).to_public().hash().to_hex();
};

const getPrivateKeyCborHex = (privateKey: string): string => {
  const extendedKeyHash = Buffer.from(
    CML.PrivateKey.from_bech32(privateKey).to_raw_bytes()
  ).toString("hex");
  return Data.to(
    extendedKeyHash.length > 64
      ? extendedKeyHash.slice(0, extendedKeyHash.length / 2)
      : extendedKeyHash
  );
};

const waitWritable = (writable: Writable): Promise<void> => {
  return new Promise((resolve) => {
    setInterval(() => {
      if (writable.writable) resolve();
    }, 10);
  });
};

export {
  createAlwaysSuccessScript,
  getPrivateKeyCborHex,
  getPublicKeyHashFromPrivateKey,
  parseUnknownKeytoBech32PrivateKey,
  serializeAssets,
  waitWritable,
};
