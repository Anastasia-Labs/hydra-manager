import * as Command from "@effect/cli/Command"
import { cronCommand } from "./cli/cron/index.js"
import { interactiveCommand as interactiveCommand } from "./cli/interactive/index.js"
import { l1Command } from "./cli/l1/index.js"

const command = Command.make("hydra-manager")

export const run = Command.run(command.pipe(Command.withSubcommands([interactiveCommand, cronCommand, l1Command])), {
  name: "Hydra Manager",
  version: "0.1.0"
})
