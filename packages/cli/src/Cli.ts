import * as Command from "@effect/cli/Command";
import { balancesCommand, closeCommand, fanoutCommand, initCommand } from "./Command.js";

const command = Command.make("hydra-manager");

export const runCommands = Command.run(
  command.pipe(
    Command.withSubcommands([initCommand, closeCommand, fanoutCommand, balancesCommand]),
  ),
  {
    name: "Hydra Manager",
    version: "0.1.0",
  },
);
