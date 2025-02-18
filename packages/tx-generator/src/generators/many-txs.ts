import { Writable } from "node:stream";

import {
  Data,
  Emulator,
  EmulatorAccount,
  Lucid,
  Network,
  paymentCredentialOf,
  PROTOCOL_PARAMETERS_DEFAULT,
  UTxO,
  validatorToAddress,
} from "@lucid-evolution/lucid";

import { HydraTransaction } from "../types.js";
import {
  createAlwaysSuccessScript,
  getPrivateKeyCborHex,
  getPublicKeyHashFromPrivateKey,
  parseUnknownKeytoBech32PrivateKey,
  serializeAssets,
  waitWritable,
} from "./utils.js";

interface GenerateManyTxsConfig {
  network: Network;
  initialUTxO: UTxO;
  needCommit?: boolean;
  txsCount: number;
  walletSeedOrPrivateKey: string;
  writable?: Writable;
  hasSmartContract?: boolean;
}

const generateManyTxs = async (config: GenerateManyTxsConfig) => {
  const {
    network,
    initialUTxO,
    needCommit = true,
    txsCount,
    walletSeedOrPrivateKey,
    writable,
    hasSmartContract,
  } = config;

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

  // make dummy validator
  const alwaysSuccessScript = createAlwaysSuccessScript();
  const alwaysSuccessScriptAddress = validatorToAddress(
    network,
    alwaysSuccessScript
  );

  // make emulator and lucid with initial utxo
  const account: EmulatorAccount = {
    seedPhrase: "",
    address: initialUTxO.address,
    assets: initialUTxO.assets,
    privateKey,
  };
  const emulator = new Emulator([account]);
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

  // select wallet
  lucid.selectWallet.fromAddress(initialUTxO.address, [initialUTxO]);

  // generate dummy transactions
  const dummyTxs: HydraTransaction[] = [];
  for (let i = 0; i < txsCount; i++) {
    const type = hasSmartContract
      ? Math.random() * 10 > 5
        ? "contract"
        : "transfer"
      : "transfer";

    if (type === "transfer") {
      const txBuilder = lucid.newTx();
      const [newWalletUTxOs, _, txSignBuilder] = await txBuilder.pay
        .ToAddress(initialUTxO.address, initialUTxO.assets)
        .chain();
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
        writable.write(`${i > 0 ? ",\n" : ""}${JSON.stringify(tx)}`);
      } else {
        // save to array
        dummyTxs.push(tx);
      }

      // overrid utxos
      lucid.overrideUTxOs(newWalletUTxOs);

      // free memory
      txBuilder.rawConfig().txBuilder.free();
      txSignBuilder.toTransaction().free();
      txSigned.toTransaction().free();
    } else {
      // smart contract interaction
      const lockTxBuilder = lucid.newTx();
      const [newWalletUTxOs1, derivedOutputs1, lockTxSignBuilder] =
        await lockTxBuilder.pay
          .ToAddress(alwaysSuccessScriptAddress, {
            lovelace: 5_000_000n,
          })
          .chain();
      const lockTxSigned = await lockTxSignBuilder.sign
        .withPrivateKey(privateKey)
        .complete();
      const lockTxHash = lockTxSigned.toHash();
      const lockTx: HydraTransaction = {
        cborHex: lockTxSigned.toCBOR(),
        description: "Ledger Cddl Format",
        txId: lockTxHash,
        type: "Tx ConwayEra",
      };

      // free memory
      lockTxBuilder.rawConfig().txBuilder.free();
      lockTxSignBuilder.toTransaction().free();
      lockTxSigned.toTransaction().free();

      if (writable) {
        await waitWritable(writable);
        // write to file
        writable.write(`${i > 0 ? ",\n" : ""}${JSON.stringify(lockTx)}`);
      } else {
        // save to array
        dummyTxs.push(lockTx);
      }

      // override utxos
      lucid.overrideUTxOs(newWalletUTxOs1);
      const lockedUtxo = derivedOutputs1[0];

      const spendTxBuilder = lucid.newTx();
      const [newWalletUTxOs2, _, spendTxSignBuilder] = await spendTxBuilder
        .collectFrom([lockedUtxo], Data.void())
        .attach.SpendingValidator(alwaysSuccessScript)
        .pay.ToAddress(initialUTxO.address, initialUTxO.assets)
        .chain();
      const spendTxSigned = await spendTxSignBuilder.sign
        .withPrivateKey(privateKey)
        .complete();
      const spendTxHash = spendTxSigned.toHash();
      const spendTx: HydraTransaction = {
        cborHex: spendTxSigned.toCBOR(),
        description: "Ledger Cddl Format",
        txId: spendTxHash,
        type: "Tx ConwayEra",
      };

      // overrid utxos
      lucid.overrideUTxOs(newWalletUTxOs2);

      // free memory
      spendTxBuilder.rawConfig().txBuilder.free();
      spendTxSignBuilder.toTransaction().free();
      spendTxSigned.toTransaction().free();

      if (writable) {
        await waitWritable(writable);
        // write to file
        writable.write(`${i > 0 ? ",\n" : "\n"}${JSON.stringify(spendTx)}`);
      } else {
        // save to array
        dummyTxs.push(spendTx);
      }
    }

    // to give garbage collector time to free memory
    if (i % 1000 == 0)
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 100));
  }

  // write end tags
  if (writable) {
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

export { generateManyTxs };
export type { GenerateManyTxsConfig };
