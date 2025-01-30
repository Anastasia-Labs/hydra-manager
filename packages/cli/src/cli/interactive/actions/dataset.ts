import { processDataset } from "@template/cli/dataset/index"
import type { HydraHead } from "@template/cli/hydra/head"
import * as fs from "fs"
import ora from "ora-classic"
import type { Action } from "../types.js"

const { select } = require("inquirer-select-pro")

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
      await processDataset(hydraHead, datasetFile, spinner)
    } catch (error) {
      spinner.fail("Failed to process dataset")
      throw error
    }
  }
}
