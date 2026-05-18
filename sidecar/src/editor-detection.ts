// ZoePlane Sidecar — Editor detection (Story 3.9 / FR-035)
//
// Probes the system PATH for supported editor CLI entrypoints:
//   code   → Visual Studio Code
//   cursor → Cursor
//   zed    → Zed
//
// Detection runs once at sidecar startup when the `detected_editor` preference
// is NULL. The first editor found is persisted as:
//   { "name": "vscode"|"cursor"|"zed", "cli": "code"|"cursor"|"zed" }
//
// If none of the editors are found, returns null so the caller can persist
// the sentinel value `{ "name": "system", "cli": null }` (AC #4).
//
// Platform:
//   Unix    — `which <cli>` returns exit code 0 + path if found, 1 if not.
//   Windows — `where <cli>` is the equivalent.
//
// We use `child_process.spawn` (Node built-in, available in both Bun and Node
// runtimes) rather than Bun.spawn so tests can run under Vitest/Node without
// shims.

import { spawn } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectedEditor {
  name: "vscode" | "cursor" | "zed";
  cli: "code" | "cursor" | "zed";
}

// Candidate list — ordered by preference (VSCode first, matching FR-035 ordering).
const EDITOR_CANDIDATES: DetectedEditor[] = [
  { name: "vscode", cli: "code" },
  { name: "cursor", cli: "cursor" },
  { name: "zed", cli: "zed" },
];

// ---------------------------------------------------------------------------
// which / where probe
// ---------------------------------------------------------------------------

/**
 * Returns true if `cli` resolves to an executable on the current PATH.
 *
 * Uses `which` on Unix and `where` on Windows via `child_process.spawn`.
 * Resolves to true if the probe exits with code 0, false otherwise.
 */
export function probeEditorCli(cli: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd = process.platform === "win32" ? "where" : "which";
    const child = spawn(cmd, [cli], {
      stdio: "ignore", // we only care about the exit code
      shell: false,
    });

    child.on("error", () => {
      // `which` or `where` itself is not available — treat as not found.
      resolve(false);
    });

    child.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

// ---------------------------------------------------------------------------
// detectEditor
// ---------------------------------------------------------------------------

/**
 * Probe for editor CLI availability and return the first match.
 *
 * Checks candidates in order: code → cursor → zed.
 * Returns null if none are found on PATH.
 */
export async function detectEditor(): Promise<DetectedEditor | null> {
  for (const candidate of EDITOR_CANDIDATES) {
    const found = await probeEditorCli(candidate.cli);
    if (found) {
      return candidate;
    }
  }
  return null;
}
