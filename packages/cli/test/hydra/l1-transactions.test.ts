import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import { getHydraContracts } from "@hydra-manager/cli/hydra/l1/index"
import type { CloseDatum, InitialDatum, OpenDatum } from "@hydra-manager/cli/hydra/l1/plutus"
import { getHeadStateDatum, HeadStateDatum } from "@hydra-manager/cli/hydra/l1/plutus"
import { getAllActiveHydraHeads, getMyActiveHydraHeads } from "@hydra-manager/cli/hydra/l1/query"
import { createCloseOpenHeadTransaction, createFanOutTransaction } from "@hydra-manager/cli/hydra/l1/transaction"
import { type HydraContracts } from "@hydra-manager/cli/hydra/l1/types"
import { getCardanoProvider } from "@hydra-manager/cli/utils"
import { Data } from "@lucid-evolution/lucid"

describe("Hydra L1", () => {
  it("Get Hydra contracts from layer 1", async () => {
    const hydraContracts = await getHydraContracts()
    expectTypeOf(hydraContracts).toMatchTypeOf<HydraContracts>()

    expect(hydraContracts.initialScriptAddress).toBeDefined()
    expect(hydraContracts.commitScriptAddress).toBeDefined()
    expect(hydraContracts.headScriptAddress).toBeDefined()
  })

  describe("Plutus types", () => {
    it("Decode initial state datum", () => {
      const datum =
        "d8799fd8799f19ea60ff9f5820691266bf6b75fca26560fa2fbd773a8a843620ecff8642159a9ed81d9f3e8aac582026b369f2c0da120518a5af71521fa8cad0e811f93f62f740d5e4d16e434381205820bdd5ddac85fa0a8b014206fdbdd219c18fc3e25fd016bc5de4ed61b63e7c6d5d582021e080663936ebf220c6591ef06127196b0da4d93e08b820b2b3ae29a9cfa7cc582076e104d0a46f471e6fce238d4621bbf4c38c01ae0c76c7acc1605a6fd2cf62edff581c23793dfdc7c407a269ac9142016154e290a489b7c504bfbd9a497438d8799f5820ee53e9ab824f85688abf5af64cefdf3c40b307554e545efc6282730a539d140301ffff"

      const decoded = getHeadStateDatum(datum) as InitialDatum
      console.log(decoded)
      expect(decoded).toBeDefined()
      expect(decoded.Initial).toBeDefined()
    })
    it("Decode open state datum", () => {
      const datum =
        "d87a9fd8799f581cf9ffc58fd230767c74faf0d12007e5ddfba85ac7e03109c424aacc1b9f5820691266bf6b75fca26560fa2fbd773a8a843620ecff8642159a9ed81d9f3e8aac582026b369f2c0da120518a5af71521fa8cad0e811f93f62f740d5e4d16e434381205820bdd5ddac85fa0a8b014206fdbdd219c18fc3e25fd016bc5de4ed61b63e7c6d5d582021e080663936ebf220c6591ef06127196b0da4d93e08b820b2b3ae29a9cfa7cc582076e104d0a46f471e6fce238d4621bbf4c38c01ae0c76c7acc1605a6fd2cf62edffd8799f19ea60ff005820d1e25f442b0a12131a0a6e14db9b9b4644a617d5099841eb57ac417ab178a726ffff"

      const decoded = getHeadStateDatum(datum) as OpenDatum
      expect(decoded).toBeDefined()
      expect(decoded.Open).toBeDefined()
    })
    it("Decode closed state datum", () => {
      const datum =
        "d87b9fd8799f581c23793dfdc7c407a269ac9142016154e290a489b7c504bfbd9a4974389f5820691266bf6b75fca26560fa2fbd773a8a843620ecff8642159a9ed81d9f3e8aac582026b369f2c0da120518a5af71521fa8cad0e811f93f62f740d5e4d16e434381205820bdd5ddac85fa0a8b014206fdbdd219c18fc3e25fd016bc5de4ed61b63e7c6d5d582021e080663936ebf220c6591ef06127196b0da4d93e08b820b2b3ae29a9cfa7cc582076e104d0a46f471e6fce238d4621bbf4c38c01ae0c76c7acc1605a6fd2cf62edffd8799f19ea60ff00035820d1e25f442b0a12131a0a6e14db9b9b4644a617d5099841eb57ac417ab178a7265820e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8555820e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855801b0000019517560808ffff"

      const decoded = getHeadStateDatum(datum) as CloseDatum
      expect(decoded).toBeDefined()
      expect(decoded.Closed).toBeDefined()
    })
  })

  it("Get all active hydra heads", async () => {
    const activeHeads = await getAllActiveHydraHeads()
    // console.log(activeHeads)
    for (const utxo of activeHeads) {
      const datum = Data.from(utxo.datum!, HeadStateDatum)
      // console.log(datum)
      expect(datum).toBeDefined()
    }
  })

  it("Get my active hydra heads", async () => {
    const myActiveHeads = await getMyActiveHydraHeads()
    // console.log(myActiveHeads)
    for (const utxo of myActiveHeads) {
      const datum = Data.from(utxo.datum!, HeadStateDatum)
      console.log(datum)
      expect(datum).toBeDefined()
    }
  })
  describe("Transactions", () => {
    it("Create close open head transaction", async () => {
      const headUtxo =
        (await getMyActiveHydraHeads()).filter((utxo) =>
          (getHeadStateDatum(utxo.datum!) as OpenDatum).Open !== undefined
        )[0]

      console.log(headUtxo)

      const tx = await createCloseOpenHeadTransaction(headUtxo)
      console.log(tx)

      const provider = getCardanoProvider()
      const txHash = await provider.submitTx(tx)
      console.log(txHash)
      await provider.awaitTx(txHash)
      console.log("Transaction submitted")
    })

    it("Create fan out transaction", async () => {
      const headUtxo =
        (await getMyActiveHydraHeads()).filter((utxo) =>
          (getHeadStateDatum(utxo.datum!) as CloseDatum).Closed !== undefined
        )[0]

      const tx = await createFanOutTransaction(headUtxo)

      console.log(tx)

      const provider = getCardanoProvider()
      const txHash = await provider.submitTx(tx)
      console.log(txHash)
      await provider.awaitTx(txHash)
      console.log("Transaction submitted")
    })
  })
})
