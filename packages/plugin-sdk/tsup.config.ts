import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  outDir: "dist",
  // Use a build-specific tsconfig that disables composite mode so tsup does
  // not emit tsconfig.tsbuildinfo into dist/ (which would ship with the package).
  tsconfig: "tsconfig.build.json",
});
