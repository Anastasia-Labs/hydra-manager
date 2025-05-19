import * as Command from "@effect/cli/Command";
import { balanceCommand, closeCommand, fanoutCommand, initCommand, utxosCommand } from "./Command.js";

const command = Command.make("hydra-manager");

export const runCommands = Command.run(
  command.pipe(
    Command.withSubcommands([initCommand, closeCommand, fanoutCommand, utxosCommand, balanceCommand]),
  ),
  {
    name: "Hydra Manager",
    version: "0.1.0",
  },
);
