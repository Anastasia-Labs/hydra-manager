import { Blockfrost, Lucid, Network, UTxO } from "@lucid-evolution/lucid";
import { CML } from "@lucid-evolution/lucid";
import { config as envConfig } from "dotenv";
import { test } from "vitest";

envConfig(
  {
    path: ".env",
  }
);

envConfig(
  {
    path: "./tests/.test-only-env"
  }
)

const network: Network = "Preprod";
const blockfrostApiKey = process.env.BLOCKFROST_API_KEY!;

const setup = async () => {
  const privateKey = process.env.TEST_WALLET_PRIVATE_KEY_BECH32 ?? CML.PrivateKey.generate_ed25519().to_bech32();

  const blockfrostApi = new Blockfrost(
    `https://cardano-${network.toLowerCase()}.blockfrost.io/api/v0`,
    blockfrostApiKey
  );

  const lucid = await Lucid(blockfrostApi, network);

  if (process.env.TEST_WALLET_PRIVATE_KEY_BECH32 === undefined) {
    const address = CML.EnterpriseAddress.new(network === "Preprod" ? 0 : 1, CML.Credential.new_pub_key(CML.PrivateKey.from_bech32(privateKey).to_public().hash())).to_address().to_bech32();
    
    const mockInitialUtxo: UTxO = {
      address,
      txHash: "0000000000000000000000000000000000000000000000000000000000000000",
      outputIndex: 0,
      assets: {
        "lovelace": 1_000_000_000_000n
      }
    }
    lucid.selectWallet.fromAddress(address, [mockInitialUtxo]);
  } else {
    lucid.selectWallet.fromPrivateKey(privateKey);
  }

  return { blockfrostApi, network, privateKey, lucid };
};

const myTest = test.extend(await setup());

export { myTest };
