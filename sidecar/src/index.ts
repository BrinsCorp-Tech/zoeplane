// ZoePlane Sidecar — Entry point
//
// The sidecar is a bun-compiled single-binary process that the Tauri shell
// spawns at startup via the `externalBin` mechanism declared in tauri.conf.json.
//
// Architecture role:
//   - Hosts Path A (Direct Claude SDK calls) — see path-a/
//   - Hosts Path B (CLI harness wrapping `claude` + `codex`) — see path-b/
//   - Plugin runtime host — see plugin-host/
//   - Skill Safety Evaluator runner — see evaluator/
//   - FS watchers + asset indexer — see indexer/
//   - SQLite derived-state (no content, only indexes + preferences) — see db/
//
// IPC contract (Sprint 1 decision, 2026-05-07):
//   HTTP loopback on 127.0.0.1:0 (kernel-assigned ephemeral port).
//   Bound port is written to stdout as a single-line JSON: {"port": N}
//   so the Tauri shell can parse it and store the port in app state.
//   The React UI never speaks to the sidecar directly — all calls route
//   through Tauri IPC commands (src-tauri/ipc.rs).
//
// Build: `bun build src/index.ts --compile --outfile dist/zoeplane-sidecar`
// Produces a single-binary executable for the target platform.

import { version } from "../package.json";

// Log startup to stderr (structured JSON for the lifecycle log channel).
// Tauri wires sidecar stderr to tracing so this surfaces in RUST_LOG output.
console.error(
  JSON.stringify({
    level: "INFO",
    message: "ZoePlane sidecar starting",
    version,
    pid: process.pid,
  })
);

// ---------------------------------------------------------------------------
// HTTP loopback server (Sprint 1 IPC transport — operator decision 2026-05-07)
// ---------------------------------------------------------------------------
// Bind to port 0 so the kernel assigns a free ephemeral port. This avoids
// port conflicts when multiple dev instances run simultaneously or when the
// previous instance's port lingers in TIME_WAIT.

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0, // kernel-assigned ephemeral port
  fetch(req: Request): Response {
    const url = new URL(req.url);

    if (url.pathname === "/health" && req.method === "GET") {
      return Response.json(
        { status: "ok", pid: process.pid },
        { status: 200 }
      );
    }

    // All other routes: 404. Future epics will extend this routing.
    return new Response("Not Found", { status: 404 });
  },
});

// Announce the bound port to stdout as a single-line JSON object.
// The Tauri shell reads this line at startup and stores the port in app state
// before issuing health-check IPC requests.
// IMPORTANT: write to stdout (process.stdout.write), not console.log — in
// some runtime environments console.log appends to stderr; stdout is the
// Tauri-monitored channel for this announcement.
process.stdout.write(JSON.stringify({ port: server.port }) + "\n");

console.error(
  JSON.stringify({
    level: "INFO",
    message: "ZoePlane sidecar HTTP server ready",
    hostname: "127.0.0.1",
    port: server.port,
    pid: process.pid,
  })
);

// ---------------------------------------------------------------------------
// Signal handlers — clean shutdown
// ---------------------------------------------------------------------------

process.on("SIGTERM", () => {
  console.error(
    JSON.stringify({ level: "INFO", message: "Sidecar SIGTERM — shutting down", pid: process.pid })
  );
  server.stop(true);
  process.exit(0);
});

process.on("SIGINT", () => {
  console.error(
    JSON.stringify({ level: "INFO", message: "Sidecar SIGINT — shutting down", pid: process.pid })
  );
  server.stop(true);
  process.exit(0);
});

// TODO (Epic 03): start FS watcher and asset indexer
// import { startIndexer } from "./indexer";
// await startIndexer();
