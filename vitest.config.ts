import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Alias resolution mirrors src/vite.config.ts — @/ resolves to src/
  // so test files importing "@/lib/utils", "@/components/ui/..." work identically
  // to production code without path duplication.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  test: {
    // CodeMirror 6 is ESM-only and cannot be transpiled by Vitest's default CJS
    // transform. Exclude it from transformation so Vite handles it as native ESM.
    // Pattern: node_modules/(?!(@codemirror)/) means "transform everything EXCEPT @codemirror/*"
    server: {
      deps: {
        // Tell Vite to inline (transform) @codemirror/* — required because
        // CodeMirror ships ESM-only which Vitest's node worker cannot import directly.
        inline: [/^@codemirror\//],
      },
    },

    // Only scan project source — never third-party caches or node_modules.
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "sidecar/src/**/*.{test,spec}.ts",
      "packages/*/src/**/*.{test,spec}.ts",
      "tests/**/*.{test,spec}.{ts,tsx}",
    ],
    // Belt-and-suspenders: exclude Bun's local package cache and node_modules
    // even though include already scopes us to project source.
    exclude: ["**/node_modules/**", "**/.bun-cache/**", "**/dist/**"],
    // No test files exist yet in the skeleton — pass rather than error.
    passWithNoTests: true,

    // JSDOM environment for React component tests (ThemeProvider axe harness, etc.)
    // File-level overrides via `// @vitest-environment node` for non-DOM tests.
    environment: "jsdom",
  },
});
