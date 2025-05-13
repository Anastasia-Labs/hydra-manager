const TARGETS = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-arm64",
  "bun-linux-x64",
  "bun-windows-x64",
];

// List of packages that need to be external
const EXTERNAL_PACKAGES = [
  "@lucid-evolution/uplc",
  "@emurgo/cardano-message-signing-nodejs",
];

for (const target of TARGETS) {
  console.log(`✅ Compiling CLI for ${target}`);

  // Create the base command
  const command = [
    "bun",
    "build",
    "--compile",
    "--minify",
    "--target",
    target,
    "./src/bin.ts",
    "--outfile",
    `./out/hydra-manager-${target.replace(/bun-/, "")}`,
  ];

  for (const pkg of EXTERNAL_PACKAGES) {
    command.push("--external", pkg);
  }

  // Run the command
  await Bun.$`${command}`;
}
