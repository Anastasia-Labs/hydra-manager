// Import necessary modules from the libraries
import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { serveCommand } from "./Serve.js";

// Define the top-level command
const command = Command.make("hydra-manager-pod-node", {}, () => Effect.void);

// Set up the CLI application
const cli = Command.run(command.pipe(Command.withSubcommands([serveCommand])), {
  name: "Hydra Manager Pod Node",
  version: "v1.0.0",
});

// Prepare and run the CLI application
cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
