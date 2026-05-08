#!/usr/bin/env bun
//
// copy-sidecar.ts — copies the compiled sidecar binary into the location
// that Tauri's externalBin resolver expects.
//
// Background
// ----------
// `bun build --compile` outputs `sidecar/dist/zoeplane-sidecar` (no suffix).
// Tauri's `bundle.externalBin` is declared as `["binaries/zoeplane-sidecar"]`
// in `src-tauri/tauri.conf.json`.  At runtime Tauri appends the host target-
// triple (e.g., `-aarch64-apple-darwin`) so it looks for the binary at:
//
//   src-tauri/binaries/zoeplane-sidecar-<triple>
//
// This script resolves the current host triple via `rustc -vV`, then copies
// the compiled binary to the correct destination path.
//
// Usage
// -----
//   bun run scripts/copy-sidecar.ts
//
// It is wired as the sidecar `postbuild` script so it runs automatically
// after `bun run --cwd sidecar build`.
//
// Symlinks are NOT used — CI platforms (Linux containers, Windows CI) do not
// reliably support them for executable binaries.

import { execSync } from "child_process";
import { copyFileSync, chmodSync, existsSync, mkdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve paths relative to the repo root (this script lives in <root>/scripts/).
const repoRoot = resolve(__dirname, "..");

// On Windows, bun build --compile appends .exe to the output binary name.
const binaryExt = process.platform === "win32" ? ".exe" : "";
const srcBinary = join(repoRoot, "sidecar", "dist", `zoeplane-sidecar${binaryExt}`);
const binariesDir = join(repoRoot, "src-tauri", "binaries");

// ---------------------------------------------------------------------------
// 1. Verify the compiled binary exists.
// ---------------------------------------------------------------------------
if (!existsSync(srcBinary)) {
  console.error(
    `[copy-sidecar] ERROR: source binary not found at ${srcBinary}\n` +
      `  Run "bun run --cwd sidecar build" first.`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Resolve host target triple from rustc.
//    Tries common installation paths if rustc is not in PATH.
// ---------------------------------------------------------------------------

/** Try to run rustc -vV and parse the host triple. Returns null on failure. */
function tryGetTriple(rustcPath: string): string | null {
  try {
    const out = execSync(`"${rustcPath}" -vV`, { encoding: "utf-8" });
    const match = out.match(/^host:\s+(\S+)/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Ordered list of places to look for rustc.
const rustcCandidates = [
  "rustc", // $PATH
  `${process.env.HOME ?? process.env.USERPROFILE}/.cargo/bin/rustc`, // rustup default (USERPROFILE on Windows)
  "/usr/local/bin/rustc",
  "/opt/homebrew/bin/rustc",
];

let triple: string | null = null;
for (const candidate of rustcCandidates) {
  triple = tryGetTriple(candidate);
  if (triple) break;
}

if (!triple) {
  // Allow override via environment variable so CI can set TAURI_TARGET_TRIPLE
  // without needing rustc installed on the copy step runner.
  if (process.env.TAURI_TARGET_TRIPLE) {
    triple = process.env.TAURI_TARGET_TRIPLE;
    console.warn(
      `[copy-sidecar] WARN: rustc not found; using TAURI_TARGET_TRIPLE="${triple}" from environment.`
    );
  } else {
    // Non-fatal: the sidecar binary compiled successfully — the copy step is
    // path-plumbing for Tauri's externalBin resolver.  If rustc is not yet
    // installed (e.g., pure-JS dev environment, postbuild in a CI job that
    // only does TS work), warn and exit cleanly.  The copy MUST happen before
    // `cargo tauri dev` or `cargo tauri build` runs; the root `tauri` script
    // in package.json calls this step with the full environment available.
    console.warn(
      `[copy-sidecar] WARN: rustc not found — skipping binary copy.\n` +
        `  Tried: ${rustcCandidates.join(", ")}\n` +
        `  The copy will run automatically when you run "pnpm tauri" (via the root tauri script).\n` +
        `  To copy manually: TAURI_TARGET_TRIPLE=<triple> bun run scripts/copy-sidecar.ts`
    );
    process.exit(0); // warn-only; do not fail the build
  }
}

// ---------------------------------------------------------------------------
// 3. Copy binary to src-tauri/binaries/zoeplane-sidecar-<triple>.
// ---------------------------------------------------------------------------
// Tauri's externalBin resolver expects: zoeplane-sidecar-<triple>[.exe on Windows]
const destBinary = join(binariesDir, `zoeplane-sidecar-${triple}${binaryExt}`);

mkdirSync(binariesDir, { recursive: true });
copyFileSync(srcBinary, destBinary);

// Ensure the binary is executable (required on macOS/Linux; no-op on Windows).
try {
  chmodSync(destBinary, 0o755);
} catch {
  // Windows may not support chmod — ignore.
}

console.log(
  `[copy-sidecar] Copied:\n` +
    `  src: ${srcBinary}\n` +
    `  dst: ${destBinary}\n` +
    `  triple: ${triple}`
);
