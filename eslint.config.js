// ZoePlane — ESLint 9 flat configuration
// Covers: src/ (React UI), sidecar/src/ (Bun sidecar), packages/*/src/ (shared packages)
//
// Intentionally minimal: @eslint/js recommended + typescript-eslint recommended.
// Type-aware rules (requiresTypeChecking) are NOT enabled here because they
// require per-workspace tsconfig wiring that adds CI complexity — enforce type
// safety via `bun run typecheck` (tsc --noEmit) instead.
//
// Custom ZoePlane rules (no-component-theme-branch, no-primitive-token) are
// deferred to Epic 04 Sprint 7 when tools/eslint-plugin-zoeplane/ is implemented.

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // ----------------------------------------------------------------
  // Global ignores — applied before any language-specific rules.
  // ----------------------------------------------------------------
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "src-tauri/target/**",
      ".bun-cache/**",
      "**/*.cjs",     // legacy .eslintrc.cjs — do not self-lint
      "**/vite.config.js",      // vite — build tooling, not app source
      "**/postcss.config.js",   // postcss — build tooling
      "**/tailwind.config.js",  // tailwind — build tooling
      "**/tailwind.config.ts",  // tailwind — build tooling (TS variant)
      "**/vite.config.ts",      // vite — build tooling (TS variant)
      "**/vitest.config.ts",    // vitest — test harness config, not app source
    ],
  },

  // ----------------------------------------------------------------
  // Base JS recommended rules for all matched files.
  // ----------------------------------------------------------------
  js.configs.recommended,

  // ----------------------------------------------------------------
  // TypeScript recommended ruleset — no type-checking overlay.
  // ----------------------------------------------------------------
  ...tseslint.configs.recommended,

  // ----------------------------------------------------------------
  // File targeting: TypeScript sources across all three workspaces.
  // ----------------------------------------------------------------
  // ----------------------------------------------------------------
  // FB-016: Restrict direct @tauri-apps/plugin-fs imports in the UI.
  // The React UI must use the audited IPC commands (fs_read_file,
  // fs_write_file, fs_read_dir, fs_exists) defined in
  // src-tauri/src/commands/fs.rs. Direct plugin imports bypass the
  // FB-016 audit log entirely.
  // ----------------------------------------------------------------
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@tauri-apps/plugin-fs",
          message: "Direct imports of @tauri-apps/plugin-fs bypass FB-016 audit logging. Use the fs_read_file / fs_write_file / fs_read_dir / fs_exists IPC commands defined in src-tauri/src/commands/fs.rs instead."
        }]
      }]
    }
  },

  {
    files: [
      "src/**/*.{ts,tsx}",
      "sidecar/src/**/*.ts",
      "packages/*/src/**/*.ts",
    ],
    rules: {
      // Relax @typescript-eslint/no-explicit-any for Sprint 1 scaffolding.
      // TODO (Story 1.x): tighten to "error" once the codebase stabilises.
      "@typescript-eslint/no-explicit-any": "warn",

      // Allow unused vars prefixed with _ (common TypeScript convention).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  }
);
