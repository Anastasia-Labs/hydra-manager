const TARGETS = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-arm64",
  "bun-linux-x64",
  "bun-windows-x64",
];

// List of packages that need to be external
// Keep only the packages that are actually in package.json dependencies
const EXTERNAL_PACKAGES = [
  "@effect/platform",
  "@effect/platform-node",
  "@lucid-evolution/core-types",
  "@lucid-evolution/lucid",
  "@lucid-evolution/utils",
  "@effect/cli",
  "effect",
  "ws",
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
