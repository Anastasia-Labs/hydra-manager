import { Effect } from "effect";
import { Node } from "./Node.js";
import { UTxO } from "@lucid-evolution/core-types";
import {
  tryPromiseWithErrorHandling,
  tryWithErrorHandling,
} from "../utils/ErrorHandling.js";

/**
 * Creates a Node wrapper with Effect-based methods
 */
export class NodeWrapper {
  private node: Node;

  /**
   * Creates a new NodeWrapper instance
   * @param url The URL of the Hydra node
   */
  constructor(url: string) {
    this.node = new Node(url);
  }

  /**
   * Connect to the Hydra node
   */
  connect = () =>
    tryPromiseWithErrorHandling(
      () => this.node.connect(),
      "connecting to the node",
    );

  /**
   * Initialize the Hydra Head
   */
  initialize = () =>
    tryPromiseWithErrorHandling(
      () => this.node.initialize(),
      "initializing the Hydra head",
    );

  /**
   * Commit UTxOs to the Hydra Head
   */
  commit = (utxos: UTxO[] = [], blueprintTx?: string) =>
    tryPromiseWithErrorHandling(
      () => this.node.commit(utxos, blueprintTx),
      "committing UTxOs",
    );

  /**
   * Send a transaction to the Cardano network
   */
  cardanoTransaction = (transaction: any) =>
    tryPromiseWithErrorHandling(
      () => this.node.cardanoTransaction(transaction),
      "sending transaction to Cardano",
    );

  /**
   * Get the current UTxO snapshot from the Hydra Head
   */
  snapshotUTxO = () =>
    tryPromiseWithErrorHandling(
      () => this.node.snapshotUTxO(),
      "retrieving UTxO snapshot",
      [
        {
          condition: (error) => error.name === "SyntaxError",
          message: "Error parsing snapshot UTxO response",
        },
      ],
    );

  /**
   * Get the protocol parameters from the node
   */
  protocolParameters = () =>
    tryPromiseWithErrorHandling(
      () => this.node.protocolParameters(),
      "retrieving protocol parameters",
      [
        {
          condition: (error) => error.name === "SyntaxError",
          message: "Error parsing protocol parameters response",
        },
      ],
    );

  /**
   * Send a new transaction to the Hydra Head
   */
  newTx = (transaction: any) =>
    tryPromiseWithErrorHandling(
      () => this.node.newTx(transaction),
      "sending new transaction",
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
   * Wait for a transaction to be confirmed
   */
  awaitTx = (txHash: string, checkInterval?: number) =>
    tryPromiseWithErrorHandling(
      () => this.node.awaitTx(txHash, checkInterval),
      `awaiting transaction ${txHash}`,
    );

  /**
   * Close the Hydra Head
   */
  close = () =>
    tryPromiseWithErrorHandling(() => this.node.close(), "closing Hydra head", [
      {
        condition: (error) => error.message.includes("Command Close failed"),
        message: "Error closing Hydra head: Close command failed",
      },
    ]);

  /**
   * Initiate the fanout process to move funds back to Cardano
   */
  fanout = () =>
    tryPromiseWithErrorHandling(
      () => this.node.fanout(),
      "during fanout process",
      [
        {
          condition: (error) => error.message.includes("Command Fanout failed"),
          message: "Error during fanout: Fanout command failed",
        },
        {
          condition: (error) =>
            error.message.includes(
              "Error posting transaction for command Fanout",
            ),
          message: "Error during fanout: Failed to post transaction on-chain",
        },
      ],
    );

  /**
   * Get the current status of the Hydra Head
   */
  getStatus = () =>
    tryWithErrorHandling(
      () => this.node.getStatus(),
      "getting Hydra head status",
    );

  /**
   * Get the URL of the Hydra node
   */
  getUrl = () =>
    tryWithErrorHandling(() => this.node.getUrl(), "getting node URL");

  /**
   * Get the underlying Node instance
   */
  getNodeInstance = () => Effect.succeed(this.node);
}
