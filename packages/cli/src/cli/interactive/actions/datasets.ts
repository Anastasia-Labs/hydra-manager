import type { Action } from "@hydra-manager/cli/cli/interactive/types"
import { selectedUTxOs, selectParticipant } from "@hydra-manager/cli/cli/interactive/utils"
import { processDataset } from "@hydra-manager/cli/dataset/index"
import type { HydraHead } from "@hydra-manager/cli/hydra/head"
import { getParticipantPrivateKey } from "@hydra-manager/cli/hydra/utils"
import type { GenerateLargeUTxOsConfig, GenerateManyTxsConfig } from "@hydra-manager/tx-generator"
import { generateLargeUTxOs, generateManyTxs } from "@hydra-manager/tx-generator"
import { number } from "@inquirer/prompts"
import type { UTxO } from "@lucid-evolution/lucid"
import { addAssets } from "@lucid-evolution/lucid"
import * as fs from "fs"
import ora from "ora-classic"
import os from "os"
import path from "path"

import { select } from "inquirer-select-pro"

export const processDatasetAction: Action = {
  name: "Process Dataset",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const spinner = ora("Processing dataset")
    try {
      // Select dataset file
      const datasetFile = await select({
        message: "Select dataset file to process",
        multiple: false,
        required: true,
        options: fs.readdirSync("./datasets").filter((file) => file.endsWith(".json")).map((file) => ({
          name: file,
          value: file
        }))
      })
      await processDataset(hydraHead, datasetFile!, spinner)
    } catch (error) {
      spinner.fail("Failed to process dataset")
      throw error
    }
  }
}

export const processNewLargeUTxosDatasetAction: Action = {
  name: "Process New Large UTxOs Dataset",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const spinner = ora("Processing new large UTxOs dataset")
    try {
      const tmpDir = os.tmpdir()
      const tmpFilePath = path.join(tmpDir, `new-large-utxos-${Date.now()}.json`)
      const writable = fs.createWriteStream(tmpFilePath)

      const participant = await selectParticipant(hydraHead)
      const privateKey = await getParticipantPrivateKey(participant + "-funds")
      const initialUTxOs = await selectedUTxOs(hydraHead, participant)
      const totalAssets = addAssets(...initialUTxOs.map((utxo: UTxO) => utxo.assets))

      const utxosCount = await number({
        message: "Number of UTxOs to generate",
        default: 100,
        min: 20,
        max: Math.floor(Number((totalAssets.lovelace - 1000000n) / 1000000n)),
        required: true
      })

      const finalUtxosCount = await number({
        message: "Number of final UTxOs",
        default: 1,
        min: 1,
        max: 100,
        required: true
      })

      const transactionCount = await number({
        message: "Number of transactions to generate",
        default: 1000,
        min: 1,
        required: true
      })

      const config: GenerateLargeUTxOsConfig = {
        network: "Preprod",
        initialUTxO: initialUTxOs[0],
        utxosCount: utxosCount!,
        finalUtxosCount: finalUtxosCount!,
        transactionCount: transactionCount!,
        walletSeedOrPrivateKey: privateKey,
        writable
      }

      await generateLargeUTxOs(config, spinner)
      await processDataset(hydraHead, tmpFilePath, spinner)
    } catch (error) {
      spinner.fail("Failed to process new large UTxOs dataset")
      throw error
    }
  }
}

export const processManyTransactionsDatasetAction: Action = {
  name: "Process Many Transactions Dataset",
  value: async (hydraHead: HydraHead): Promise<void> => {
    const spinner = ora("Processing many transactions dataset")
    try {
      const tmpDir = os.tmpdir()
      const tmpFilePath = path.join(tmpDir, `many-transactions-${Date.now()}.json`)
      const writable = fs.createWriteStream(tmpFilePath)

      const participant = await selectParticipant(hydraHead)
      const privateKey = await getParticipantPrivateKey(participant + "-funds")
      const initialUTxOs = await selectedUTxOs(hydraHead, participant)

      const transactionCount = await number({
        message: "Number of transactions to generate",
        default: 1000,
        min: 1,
        required: true
      })

      const config: GenerateManyTxsConfig = {
        network: "Preprod",
        initialUTxO: initialUTxOs[0],
        txsCount: transactionCount!,
        walletSeedOrPrivateKey: privateKey,
        writable,
        hasSmartContract: false
      }

      await generateManyTxs(config)
      await processDataset(hydraHead, tmpFilePath, spinner)
    } catch (error) {
      spinner.fail("Failed to process many transactions dataset")
      throw error
    }
  }
}
