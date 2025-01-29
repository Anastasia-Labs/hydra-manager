import * as Command from "@effect/cli/Command"
import { manualCommand } from "./cli/manual/index.js"

const command = Command.make("hydra-manager")

export const run = Command.run(command.pipe(Command.withSubcommands([manualCommand])), {
  name: "Hydra Manager",
  version: "0.1.0"
})
