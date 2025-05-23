import * as Command from "@effect/cli/Command";
import {
  nodeBalanceCommand,
  closeCommand,
  fanoutCommand,
  initCommand,
  nodeUtxosCommand,
  commitCommand,
  faucetWalletBalanceCommand,
  faucetWalletUtxosCommand,
  statusCommand,
  nodeSnapshotUtxosCommand,
  protocolParametersCommand,
} from "./Command.js";

const command = Command.make("hydra-manager");

export const runCommands = Command.run(
  command.pipe(
    Command.withSubcommands([
      statusCommand,
      protocolParametersCommand,
      initCommand,
      closeCommand,
      fanoutCommand,
      commitCommand,
      nodeSnapshotUtxosCommand,
      nodeUtxosCommand,
      nodeBalanceCommand,
      faucetWalletUtxosCommand,
      faucetWalletBalanceCommand,
    ]),
  ),
  {
    name: "Hydra Manager",
    version: "0.1.0",
  },
);
