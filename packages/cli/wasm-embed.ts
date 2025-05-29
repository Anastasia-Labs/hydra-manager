import * as esbuild from "esbuild";
import path from "path";
import fs from "fs";
import { gzipSync } from "zlib";

export interface WasmEmbedOptions {
  /** Packages that contain WASM files to embed */
  packages?: string[];
  /** Auto-discover WASM files from all installed packages (warning: may increase bundle size) */
  autoDiscoverAll?: boolean;
  /** Root directory for resolving paths (defaults to current working directory) */
  rootDir?: string;
  /** Node modules directory (defaults to 'node_modules' relative to rootDir) */
  nodeModulesDir?: string;
  /** Packages to exclude from auto-discovery */
  excludePackages?: string[];
  /** Enable debug logging */
  debug?: boolean;
  /** Compress WASM files using gzip before base64 encoding */
  compress?: boolean;
}

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
      } else if (stat.isFile() && entry.endsWith(".wasm")) {
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
function discoverWasmFiles(options: WasmEmbedOptions): Record<string, string> {
  const {
    packages = [],
    autoDiscoverAll = false,
    rootDir = findWorkspaceRoot(),
    nodeModulesDir,
    excludePackages = ["esbuild", "source-map", "dprint"],
    debug = false,
  } = options;

  const wasmFiles: Record<string, string> = {};
  const nodeModulesPath = nodeModulesDir
    ? path.resolve(rootDir, nodeModulesDir)
    : path.join(rootDir, "node_modules");

  if (debug) {
    console.log(`🔍 WASM discovery options:`, {
      packages,
      autoDiscoverAll,
      rootDir,
      nodeModulesPath,
      excludePackages,
    });
  }

  if (autoDiscoverAll) {
    // Discover WASM files from all node_modules
    if (debug)
      console.log("🔍 Auto-discovering WASM files from all packages...");
    const allWasmFiles = findWasmFiles(nodeModulesPath);

    for (const wasmPath of allWasmFiles) {
      const fileName = path.basename(wasmPath);
      const relativePath = path.relative(rootDir, wasmPath);

      // Skip excluded packages
      const shouldExclude = excludePackages.some((excluded) =>
        wasmPath.includes(excluded)
      );

      if (!shouldExclude) {
        if (
          !wasmFiles[fileName] ||
          wasmPath.includes("/node/") ||
          wasmPath.includes("nodejs")
        ) {
          wasmFiles[fileName] = relativePath;
          if (debug) console.log(`📦 Auto-discovered WASM file: ${fileName}`);
        }
      }
    }
  } else {
    // Discover WASM files from specified packages only
    for (const packageName of packages) {
      const packagePath = path.resolve(nodeModulesPath, packageName);
      const foundWasmFiles = findWasmFiles(packagePath);

      for (const wasmPath of foundWasmFiles) {
        const fileName = path.basename(wasmPath);
        const relativePath = path.relative(rootDir, wasmPath);

        // Prefer nodejs versions over browser versions, and prefer specific paths
        if (
          !wasmFiles[fileName] ||
          wasmPath.includes("/node/") ||
          wasmPath.includes("nodejs")
        ) {
          wasmFiles[fileName] = relativePath;
          if (debug)
            console.log(`📦 Found WASM file: ${fileName} in ${packageName}`);
        }
      }
    }
  }

  return wasmFiles;
}

/**
 * Generic function to find workspace root by looking for common workspace indicators
 */
function findWorkspaceRoot(): string {
  const workspaceIndicators = [
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml", 
    "package-lock.json",
    "yarn.lock",
    "lerna.json",
    "turbo.json",
    ".git"
  ];

  let currentDir = process.cwd();
  
  while (currentDir !== path.dirname(currentDir)) {
    const hasIndicator = workspaceIndicators.some(indicator => 
      fs.existsSync(path.join(currentDir, indicator))
    );
    
    if (hasIndicator) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  return process.cwd();
}

// Helper function to read WASM file as base64
function getWasmAsBase64(
  wasmPath: string,
  rootDir: string = process.cwd(),
  debug: boolean = false,
  compress: boolean = false
): string {
  const fullPath = path.resolve(rootDir, wasmPath);

  try {
    if (debug) console.log(`🔍 Reading WASM file: ${wasmPath} -> ${fullPath}`);
    let wasmBuffer = fs.readFileSync(fullPath);
    
    if (compress) {
      const originalSize = wasmBuffer.length;
      wasmBuffer = Buffer.from(gzipSync(wasmBuffer));
      if (debug) {
        console.log(
          `🗜️ Compressed WASM: ${(originalSize / 1024).toFixed(1)}KB → ${(wasmBuffer.length / 1024).toFixed(1)}KB (${((1 - wasmBuffer.length / originalSize) * 100).toFixed(1)}% reduction)`
        );
      }
    }
    
    const base64 = wasmBuffer.toString("base64");
    
    if (debug) {
      console.log(
        `✅ Successfully read WASM file: ${fullPath} (${wasmBuffer.length} bytes${compress ? ', compressed' : ''})`
      );
    }
    return base64;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (debug) {
      console.warn(
        `❌ Warning: Could not read WASM file at ${wasmPath} (resolved to ${fullPath}):`,
        errorMessage
      );
    }
    return "";
  }
}

/**
 * Generates the WASM patching code
 */
function generateWasmPatchingCode(
  wasmFiles: Record<string, string>,
  rootDir: string,
  debug: boolean = false,
  compress: boolean = false
): string {
  const wasmEntries = Object.entries(wasmFiles)
    .map(([fileName, filePath]) => {
      const base64Data = getWasmAsBase64(filePath, rootDir, debug, compress);
      return `  '${fileName}': { data: '${base64Data}', compressed: ${compress} }`;
    })
    .join(",\n");

  return `
// Auto-generated WASM embed setup
// Patch fs.readFileSync to return embedded WASM data
const originalReadFileSync = require('fs').readFileSync;
const pathModule = require('path');
${compress ? "const { gunzipSync } = require('zlib');" : ""}

// Embedded WASM files as base64 (auto-discovered)
const embeddedWasm = {
${wasmEntries}
};

require('fs').readFileSync = function(filePath, options) {
  const fileName = pathModule.basename(filePath);
  if (embeddedWasm[fileName]) {
    try {
      const wasmEntry = embeddedWasm[fileName];
      let buffer = Buffer.from(wasmEntry.data, 'base64');
      if (wasmEntry.compressed) {
        buffer = gunzipSync(buffer);
      }
      return buffer;
    } catch (error) {
      console.warn('Failed to decompress embedded WASM file:', fileName, error);
      // Fallback to original file system
      return originalReadFileSync.call(this, filePath, options);
    }
  }
  return originalReadFileSync.call(this, filePath, options);
};
`;
}

/**
 * Creates a WASM embed plugin for esbuild
 */
export function createWasmEmbedPlugin(
  options: WasmEmbedOptions = {}
): esbuild.Plugin {
  return {
    name: "wasm-embed",
    setup(build) {
      const { debug = false, compress = false } = options;

      const rootDir = options.rootDir || findWorkspaceRoot();

      if (debug) console.log("🔧 WASM Embed Plugin: Setup called!");

      // Discover WASM files from the workspace
      const wasmFiles = discoverWasmFiles({ ...options, rootDir });

      // Log discovered WASM files
      if (debug) {
        console.log("📦 Discovered WASM files:", Object.keys(wasmFiles));
        const totalSize = Object.values(wasmFiles).reduce((sum, filePath) => {
          try {
            const fullPath = path.resolve(rootDir, filePath);
            const stats = fs.statSync(fullPath);
            return sum + stats.size;
          } catch {
            return sum;
          }
        }, 0);
        console.log(`📊 Total WASM size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      }

      // Generate WASM patching code once
      const wasmPatchingCode = generateWasmPatchingCode(wasmFiles, rootDir, debug, compress);

      // Add banner to inject WASM patching at the top of the bundle
      build.initialOptions.banner = {
        ...build.initialOptions.banner,
        js: `${build.initialOptions.banner?.js || ""}${wasmPatchingCode}`,
      };
    },
  };
}
