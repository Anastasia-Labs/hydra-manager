import { BlockFrostAPI } from "@blockfrost/blockfrost-js"
import type { Provider } from "@lucid-evolution/lucid"
import { Blockfrost, Koios } from "@lucid-evolution/lucid"
import config from "./cli/config.js"

let cardanoProvider: Provider | undefined

export function getCardanoProvider() {
  if (cardanoProvider === undefined) {
    if (config.blockfrostProjectId !== undefined) {
      cardanoProvider = new Blockfrost(
        `https://cardano-${config.network.toLocaleLowerCase()}.blockfrost.io/api/v0`,
        config.blockfrostProjectId
      )
    } else {
      cardanoProvider = new Koios(`https://${config.network.toLocaleLowerCase()}.koios.rest/api/v1`)
    }
  }
  return cardanoProvider
}

export function getBlockfrostAPI() {
  if (config.blockfrostProjectId === undefined) {
    throw new Error("Blockfrost project id not found in config file")
  }
  return new BlockFrostAPI({
    projectId: config.blockfrostProjectId
  })
}
