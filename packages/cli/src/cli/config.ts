import { existsSync, readFileSync } from "fs"
import type { HydraManagerConfig } from "../hydra/types.js"

export function loadConfig() {
  if (!existsSync("./config.json")) {
    throw new Error("Config file not found")
  }

  const configFile = readFileSync("./config.json", "utf-8")
  const config = JSON.parse(configFile)
  console.log(configFile)
  return config as HydraManagerConfig
}

export default loadConfig
