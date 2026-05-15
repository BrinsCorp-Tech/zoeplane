import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite dev server port. 5173 is the Tauri default.
// Tauri reads the devUrl from tauri.conf.json → build.devUrl, which must match.
const VITE_PORT = 5173;

export default defineConfig({
  // Plugin order: react must be before any Tauri-specific transforms.
  plugins: [react()],

  // Vite serves the UI from src/ root.
  // In production, Tauri reads from frontendDist (relative path in tauri.conf.json).
  root: ".",
  build: {
    // Output to src/dist — referenced by tauri.conf.json frontendDist: "../src/dist"
    outDir: "dist",
    // Tauri expects ES modules; target modern Chromium baseline
    // (Tauri 2 uses Chromium on Windows/Linux, WebKit on macOS).
    target: ["es2022", "chrome105", "safari15"],
    emptyOutDir: true,
  },

  // Make process.env available without explicit import for Tauri compat
  define: {
    "process.env": {},
  },

  // Dev server config — Tauri uses this via the devUrl in tauri.conf.json.
  // host: false — desktop-only Tauri requires localhost binding; LAN IP from mobile
  // scaffold template caused Tauri's devUrl to hang. Fixed in Story 1.11.
  server: {
    port: VITE_PORT,
    strictPort: true,
    host: false,
    // Tauri IPC calls go through the native bridge, not the dev server.
    // No proxy needed.
  },

  // Enable top-level await (used by some Tauri plugin imports)
  esbuild: {
    target: "es2022",
  },

  // Path resolution — keep imports clean.
  // Use fileURLToPath for ESM-correct absolute path resolution.
  // Previous "/src" form was a filesystem absolute path (broken since Story 1.1
  // but never exercised in app code until Story 2.6 Batch E imported Toast into main.tsx).
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // @host/ → Tauri host bindings (src-tauri/)
      "@host": fileURLToPath(new URL("../src-tauri", import.meta.url)),
      // @sdk/ → Plugin SDK public surface (packages/plugin-sdk/src/)
      "@sdk": fileURLToPath(new URL("../packages/plugin-sdk/src", import.meta.url)),
    },
  },
});
