import { defineConfig } from "tsup";
import { wasmLoader } from "esbuild-plugin-wasm";
import path from 'path';
import fs from 'fs';

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
 * Recursively finds all WASM files in a directory
 */
function findWasmFiles(dir: string): string[] {
  const wasmFiles: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      
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
    const nodeModulesPath = path.resolve(__dirname, "../../node_modules");
    const allWasmFiles = findWasmFiles(nodeModulesPath);
    
    for (const wasmPath of allWasmFiles) {
      const fileName = path.basename(wasmPath);
      const relativePath = path.relative(path.resolve(__dirname, "../.."), wasmPath);
      
      // Skip esbuild and other build tool WASM files
      if (!wasmPath.includes('esbuild') && 
          !wasmPath.includes('source-map') && 
          !wasmPath.includes('dprint')) {
        if (!wasmFiles[fileName] || 
            wasmPath.includes('/node/') || 
            wasmPath.includes('nodejs')) {
          wasmFiles[fileName] = `../../${relativePath}`;
          console.log(`📦 Auto-discovered WASM file: ${fileName}`);
        }
      }
    }
  } else {
    // Discover WASM files from specified packages only
    for (const packageName of WASM_PACKAGES) {
      const packagePath = path.resolve(__dirname, `../../node_modules/${packageName}`);
      const foundWasmFiles = findWasmFiles(packagePath);
      
      for (const wasmPath of foundWasmFiles) {
        const fileName = path.basename(wasmPath);
        const relativePath = path.relative(path.resolve(__dirname, "../.."), wasmPath);
        
        // Prefer nodejs versions over browser versions, and prefer specific paths
        if (!wasmFiles[fileName] || 
            wasmPath.includes('/node/') || 
            wasmPath.includes('nodejs')) {
          wasmFiles[fileName] = `../../${relativePath}`;
          console.log(`📦 Found WASM file: ${fileName} in ${packageName}`);
        }
      }
    }
  }
  
  return wasmFiles;
}

// Helper function to read WASM file as base64
function getWasmAsBase64(wasmPath: string): string {
  try {
    const fullPath = path.resolve(__dirname, wasmPath);
    const wasmBuffer = fs.readFileSync(fullPath);
    return wasmBuffer.toString('base64');
  } catch (error) {
    console.warn(`Warning: Could not read WASM file at ${wasmPath}`);
    return '';
  }
}

export default defineConfig({
  plugins: [wasmLoader({
    mode: "embedded"
  })],
  entry: ["src/bin.ts"],
  format: ["cjs"],
  platform: "node", // Added to specify Node.js environment
  shims: true,      // Added to provide CJS context shims like __dirname
  clean: true,
  bundle: true, // This is true by default, but good to be explicit
  noExternal: [/.*/], // Bundle all dependencies
  splitting: false, // Prevent code splitting to ensure a single output file
  esbuildOptions(options) {
    // Discover WASM files automatically
    const discoveredWasmFiles = discoverWasmFiles();
    
    // Configure esbuild to handle WASM files properly
    options.loader = {
      ...options.loader,
      '.wasm': 'base64'
    };
    // Define globals to help with WASM loading and patch filesystem access
    options.define = {
      ...options.define,
      'global': 'globalThis'
    };
    
    // Generate embedded WASM object dynamically
    const embeddedWasmEntries = Object.entries(discoveredWasmFiles)
      .map(([fileName, filePath]) => {
        const base64Data = getWasmAsBase64(filePath);
        return `  '${fileName}': '${base64Data}'`;
      })
      .join(',\n');
    
    // Add banner to patch fs.readFileSync for WASM files
    options.banner = {
      js: `
// Patch fs.readFileSync to return embedded WASM data
const originalReadFileSync = require('fs').readFileSync;
const pathModule = require('path');

// Embedded WASM files as base64 (auto-discovered)
const embeddedWasm = {
${embeddedWasmEntries}
};

require('fs').readFileSync = function(filePath, options) {
  const fileName = pathModule.basename(filePath);
  if (embeddedWasm[fileName]) {
    return Buffer.from(embeddedWasm[fileName], 'base64');
  }
  return originalReadFileSync.call(this, filePath, options);
};
`
    };
  },
});
