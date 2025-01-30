import * as Command from "@effect/cli/Command"
import { interactiveCommand as interactiveCommand } from "./cli/interactive/index.js"

const command = Command.make("hydra-manager")

export const run = Command.run(command.pipe(Command.withSubcommands([interactiveCommand])), {
  name: "Hydra Manager",
  version: "0.1.0"
})
