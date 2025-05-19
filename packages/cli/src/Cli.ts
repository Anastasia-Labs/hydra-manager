import * as Command from "@effect/cli/Command";
import { balanceCommand, balancesCommand, closeCommand, fanoutCommand, initCommand, utxosAllCommand, utxosCommand } from "./Command.js";

const command = Command.make("hydra-manager");

export const runCommands = Command.run(
  command.pipe(
    Command.withSubcommands([initCommand, closeCommand, fanoutCommand, utxosCommand, utxosAllCommand, balanceCommand, balancesCommand]),
  ),
  {
    name: "Hydra Manager",
    version: "0.1.0",
  },
);
