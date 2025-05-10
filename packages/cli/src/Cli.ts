import * as Command from "@effect/cli/Command"
import { cronCommand } from "./cli/cron/index.js"
import { interactiveCommand as interactiveCommand } from "./cli/interactive/index.js"
import { initCommand } from "./cli/init/index.js"
import { l1Command } from "./cli/l1/index.js"
import { closeCommand } from "./cli/close/index.js"
import { fanoutCommand } from "./cli/fanout/index.js"

const command = Command.make("hydra-manager")

export const runCommands = Command.run(command.pipe(Command.withSubcommands([interactiveCommand
                                                                            , initCommand
                                                                            , closeCommand
                                                                            , fanoutCommand
                                                                            , cronCommand
                                                                            , l1Command
                                                                            ])), {
  name: "Hydra Manager",
  version: "0.1.0"
})


