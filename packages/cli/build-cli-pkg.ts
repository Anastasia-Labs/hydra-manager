/**
 * CLI Build Script with @yao-pkg/pkg using pre-built dist/bin.cjs
 * 
 * This script builds standalone executables using the already compiled dist/bin.cjs file.
 * The WASM files are already embedded in dist/bin.cjs by tsup with esbuild-plugin-wasm.
 * 
 * Usage:
 * 1. First run: pnpm build (to generate dist/bin.cjs)
 * 2. Then run: pnpx tsx build-cli-pkg.ts
 * 
 * Options:
 * - Single target: pnpx tsx build-cli-pkg.ts --single linux-x64
 * 
 */

import { exec } from '@yao-pkg/pkg';
import { existsSync } from 'fs';
import { resolve, basename } from 'path';

// Build targets for different platforms
const TARGETS = [
  { platform: 'macos', arch: 'arm64' },
  { platform: 'macos', arch: 'x64' },
  { platform: 'linux', arch: 'arm64' },
  { platform: 'linux', arch: 'x64' },
  { platform: 'win', arch: 'x64' },
];

const OUT_DIR = "./out";
const DIST_FILE = "./dist/bin.cjs";

/**
 * Builds and compiles a standalone executable for the given target
 */
async function buildExecutable(target: { platform: string; arch: string }): Promise<void> {
  const platformName = `${target.platform}-${target.arch}`;
  const extension = target.platform === 'win' ? '.exe' : '';
  const outputFile = resolve(`${OUT_DIR}/hydra-manager-${platformName}${extension}`);

  console.log(`🚀 Building standalone executable for ${platformName}...`);

  try {
    // pkg target format: node20-macos-arm64, node20-linux-x64, etc.
    const pkgTarget = `node20-${target.platform}-${target.arch}`;
    
    await exec([
      DIST_FILE,
      '--target', pkgTarget,
      '--output', outputFile,
      '--compress', 'Brotli'
    ]);

    console.log(`✓ Created executable: ${basename(outputFile)}`);
  } catch (error) {
    console.error(`❌ Failed to build for ${platformName}:`, error);
    throw error;
  }
}

/**
 * Main build function
 */
async function build(): Promise<void> {
  console.log("🔨 Starting pkg CLI build process...");
  
  // Check if the dist file exists
  if (!existsSync(DIST_FILE)) {
    console.error(`❌ ${DIST_FILE} not found! Please run 'pnpm build' first to generate the compiled file.`);
    process.exit(1);
  }

  try {
    // Build for each target
    for (const target of TARGETS) {
      console.log(`\n🎯 Building for ${target.platform}-${target.arch}...`);
      
      try {
        await buildExecutable(target);
      } catch (error) {
        console.error(`❌ Failed to build for ${target.platform}-${target.arch}:`, error);
        // Continue with other targets instead of failing completely
        continue;
      }
    }

    console.log("\n🎉 pkg build complete! Check the ./out directory for your executables.");
    console.log("\n📋 Built executables:");
    TARGETS.forEach(target => {
      const extension = target.platform === 'win' ? '.exe' : '';
      const fileName = `hydra-manager-${target.platform}-${target.arch}${extension}`;
      console.log(`  - ${fileName}`);
    });
  } catch (error) {
    console.error("❌ Build process failed:", error);
    throw error;
  }
}

/**
 * Alternative build function for single target
 */
async function buildSingle(platform: string, arch: string): Promise<void> {
  console.log(`🔨 Starting pkg CLI build for ${platform}-${arch}...`);
  
  // Check if the dist file exists
  if (!existsSync(DIST_FILE)) {
    console.error(`❌ ${DIST_FILE} not found! Please run 'pnpm build' first to generate the compiled file.`);
    process.exit(1);
  }

  try {
    await buildExecutable({ platform, arch });
    console.log(`\n🎉 Build complete for ${platform}-${arch}!`);
  } catch (error) {
    console.error("❌ Build process failed:", error);
    throw error;
  }
}

// Command line argument parsing
const args = process.argv.slice(2);
if (args.length >= 2 && args[0] === '--single') {
  const [platform, arch] = args[1].split('-');
  if (platform && arch) {
    buildSingle(platform, arch).catch((error) => {
      console.error("❌ Build failed:", error);
      process.exit(1);
    });
  } else {
    console.error("❌ Invalid target format. Use: --single platform-arch (e.g., --single linux-x64)");
    process.exit(1);
  }
} else {
  // Run the full build
  build().catch((error) => {
    console.error("❌ Build failed:", error);
    process.exit(1);
  });
}

// Export functions for programmatic usage
export {
  build,
  buildSingle
};
