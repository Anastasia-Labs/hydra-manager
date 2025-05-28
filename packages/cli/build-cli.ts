/**
 * CLI Build Script with Generic WASM File Discovery
 * 
 * This script automatically discovers and embeds WASM files from specified packages
 * into the CLI bundle, eliminating the need to hardcode file paths.
 * 
 * Usage:
 * - Normal build: bun build-cli.ts
 * - Debug mode (shows all packages with WASM): DEBUG_WASM=1 bun build-cli.ts
 * - Auto-discover all WASM files: Set AUTO_DISCOVER_ALL_WASM = true
 * 
 * To add new WASM packages:
 * 1. Add the package name to WASM_PACKAGES array, OR
 * 2. Call addWasmPackage("package-name") before build(), OR
 * 3. Set AUTO_DISCOVER_ALL_WASM = true (may include extra files)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, rmSync } from "fs";
import { resolve, join, basename } from "path";

// Build targets for different platforms
const TARGETS = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-arm64",
  "bun-linux-x64-modern",
  "bun-windows-x64",
];

// Packages that contain WASM files we need
// These are automatically scanned for .wasm files and embedded in the bundle
const WASM_PACKAGES = [
  "@anastasia-labs/cardano-multiplatform-lib-nodejs",
  "@lucid-evolution/uplc",
  "@emurgo/cardano-message-signing-nodejs",
];

// Set to true to automatically discover WASM files from all installed packages
// Warning: This may include unnecessary WASM files and increase bundle size
const AUTO_DISCOVER_ALL_WASM = false;

/**
 * Add a package to the WASM discovery list
 */
function addWasmPackage(packageName: string): void {
  if (!WASM_PACKAGES.includes(packageName)) {
    WASM_PACKAGES.push(packageName);
    console.log(`➕ Added ${packageName} to WASM discovery list`);
  }
}

/**
 * Discover all packages that contain WASM files (for debugging)
 */
function findPackagesWithWasm(): string[] {
  const packages: string[] = [];
  const nodeModulesPath = resolve("../../node_modules");
  
  try {
    const entries = readdirSync(nodeModulesPath);
    
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      
      const packagePath = join(nodeModulesPath, entry);
      const stat = statSync(packagePath);
      
      if (stat.isDirectory()) {
        const wasmFiles = findWasmFiles(packagePath);
        if (wasmFiles.length > 0) {
          packages.push(entry);
        }
      }
    }
  } catch (error) {
    console.warn("Could not scan node_modules for packages with WASM files");
  }
  
  return packages;
}

const TEMP_DIR = "./temp";
const OUT_DIR = "./out";

/**
 * Recursively finds all WASM files in a directory
 */
function findWasmFiles(dir: string): string[] {
  const wasmFiles: string[] = [];
  
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        wasmFiles.push(...findWasmFiles(fullPath));
      } else if (stat.isFile() && entry.endsWith('.wasm')) {
        wasmFiles.push(fullPath);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read, skip it
  }
  
  return wasmFiles;
}

/**
 * Discovers WASM files from the specified packages
 */
function discoverWasmFiles(): Record<string, string> {
  const wasmFiles: Record<string, string> = {};
  
  if (AUTO_DISCOVER_ALL_WASM) {
    // Discover WASM files from all node_modules
    console.log("🔍 Auto-discovering WASM files from all packages...");
    const nodeModulesPath = resolve("../../node_modules");
    const allWasmFiles = findWasmFiles(nodeModulesPath);
    
    for (const wasmPath of allWasmFiles) {
      const fileName = basename(wasmPath);
      const relativePath = wasmPath.replace(resolve("../../"), "../../");
      
      // Skip esbuild and other build tool WASM files
      if (!wasmPath.includes('esbuild') && 
          !wasmPath.includes('source-map') && 
          !wasmPath.includes('dprint')) {
        if (!wasmFiles[fileName] || 
            wasmPath.includes('/node/') || 
            wasmPath.includes('nodejs')) {
          wasmFiles[fileName] = relativePath;
          console.log(`📦 Auto-discovered WASM file: ${fileName}`);
        }
      }
    }
  } else {
    // Discover WASM files from specified packages only
    for (const packageName of WASM_PACKAGES) {
      const packagePath = resolve(`../../node_modules/${packageName}`);
      const foundWasmFiles = findWasmFiles(packagePath);
      
      for (const wasmPath of foundWasmFiles) {
        const fileName = basename(wasmPath);
        const relativePath = wasmPath.replace(resolve("../../"), "../../");
        
        // Prefer nodejs versions over browser versions, and prefer specific paths
        if (!wasmFiles[fileName] || 
            wasmPath.includes('/node/') || 
            wasmPath.includes('nodejs')) {
          wasmFiles[fileName] = relativePath;
          console.log(`📦 Found WASM file: ${fileName} in ${packageName}`);
        }
      }
    }
  }
  
  return wasmFiles;
}

/**
 * Reads a WASM file and converts it to base64 string
 */
function getWasmAsBase64(wasmPath: string): string {
  try {
    const fullPath = resolve(wasmPath);
    const wasmBuffer = readFileSync(fullPath);
    return wasmBuffer.toString("base64");
  } catch (error) {
    console.warn(`Warning: Could not read WASM file at ${wasmPath}`);
    return "";
  }
}

/**
 * Creates the entry file template with embedded WASM data
 */
function generateEntryTemplate(wasmData: Record<string, string>): string {
  return `
// Auto-generated entry file with embedded WASM data
const originalReadFileSync = require('fs').readFileSync;
const pathModule = require('path');

// Embedded WASM files as base64
const embeddedWasm = ${JSON.stringify(wasmData, null, 2)};

// Patch fs.readFileSync to return embedded WASM data when requested
require('fs').readFileSync = function(filePath, options) {
  const fileName = pathModule.basename(filePath);
  if (embeddedWasm[fileName]) {
    return Buffer.from(embeddedWasm[fileName], 'base64');
  }
  return originalReadFileSync.call(this, filePath, options);
};

// Import the main application
require('../src/bin.ts');
`;
}

/**
 * Creates directories if they don't exist
 */
function ensureDirectories(): void {
  [TEMP_DIR, OUT_DIR].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Cleans up the temporary directory
 */
function cleanupTempDirectory(): void {
  try {
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
      console.log("🧹 Cleaned up temporary files");
    }
  } catch (error) {
    console.warn(`Warning: Could not clean up temp directory: ${error}`);
  }
}

/**
 * Creates a temporary entry file with embedded WASM data
 */
function createEntryFileWithEmbeddedWasm(): string {
  console.log("📦 Discovering and embedding WASM files...");
  
  const wasmFiles = discoverWasmFiles();
  const wasmData: Record<string, string> = {};
  
  for (const [fileName, filePath] of Object.entries(wasmFiles)) {
    const base64Data = getWasmAsBase64(filePath);
    if (base64Data) {
      wasmData[fileName] = base64Data;
      console.log(`  ✓ Embedded ${fileName}`);
    }
  }

  const entryContent = generateEntryTemplate(wasmData);
  const tempEntryPath = `${TEMP_DIR}/entry-with-wasm.ts`;
  
  writeFileSync(tempEntryPath, entryContent);
  console.log(`✓ Created entry file: ${tempEntryPath}`);
  
  return tempEntryPath;
}

/**
 * Builds a bundle for the given target
 */
async function buildBundle(entryFile: string, target: string): Promise<void> {
  const bundleCommand = [
    "bun",
    "build",
    entryFile,
    "--target",
    "node",
    "--format",
    "cjs",
    "--outfile",
    `${TEMP_DIR}/bundle-${target}.cjs`,
  ];

  console.log(`📦 Bundling for ${target}...`);
  await Bun.$`${bundleCommand}`;
}

/**
 * Compiles a bundle into a standalone executable
 */
async function compileExecutable(target: string): Promise<void> {
  const platformName = target.replace(/bun-/, "");
  const compileCommand = [
    "bun",
    "build",
    "--compile",
    "--target",
    target,
    "--minify",
    `${TEMP_DIR}/bundle-${target}.cjs`,
    "--outfile",
    `${OUT_DIR}/hydra-manager-${platformName}`,
  ];

  console.log(`🚀 Compiling standalone executable for ${target}...`);
  await Bun.$`${compileCommand}`;
  console.log(`✓ Created executable: hydra-manager-${platformName}`);
}

/**
 * Main build function
 */
async function build(): Promise<void> {
  console.log("🔨 Starting CLI build process...");
  
  // Optional: Show packages with WASM files for debugging
  if (process.env.DEBUG_WASM) {
    console.log("🔍 Packages with WASM files:");
    const packagesWithWasm = findPackagesWithWasm();
    packagesWithWasm.forEach(pkg => console.log(`  - ${pkg}`));
    console.log("");
  }
  
  // Setup directories and entry file
  ensureDirectories();
  const entryFile = createEntryFileWithEmbeddedWasm();

  try {
    // Build for each target
    for (const target of TARGETS) {
      console.log(`\n🎯 Building for ${target}...`);
      
      try {
        await buildBundle(entryFile, target);
        await compileExecutable(target);
      } catch (error) {
        console.error(`❌ Failed to build for ${target}:`, error);
        throw error;
      }
    }

    console.log("\n🎉 Build complete! Check the ./out directory for your executables.");
  } finally {
    // Always clean up temp directory, even if build fails
    cleanupTempDirectory();
  }
}

// Example usage for adding packages dynamically:
// addWasmPackage("@new/package-with-wasm");

// Run the build
build().catch((error) => {
  console.error("❌ Build failed:", error);
  process.exit(1);
});

// Export functions for programmatic usage
export {
  addWasmPackage,
  findPackagesWithWasm,
  discoverWasmFiles,
  cleanupTempDirectory,
  build
};
