import { getCardanoProvider } from "@hydra-manager/cli/utils"
import { getHydraHeadPubkeys } from "../utils.js"
import { getHydraContracts } from "./index.js"
import { getHeadStateDatum } from "./plutus.js"

export async function getAllActiveHydraHeads() {
  const provider = getCardanoProvider()
  const contracts = await getHydraContracts()

  const activeHeads = await provider.getUtxos(contracts.headScriptAddress)

  return activeHeads
}

export async function getMyActiveHydraHeads() {
  const headsUTxOs = await getAllActiveHydraHeads()

  return headsUTxOs.filter((utxo) => {
    if (!utxo.datum) {
      return false
    }

    const decoded = getHeadStateDatum(utxo.datum) as any

    let parties: Array<string>
    if (decoded.Initial !== undefined) {
      parties = decoded.Initial.parties
    } else if (decoded.Open !== undefined) {
      parties = decoded.Open.openDatum.parties
    } else if (decoded.Closed !== undefined) {
      parties = decoded.Closed.closeDatum.parties
    } else {
      parties = []
    }

    return parties.some((party) => getHydraHeadPubkeys().includes(party))
  })
}
