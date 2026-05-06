// ZoePlane — ESLint configuration
// TypeScript-strict with React and custom ZoePlane rules.

/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: [
      "./src/tsconfig.json",
      "./sidecar/tsconfig.json",
      "./packages/*/tsconfig.json",
    ],
    tsconfigRootDir: __dirname,
  },
  plugins: [
    "@typescript-eslint",
    "react",
    "react-hooks",
    "jsx-a11y",
    "zoeplane", // custom rules — see tools/eslint-plugin-zoeplane/ (TODO Sprint 1)
  ],
  rules: {
    // ---- TypeScript strictness ----
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/strict-boolean-expressions": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",

    // ---- React ----
    "react/react-in-jsx-scope": "off", // React 18 JSX transform
    "react/prop-types": "off",         // TypeScript handles props

    // ---- ZoePlane custom rules ----
    // no-component-theme-branch: reject any code that reads data-theme in component code.
    // Themes are CSS-only (dark-mode-architecture.md load-bearing rule).
    // TODO (Sprint 1): implement this rule in tools/eslint-plugin-zoeplane/
    // "zoeplane/no-component-theme-branch": "error",

    // no-primitive-token: reject direct use of CSS primitive tokens (--gray-*, --accent-*)
    // in component style attributes. Semantic tokens only.
    // TODO (Sprint 1): implement this rule.
    // "zoeplane/no-primitive-token": "error",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "src/dist/",
    "src-tauri/target/",
    ".bun-cache/",
    "*.cjs",  // this file — prevent self-lint
  ],
};
