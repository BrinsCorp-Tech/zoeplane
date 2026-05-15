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
import { join } from "node:path";
import { openDatabase } from "./db/client";
import { runMigrations } from "./db/runner";
import { log } from "./log";
import {
  startGlobalWatcher,
  startProjectWatcher,
  stopProjectWatcher,
  stopWatcher,
  subscribeToWatcherEvents,
} from "./indexer/watcher";
import type { WatcherEvent } from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// CLI argument parsing — DB path (required, supplied by Tauri shell at spawn)
// ---------------------------------------------------------------------------
// The Tauri shell resolves appDataDir() in Rust and passes the database path
// as --db-path <absolute-path>.  We never derive this path in TypeScript to
// avoid platform-specific drift with Tauri's own resolver.
//
// If --db-path is missing the sidecar fails loudly (AC4) rather than silently
// falling back to a hardcoded location.

function parseDbPath(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--db-path");
  if (idx === -1 || args[idx + 1] === undefined) {
    log(
      "ERROR",
      "Sidecar startup failed: required argument --db-path not provided. " +
        "The Tauri shell must resolve appDataDir() and pass it as --db-path <path>.",
    );
    process.exit(1);
  }
  return args[idx + 1];
}

// ---------------------------------------------------------------------------
// Resolve the migrations directory.
//
// The --migrations-dir argument is supplied by the Tauri shell at spawn time,
// pointing to the resource-bundled migrations directory copied by tauri.conf.json
// `resources` entry.  This is the same approach as --db-path: Rust resolves the
// correct absolute path and passes it in, keeping the sidecar platform-agnostic.
//
// If --migrations-dir is not supplied the runner falls back to a sibling
// `migrations/` directory relative to the sidecar binary (dev-mode convenience)
// and emits a WARN so the omission is visible.
// ---------------------------------------------------------------------------

interface MigrationsDirResult {
  path: string;
  isFallback: boolean;
}

function parseMigrationsDir(): MigrationsDirResult {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--migrations-dir");
  if (idx !== -1 && args[idx + 1] !== undefined) {
    return { path: args[idx + 1], isFallback: false };
  }
  // Fallback: resolve relative to this module's directory (dev / source-mode only).
  // import.meta.dir is Bun's equivalent of __dirname and works in both source
  // and compiled-binary modes.
  const fallback = join(import.meta.dir, "db", "migrations");
  log(
    "WARN",
    "Sidecar: --migrations-dir not supplied; falling back to dev-mode path. " +
      "Production builds must supply this argument.",
    { fallback },
  );
  return { path: fallback, isFallback: true };
}

// Log startup to stderr (structured JSON for the lifecycle log channel).
// Tauri wires sidecar stderr to tracing so this surfaces in RUST_LOG output.
log("INFO", "ZoePlane sidecar starting", { version });

// ---------------------------------------------------------------------------
// Database initialisation — MUST complete before the HTTP server starts.
// IPC handlers depend on the DB being ready (Story 1.3 contract).
// ---------------------------------------------------------------------------

const dbPath = parseDbPath();

log("INFO", "Opening SQLite database", { dbPath });

const db = openDatabase(dbPath);
const migrationsDir = parseMigrationsDir();
runMigrations(db, migrationsDir.path, migrationsDir.isFallback);

log("INFO", "Database ready", { dbPath });

// ---------------------------------------------------------------------------
// HTTP loopback server (Sprint 1 IPC transport — operator decision 2026-05-07)
// ---------------------------------------------------------------------------
// Bind to port 0 so the kernel assigns a free ephemeral port. This avoids
// port conflicts when multiple dev instances run simultaneously or when the
// previous instance's port lingers in TIME_WAIT.

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0, // kernel-assigned ephemeral port
  fetch(req: Request): Response | Promise<Response> {
    const url = new URL(req.url);

    // ------------------------------------------------------------------
    // GET /health — liveness probe (Tauri ipc.rs sidecar_status command)
    // ------------------------------------------------------------------
    if (url.pathname === "/health" && req.method === "GET") {
      return Response.json({ status: "ok", pid: process.pid }, { status: 200 });
    }

    // ------------------------------------------------------------------
    // GET /events — SSE stream for watcher events (Story 3.2)
    //
    // The UI (via Tauri IPC) or future internal consumers can subscribe
    // to receive AssetIndexUpdatedEvent, WatcherStartedEvent, and
    // WatcherErrorEvent in real time.
    //
    // Each event is serialised as:
    //   data: <JSON>\n\n
    // per the SSE specification (text/event-stream).
    //
    // A "connected" heartbeat comment is sent immediately on connect so
    // the client knows the stream is live.
    // ------------------------------------------------------------------
    if (url.pathname === "/events" && req.method === "GET") {
      let unsubscribe: (() => void) | null = null;

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();

          // Send an immediate heartbeat comment so the client sees a
          // live stream rather than a hanging connection.
          controller.enqueue(encoder.encode(": connected\n\n"));

          unsubscribe = subscribeToWatcherEvents((event: WatcherEvent) => {
            try {
              const data = `data: ${JSON.stringify(event)}\n\n`;
              controller.enqueue(encoder.encode(data));
            } catch {
              // Controller may be closed if the client disconnected.
            }
          });
        },
        cancel() {
          if (unsubscribe !== null) {
            unsubscribe();
            unsubscribe = null;
          }
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no", // Disable nginx/proxy buffering if present.
        },
      });
    }

    // ------------------------------------------------------------------
    // POST /watcher/project/open — register a per-project watch root
    //
    // Body: { "projectRoot": "/absolute/path/to/project" }
    //
    // Emits WatcherStartedEvent on success.
    // Emits WatcherErrorEvent with reason "project_claude_missing" if
    // <projectRoot>/.claude/ does not exist.
    // ------------------------------------------------------------------
    if (url.pathname === "/watcher/project/open" && req.method === "POST") {
      return req.json().then((body: unknown) => {
        if (
          typeof body !== "object" ||
          body === null ||
          typeof (body as Record<string, unknown>).projectRoot !== "string"
        ) {
          return Response.json(
            { error: "Bad Request", message: "Body must be { projectRoot: string }" },
            { status: 400 },
          );
        }
        const projectRoot = (body as { projectRoot: string }).projectRoot;
        startProjectWatcher(projectRoot);
        return Response.json({ ok: true, projectRoot }, { status: 200 });
      });
    }

    // ------------------------------------------------------------------
    // POST /watcher/project/close — remove a per-project watch root
    //
    // Body: { "projectRoot": "/absolute/path/to/project" }
    // ------------------------------------------------------------------
    if (url.pathname === "/watcher/project/close" && req.method === "POST") {
      return req.json().then((body: unknown) => {
        if (
          typeof body !== "object" ||
          body === null ||
          typeof (body as Record<string, unknown>).projectRoot !== "string"
        ) {
          return Response.json(
            { error: "Bad Request", message: "Body must be { projectRoot: string }" },
            { status: 400 },
          );
        }
        const projectRoot = (body as { projectRoot: string }).projectRoot;
        stopProjectWatcher(projectRoot);
        return Response.json({ ok: true, projectRoot }, { status: 200 });
      });
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

log("INFO", "ZoePlane sidecar HTTP server ready", { hostname: "127.0.0.1", port: server.port });

// ---------------------------------------------------------------------------
// FS Watcher startup (Epic 03, Story 3.2)
// Start the global watcher after the HTTP server is ready so that
// WatcherStartedEvent emissions have an active SSE stream to fan out on.
// ---------------------------------------------------------------------------

startGlobalWatcher();

log("INFO", "ZoePlane sidecar FS watcher started");

// ---------------------------------------------------------------------------
// Signal handlers — clean shutdown
// ---------------------------------------------------------------------------

process.on("SIGTERM", () => {
  log("INFO", "Sidecar SIGTERM — shutting down");
  void stopWatcher().then(() => {
    server.stop(true);
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  log("INFO", "Sidecar SIGINT — shutting down");
  void stopWatcher().then(() => {
    server.stop(true);
    process.exit(0);
  });
});
