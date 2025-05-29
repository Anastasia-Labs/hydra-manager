import { defineConfig } from "tsup";
import { createWasmEmbedPlugin } from "./wasm-embed.js";

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["cjs"],
  platform: "node", // Added to specify Node.js environment
  shims: true, // Added to provide CJS context shims like __dirname
  clean: true, // Clean the output directory before building
  bundle: true, // This is true by default, but good to be explicit
  minify: true, // Minify the output for smaller size
  noExternal: [/.*/], // Bundle all dependencies
  splitting: false, // Prevent code splitting to ensure a single output file
  treeshake: "recommended",
  esbuildPlugins: [
    createWasmEmbedPlugin({
      packages: [
        "@anastasia-labs/cardano-multiplatform-lib-nodejs",
        "@lucid-evolution/uplc",
        "@emurgo/cardano-message-signing-nodejs",
      ],
      debug: true,
      compress: true, // Enable compression for smaller bundle size
    }),
  ],
});
