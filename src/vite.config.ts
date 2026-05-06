import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error — Tauri Vite plugin types may not resolve until install
import { internalIpV4 } from "internal-ip";

// Vite dev server port. 5173 is the Tauri default.
// Tauri reads the devUrl from tauri.conf.json → build.devUrl, which must match.
const VITE_PORT = 5173;

export default defineConfig(async () => {
  const host = await internalIpV4();

  return {
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

    // Dev server config — Tauri uses this via the devUrl in tauri.conf.json
    server: {
      port: VITE_PORT,
      strictPort: true,
      host: host ?? false,
      // Tauri IPC calls go through the native bridge, not the dev server.
      // No proxy needed.
    },

    // Enable top-level await (used by some Tauri plugin imports)
    esbuild: {
      target: "es2022",
    },

    // Path resolution — keep imports clean
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  };
});
