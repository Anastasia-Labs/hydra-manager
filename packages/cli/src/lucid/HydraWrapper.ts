import { Effect } from "effect";
import { Hydra } from "./Hydra.js";
import {
  Address,
  Credential,
  DatumHash,
  Network,
  OutRef,
  RewardAddress,
  Transaction,
  TxHash,
  Unit,
  UTxO,
} from "@lucid-evolution/core-types";
import { tryPromiseWithErrorHandling } from "../utils/ErrorHandling.js";

/**
 * Effect-based wrapper for the Hydra class
 */
export class HydraWrapper {
  private hydra: Hydra;

  /**
   * Creates a new HydraWrapper instance
   * @param url The URL of the Hydra node
   * @param network Optional network identifier
   */
  constructor(url: string, network?: Network) {
    this.hydra = new Hydra(url, network);
  }

  /**
   * Get protocol parameters from the Hydra node
   */
  getProtocolParameters = () =>
    tryPromiseWithErrorHandling(
      () => this.hydra.getProtocolParameters(),
      "retrieving protocol parameters",
      [
        {
          condition: (error) => error.name === "SyntaxError",
          message: "Error parsing protocol parameters response",
        },
      ],
    );

  /**
   * Get UTxOs for a given address or credential
   */
  getUtxos = (addressOrCredential: Address | Credential) =>
    tryPromiseWithErrorHandling(
      () => this.hydra.getUtxos(addressOrCredential),
      "retrieving UTxOs",
      [
        {
          condition: (error) => error.name === "SyntaxError",
          message: "Error parsing UTxOs response",
        },
      ],
    );

  /**
   * Get UTxOs with a specific unit for a given address or credential
   */
  getUtxosWithUnit = (addressOrCredential: Address | Credential, unit: Unit) =>
    tryPromiseWithErrorHandling(
      () => this.hydra.getUtxosWithUnit(addressOrCredential, unit),
      `retrieving UTxOs with unit ${unit}`,
      [
        {
          condition: (error) => error.name === "SyntaxError",
          message: "Error parsing UTxOs with unit response",
        },
      ],
    );

  /**
   * Get a UTxO by its unit (should be an NFT)
   */
  getUtxoByUnit = (unit: Unit) =>
    tryPromiseWithErrorHandling(
      () => this.hydra.getUtxoByUnit(unit),
      `retrieving UTxO by unit ${unit}`,
      [
        {
          condition: (error) =>
            error.message.includes("UTxO with unit not found"),
          message: `UTxO with unit ${unit} not found`,
        },
        {
          condition: (error) => error.message.includes("Unit need to be a NFT"),
          message: `Unit ${unit} must be an NFT (found multiple instances)`,
        },
      ],
    );

  /**
   * Get UTxOs by their OutRefs
   */
  getUtxosByOutRef = (outRefs: Array<OutRef>) =>
    tryPromiseWithErrorHandling(
      () => this.hydra.getUtxosByOutRef(outRefs),
      "retrieving UTxOs by OutRef",
    );

  /**
   * Get delegation information for a reward address (not implemented in Hydra)
   */
  getDelegation = (rewardAddress: RewardAddress) =>
    tryPromiseWithErrorHandling(
      () => this.hydra.getDelegation(rewardAddress),
      `retrieving delegation for ${rewardAddress}`,
      [
        {
          condition: (error) =>
            error.message.includes("Method not implemented"),
          message: "getDelegation is not implemented in Hydra",
        },
      ],
    );

  /**
   * Get datum by its hash (not implemented in Hydra)
   */
  getDatum = (datumHash: DatumHash) =>
    tryPromiseWithErrorHandling(
      () => this.hydra.getDatum(datumHash),
      `retrieving datum ${datumHash}`,
      [
        {
          condition: (error) =>
            error.message.includes("Method not implemented"),
          message: "getDatum is not implemented in Hydra",
        },
      ],
    );

  /**
   * Wait for a transaction to be confirmed
   */
  awaitTx = (txHash: TxHash, checkInterval?: number) =>
    tryPromiseWithErrorHandling(
      () => this.hydra.awaitTx(txHash, checkInterval),
      `awaiting transaction ${txHash}`,
    );

  /**
   * Submit a transaction to the Hydra Head
   */
  submitTx = (tx: Transaction) =>
    tryPromiseWithErrorHandling(
      () => this.hydra.submitTx(tx),
      "submitting transaction",
      [
        {
          condition: (error) =>
            error.message.includes("Transaction is invalid"),
          message: "Invalid transaction: Unable to validate transaction",
        },
        {
          condition: (error) =>
            error.message.includes("Error posting transaction with hash"),
          message: "Transaction submission failed",
        },
      ],
    );

  /**
   * Evaluate a transaction (not implemented in Hydra)
   */
  evaluateTx = (tx: Transaction, additionalUTxOs?: Array<UTxO>) =>
    tryPromiseWithErrorHandling(
      () => this.hydra.evaluateTx(tx, additionalUTxOs),
      "evaluating transaction",
      [
        {
          condition: (error) =>
            error.message.includes("Method not implemented"),
          message: "evaluateTx is not implemented in Hydra",
        },
      ],
    );

  /**
   * Get the underlying Hydra instance
   */
  getHydraInstance = () => Effect.succeed(this.hydra);
}
