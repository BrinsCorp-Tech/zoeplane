import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only scan project source — never third-party caches or node_modules.
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "sidecar/src/**/*.{test,spec}.ts",
      "packages/*/src/**/*.{test,spec}.ts",
      "tests/**/*.{test,spec}.{ts,tsx}",
    ],
    // Belt-and-suspenders: exclude Bun's local package cache and node_modules
    // even though include already scopes us to project source.
    exclude: [
      "**/node_modules/**",
      "**/.bun-cache/**",
      "**/dist/**",
    ],
    // No test files exist yet in the skeleton — pass rather than error.
    passWithNoTests: true,
  },
});
