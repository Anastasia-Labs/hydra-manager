import { Writable } from "node:stream";

import {
  Emulator,
  EmulatorAccount,
  generateEmulatorAccountFromPrivateKey,
  Lucid,
  Network,
  paymentCredentialOf,
  PROTOCOL_PARAMETERS_DEFAULT,
  UTxO,
} from "@lucid-evolution/lucid";
import _ from "lodash";
import { Ora } from "ora-classic";

import { HydraTransaction } from "../types.js";
import {
  getPrivateKeyCborHex,
  getPublicKeyHashFromPrivateKey,
  parseUnknownKeytoBech32PrivateKey,
  serializeAssets,
  waitWritable,
} from "./utils.js";

const TOTAL_ACCOUNT_COUNT = 100;
const OUTPUT_UTXOS_CHUNK = 20;

interface GenerateLargeUTxOsConfig {
  network: Network;
  initialUTxO: UTxO;
  needCommit?: boolean;
  utxosCount: number;
  finalUtxosCount?: number;
  walletSeedOrPrivateKey: string;
  writable?: Writable;
  transactionCount?: number;
}

const generateLargeUTxOs = async (
  config: GenerateLargeUTxOsConfig,
  spinner?: Ora
) => {
  const {
    network,
    initialUTxO,
    needCommit = true,
    utxosCount,
    finalUtxosCount = 1,
    walletSeedOrPrivateKey,
    writable,
    transactionCount,
  } = config;

  if (finalUtxosCount > utxosCount / OUTPUT_UTXOS_CHUNK)
    throw new Error(
      `Final UTxO Count can be ${Math.floor(
        utxosCount / OUTPUT_UTXOS_CHUNK
      )} at maximum`
    );

  // get payment to key to spend initial utxo
  const privateKey = parseUnknownKeytoBech32PrivateKey(walletSeedOrPrivateKey);

  // check if privateKey is valid one to spend initial UTxO
  const publicKeyHash = getPublicKeyHashFromPrivateKey(privateKey);
  const initialUTxOAddressPubKeyHash = paymentCredentialOf(
    initialUTxO.address
  ).hash;
  if (publicKeyHash != initialUTxOAddressPubKeyHash)
    throw new Error("Payment Key is not valid to spend Initial UTxO");

  let refinedInitialUTxO;
  let refinedpaymentKey;
  if (needCommit) {
    // for json file
    refinedInitialUTxO = {
      [`${initialUTxO.txHash}#${initialUTxO.outputIndex}`]: {
        ...initialUTxO,
        assets: serializeAssets(initialUTxO.assets),
      },
    };
    refinedpaymentKey = {
      cborHex: getPrivateKeyCborHex(privateKey),
      description: "paymentKey",
      type: "PaymentSigningKeyShelley_ed25519",
    };

    // write initial utxo and payment key
    if (writable) {
      await waitWritable(writable);
      writable.write(`{"clientDatasets":[{
        "initialUTxO": ${JSON.stringify(refinedInitialUTxO)},
        "paymentKey": ${JSON.stringify(refinedpaymentKey)},
        "txSequence": [`);
    }
  } else {
    // write only txSequence
    if (writable) {
      await waitWritable(writable);
      writable.write(`{"clientDatasets":[{
          "txSequence": [`);
    }
  }

  // make emulator and lucid with initial utxo
  const mainAccount: EmulatorAccount = {
    seedPhrase: "",
    address: initialUTxO.address,
    assets: initialUTxO.assets,
    privateKey,
  };
  const emulator = new Emulator([mainAccount]);
  emulator.ledger = {
    [`${initialUTxO.txHash}${initialUTxO.outputIndex}`]: {
      utxo: initialUTxO,
      spent: false,
    },
  };
  const lucid = await Lucid(emulator, network, {
    presetProtocolParameters: {
      ...PROTOCOL_PARAMETERS_DEFAULT,
      minFeeA: 0,
      minFeeB: 0,
      priceMem: 0,
      priceStep: 0,
      coinsPerUtxoByte: 0n,
    },
  });

  const pLimit = await import("p-limit");
  // generator accounts
  const limit = pLimit.default(10);
  const accounts = await Promise.all(
    Array.from({ length: TOTAL_ACCOUNT_COUNT }, () =>
      limit(() => generateEmulatorAccountFromPrivateKey({}))
    )
  );

  // state variable
  let currentUtxosCount = 1;
  let currentTxsCount = 0;
  const rollBackers: {
    utxos: UTxO[];
    privateKey: string;
  }[] = [];
  const mainAccountLovelace = initialUTxO.assets.lovelace;
  const outputLovelace =
    (mainAccountLovelace - 1_000_000n) / BigInt(utxosCount);

  if (outputLovelace < 1_000_000n)
    throw new Error(`Not enough Lovelace to distribute`);

  // select wallet
  lucid.selectWallet.fromAddress(initialUTxO.address, [initialUTxO]);

  if (spinner) spinner.info("Generating large UTxOs");

  // generate large utxos
  const dummyTxs: HydraTransaction[] = [];
  while (currentUtxosCount < utxosCount) {
    // select random account
    const randomAccount =
      accounts[Math.floor(Math.random() * TOTAL_ACCOUNT_COUNT)];
    const txBuilder = lucid.newTx();

    const outputChunk =
      utxosCount - currentUtxosCount > OUTPUT_UTXOS_CHUNK
        ? OUTPUT_UTXOS_CHUNK
        : utxosCount - currentUtxosCount;

    // payout many times
    Array.from({ length: outputChunk }).forEach(() => {
      txBuilder.pay.ToAddress(randomAccount.address, {
        lovelace: outputLovelace,
      });
    });

    const [newWalletUTxOs, derivedOutputs, txSignBuilder] =
      await txBuilder.chain();
    const txSigned = await txSignBuilder.sign
      .withPrivateKey(privateKey)
      .complete();
    const txHash = txSigned.toHash();
    const tx: HydraTransaction = {
      cborHex: txSigned.toCBOR(),
      description: "Ledger Cddl Format",
      txId: txHash,
      type: "Tx ConwayEra",
    };

    if (writable) {
      await waitWritable(writable);
      // write to file
      writable.write(
        `${currentTxsCount > 0 ? ",\n" : ""}${JSON.stringify(tx)}`
      );
    } else {
      // save to array
      dummyTxs.push(tx);
    }
    currentUtxosCount = currentUtxosCount + outputChunk;
    currentTxsCount = currentTxsCount + 1;

    // overrid utxos
    lucid.overrideUTxOs(newWalletUTxOs);

    // remove own output
    derivedOutputs.pop();
    rollBackers.unshift({
      utxos: derivedOutputs,
      privateKey: randomAccount.privateKey,
    });

    // free memory
    txBuilder.rawConfig().txBuilder.free();
    txSignBuilder.toTransaction().free();
    txSigned.toTransaction().free();

    // to give garbage collector time to free memory
    if (currentTxsCount % 250 == 0)
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 100));
  }

  if (spinner) spinner.info("Generated large UTxOs");

  let currentStepMainAccountLovelace = (await lucid.wallet().getUtxos()).reduce(
    (acc, cur) => acc + cur.assets.lovelace,
    0n
  );

  const currentMainWalletUTxOs = await lucid.wallet().getUtxos();

  // Create dummy transactions
  if (transactionCount && rollBackers.length > 0) {
    if (spinner) spinner.start("Generating dummy transactions");

    const transactionStats = {
      total: transactionCount,
      generated: 0,
      startTime: Date.now(),
    };

    const rollBacker = rollBackers.shift();
    if (!rollBacker) throw new Error("Rollbacker not found");

    const selectedUtxos = [rollBacker.utxos.shift()!];

    lucid.selectWallet.fromAddress(selectedUtxos[0].address, selectedUtxos);

    for (let i = 0; i < transactionCount; i++) {
      const txBuilder = lucid.newTx();
      const [newWalletUTxOs, _, txSignBuilder] = await txBuilder.pay
        .ToAddress(selectedUtxos[0].address, selectedUtxos[0].assets)
        .chain();
      const txSigned = await txSignBuilder.sign
        .withPrivateKey(rollBacker.privateKey)
        .complete();
      const txHash = txSigned.toHash();
      const tx: HydraTransaction = {
        cborHex: txSigned.toCBOR(),
        description: "Ledger Cddl Format",
        txId: txHash,
        type: "Tx ConwayEra",
      };

      if (writable) {
        await waitWritable(writable);
        // write to file
        writable.write(`,\n${JSON.stringify(tx)}`);
      } else {
        // save to array
        dummyTxs.push(tx);
      }

      // free memory
      txBuilder.rawConfig().txBuilder.free();
      txSignBuilder.toTransaction().free();
      txSigned.toTransaction().free();

      transactionStats.generated++;

      lucid.overrideUTxOs(newWalletUTxOs);

      // to give garbage collector time to free memory
      if (i % 250 == 0) {
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 100));

        if (spinner)
          spinner.text = `Generated ${
            transactionStats.generated
          } transactions out of ${transactionStats.total} TPS: ${Math.floor(
            transactionStats.generated /
              ((Date.now() - transactionStats.startTime) / 1000)
          )}`;
      }
    }

    rollBackers.push({
      utxos: [...rollBacker.utxos, ...(await lucid.wallet().getUtxos())],
      privateKey: rollBacker.privateKey,
    });

    if (spinner) spinner.succeed("Generated dummy transactions");
  }

  const stepForOneUtxo = Math.floor(rollBackers.length / finalUtxosCount);
  let currentStep = 0;
  let splitMainAccount = false;

  // now spend all those large utxos
  lucid.selectWallet.fromAddress(mainAccount.address, currentMainWalletUTxOs);

  while (rollBackers.length > 0) {
    const rollBacker = rollBackers.shift();
    if (!rollBacker) continue;

    const txBuilder = lucid.newTx();
    // collect rollbacker utxos
    txBuilder.collectFrom(rollBacker.utxos);
    // pay to main account
    if (splitMainAccount) {
      splitMainAccount = false;
      currentStepMainAccountLovelace = rollBacker.utxos.reduce(
        (acc, cur) => acc + cur.assets.lovelace,
        0n
      );
    } else {
      currentStepMainAccountLovelace =
        currentStepMainAccountLovelace +
        rollBacker.utxos.reduce((acc, cur) => acc + cur.assets.lovelace, 0n);
    }
    txBuilder.pay.ToAddress(mainAccount.address, {
      lovelace: currentStepMainAccountLovelace,
    });

    const [newWalletUTxOs, _derivedOutputs, txSignBuilder] =
      await txBuilder.chain();
    const txSigned = await txSignBuilder.sign
      .withPrivateKey(privateKey)
      .sign.withPrivateKey(rollBacker.privateKey)
      .complete();
    const txHash = txSigned.toHash();
    const tx: HydraTransaction = {
      cborHex: txSigned.toCBOR(),
      description: "Ledger Cddl Format",
      txId: txHash,
      type: "Tx ConwayEra",
    };

    if (writable) {
      await waitWritable(writable);
      // write to file
      writable.write(
        `${currentTxsCount > 0 ? ",\n" : ""}${JSON.stringify(tx)}`
      );
    } else {
      // save to array
      dummyTxs.push(tx);
    }

    currentUtxosCount = currentUtxosCount - OUTPUT_UTXOS_CHUNK;
    currentTxsCount = currentTxsCount + 1;

    // check current step
    currentStep = currentStep + 1;
    if (currentStep >= stepForOneUtxo) {
      currentStep = 0;
      splitMainAccount = true;
    }
    lucid.overrideUTxOs([newWalletUTxOs[0]]);

    // free memory
    txBuilder.rawConfig().txBuilder.free();
    txSignBuilder.toTransaction().free();
    txSigned.toTransaction().free();
  }

  // write end tags
  if (writable && writable.writable) {
    await waitWritable(writable);
    writable.write(`]}]}`);
    return;
  }

  if (needCommit) {
    return JSON.stringify({
      clientDatasets: [
        {
          initialUTxO: refinedInitialUTxO,
          paymentKey: refinedpaymentKey,
          txSequence: dummyTxs,
        },
      ],
    });
  } else {
    return JSON.stringify({
      clientDatasets: [
        {
          txSequence: dummyTxs,
        },
      ],
    });
  }
};

export { generateLargeUTxOs };
export type { GenerateLargeUTxOsConfig };
