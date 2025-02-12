import { LucidEvolution } from "@lucid-evolution/lucid";
import fs from "fs";

import {
  generateLargeUTxOs,
  GenerateLargeUTxOsConfig,
  generateManyTxs,
  GenerateManyTxsConfig,
} from "../src/index.js";
import { myTest } from "./setup.js";

myTest("generate many txs", async ({ lucid, privateKey }) => {
  const initialUTxO = await getL1InitialUTxO(lucid);
  if (!initialUTxO) throw new Error("No UTxO found");

  if (!fs.existsSync("./tests/output")) fs.mkdirSync("./tests/output");
  const writable = fs.createWriteStream("./tests/output/many-txs-dummy.json");
  const config: GenerateManyTxsConfig = {
    network: "Preprod",
    txsCount: 100,
    walletSeedOrPrivateKey: privateKey,
    initialUTxO,
    writable,
    hasSmartContract: true,
  };
  await generateManyTxs(config);
});

myTest("generate large utxos", async ({ lucid, privateKey }) => {
  const initialUTxO = await getL1InitialUTxO(lucid);
  if (!initialUTxO) throw new Error("No UTxO found");

  if (!fs.existsSync("./tests/output")) fs.mkdirSync("./tests/output");
  const config: GenerateLargeUTxOsConfig = {
    network: "Preprod",
    utxosCount: 1000,
    finalUtxosCount: 50,
    walletSeedOrPrivateKey: privateKey,
    initialUTxO,
    writable: fs.createWriteStream("./tests/output/large-utxos-50-final.json"),
  };
  await generateLargeUTxOs(config);
});

myTest(
  "generate large utxos and make some transactions",
  async ({ lucid, privateKey }) => {
    const utxosCount = 1000;
    const initialUTxO = await getL1InitialUTxO(
      lucid,
      BigInt(utxosCount) * 1_000_000n
    );
    if (!initialUTxO) throw new Error("No UTxO found");

    if (!fs.existsSync("./tests/output")) fs.mkdirSync("./tests/output");
    const config: GenerateLargeUTxOsConfig = {
      network: "Preprod",
      utxosCount: 1000,
      finalUtxosCount: 50,
      transactionCount: 100,
      walletSeedOrPrivateKey: privateKey,
      initialUTxO,
      writable: fs.createWriteStream(
        "./tests/output/large-utxos-50-final.json"
      ),
    };
    await generateLargeUTxOs(config);
  }
);

async function getL1InitialUTxO(lucid: LucidEvolution, minLovelace?: bigint) {
  const utxos = await lucid.wallet().getUtxos();

  return minLovelace
    ? utxos.find((utxo) => utxo.assets.lovelace >= minLovelace)
    : utxos[0];
}
