// ZoePlane Sidecar — Entry point
//
// The sidecar is a Node.js (bun-compatible) process that the Tauri shell spawns
// at startup via the `externalBin` mechanism declared in tauri.conf.json.
//
// Architecture role:
//   - Hosts Path A (Direct Claude SDK calls) — see path-a/
//   - Hosts Path B (CLI harness wrapping `claude` + `codex`) — see path-b/
//   - Plugin runtime host — see plugin-host/
//   - Skill Safety Evaluator runner — see evaluator/
//   - FS watchers + asset indexer — see indexer/
//   - SQLite derived-state (no content, only indexes + preferences) — see db/
//
// IPC contract: the sidecar communicates with the Tauri shell via stdout/stdin
// JSON-RPC or a local Unix socket (TBD in Epic 01). The React UI never speaks
// to the sidecar directly — all calls route through Tauri IPC commands (src-tauri/ipc.rs).
//
// Build: `bun build src/index.ts --compile --outfile dist/zoeplane-sidecar`
// Produces a single-binary executable for the target platform.
//
// TODO (Epic 01, Sprint 1): implement the IPC server. Options:
//   - stdout/stdin JSON-RPC (simplest; used by many Tauri sidecars)
//   - Unix domain socket / Windows named pipe (better for high-frequency streaming)
//   Decision should be logged in Epic 01 risks when implemented.

import { version } from "../package.json";

console.error(
  JSON.stringify({
    level: "INFO",
    message: "ZoePlane sidecar starting",
    version,
    pid: process.pid,
  })
);

// TODO (Epic 01): start IPC server and register handlers
// import { startIpcServer } from "./ipc/server";
// await startIpcServer();

// TODO (Epic 03): start FS watcher and asset indexer
// import { startIndexer } from "./indexer";
// await startIndexer();

// Prevent process from exiting — real implementation drives the event loop
// via the IPC server. Remove this stub when the server is implemented.
process.stdin.resume();

process.on("SIGTERM", () => {
  console.error(JSON.stringify({ level: "INFO", message: "Sidecar SIGTERM — shutting down" }));
  process.exit(0);
});

process.on("SIGINT", () => {
  console.error(JSON.stringify({ level: "INFO", message: "Sidecar SIGINT — shutting down" }));
  process.exit(0);
});
