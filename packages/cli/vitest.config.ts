import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["./test/**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: [],
    globals: true,
    coverage: {
      provider: "v8"
    },
    testTimeout: 60 * 1000
  }
})
