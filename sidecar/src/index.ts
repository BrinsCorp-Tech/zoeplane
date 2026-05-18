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
import { runColdLaunchScan, runProjectScan, subscribeToScannerEvents } from "./indexer/scanner";
import { runShadowRecomputeAll, recomputeShadows } from "./indexer/resolver";
import { runValidationPipeline, subscribeToValidatorEvents } from "./indexer/validator";
import {
  runHookDiscovery,
  reindexHooksForPath,
  subscribeToHookDiscoveryEvents,
} from "./indexer/hook-discovery";
import { initEventRouter, subscribeToEventRouterEvents } from "./indexer/event-router";
import { detectEditor } from "./editor-detection";
import { type WatcherEvent } from "@zoeplane/shared-types";

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
      let unsubscribeWatcher: (() => void) | null = null;
      let unsubscribeScanner: (() => void) | null = null;
      let unsubscribeValidator: (() => void) | null = null;
      let unsubscribeHookDiscovery: (() => void) | null = null;
      let unsubscribeEventRouter: (() => void) | null = null;

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();

          // Send an immediate heartbeat comment so the client sees a
          // live stream rather than a hanging connection.
          controller.enqueue(encoder.encode(": connected\n\n"));

          const sendEvent = (event: WatcherEvent): void => {
            try {
              const data = `data: ${JSON.stringify(event)}\n\n`;
              controller.enqueue(encoder.encode(data));
            } catch {
              // Controller may be closed if the client disconnected.
            }
          };

          // Story 3.2: raw watcher events (AssetIndexUpdatedEvent, WatcherStartedEvent,
          // WatcherErrorEvent) — direct subscription so they reach the client even though
          // the event-router does not relay them (it only emits derived events).
          unsubscribeWatcher = subscribeToWatcherEvents(sendEvent);
          unsubscribeScanner = subscribeToScannerEvents(sendEvent);
          // Story 3.5: ValidationCompletedEvent + AssetValidationUpdatedEvent
          unsubscribeValidator = subscribeToValidatorEvents(sendEvent);
          // Story 3.6: HookIndexCompletedEvent
          unsubscribeHookDiscovery = subscribeToHookDiscoveryEvents(sendEvent);
          // Story 3.8: LibraryRefreshEvent + AssetExternallyModifiedWhileOpenEvent
          unsubscribeEventRouter = subscribeToEventRouterEvents(sendEvent);
        },
        cancel() {
          if (unsubscribeWatcher !== null) {
            unsubscribeWatcher();
            unsubscribeWatcher = null;
          }
          if (unsubscribeScanner !== null) {
            unsubscribeScanner();
            unsubscribeScanner = null;
          }
          if (unsubscribeValidator !== null) {
            unsubscribeValidator();
            unsubscribeValidator = null;
          }
          if (unsubscribeHookDiscovery !== null) {
            unsubscribeHookDiscovery();
            unsubscribeHookDiscovery = null;
          }
          if (unsubscribeEventRouter !== null) {
            unsubscribeEventRouter();
            unsubscribeEventRouter = null;
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

    // ------------------------------------------------------------------
    // GET /projects/:id — look up a project row by UUID
    //
    // Response: { id, path, displayName, lastOpenedAt }
    // Returns 404 if the project is not found or is soft-deleted.
    // ------------------------------------------------------------------
    const projectMatch = url.pathname.match(/^\/projects\/([^/]+)$/);
    if (projectMatch !== null && req.method === "GET") {
      const projectId = projectMatch[1];
      interface ProjectLookupRow {
        id: string;
        path: string;
        display_name: string;
        last_opened_at: number;
      }
      const row = db
        .query<
          ProjectLookupRow,
          [string]
        >("SELECT id, path, display_name, last_opened_at FROM projects WHERE id = ? AND deleted_at IS NULL LIMIT 1")
        .get(projectId);
      if (row === null) {
        return Response.json({ error: "Not Found", projectId }, { status: 404 });
      }
      return Response.json(
        {
          id: row.id,
          path: row.path,
          displayName: row.display_name,
          lastOpenedAt: row.last_opened_at,
        },
        { status: 200 },
      );
    }

    // ------------------------------------------------------------------
    // POST /projects — add a new tracked project (Story 3.7 / AC #4)
    //
    // Body: { "projectRoot": "/absolute/path/to/project" }
    //
    // Inserts a projects row with FR-068 defaults.
    // Does NOT auto-activate the project.
    // ------------------------------------------------------------------
    if (url.pathname === "/projects" && req.method === "POST") {
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
        const projectPath = projectRoot.replaceAll("\\", "/");
        const displayName = projectPath.split("/").filter(Boolean).pop() ?? projectPath;
        const now = Date.now();
        const newId = crypto.randomUUID();

        try {
          db.query(
            `INSERT OR IGNORE INTO projects
               (id, workspace_id, author_id, visibility, created_at, updated_at, deleted_at,
                path, display_name, last_opened_at)
             VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
          ).run(
            newId,
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000001",
            "private",
            now,
            now,
            projectPath,
            displayName,
            now,
          );
        } catch (err) {
          log("ERROR", "Sidecar: /projects INSERT failed", {
            projectRoot: projectPath,
            error: String(err),
          });
          return Response.json({ error: "Internal Server Error" }, { status: 500 });
        }

        log("INFO", "Sidecar: project added", { projectRoot: projectPath, id: newId });
        return Response.json({ ok: true, id: newId, projectRoot: projectPath }, { status: 200 });
      });
    }

    // ------------------------------------------------------------------
    // POST /projects/:id/remove — soft-delete a project (Story 3.7 / AC #3)
    //
    // Tombstones: assets, hook_index, route_stacks, recent_files for this
    // project. Sets deleted_at on the projects row itself.
    // ------------------------------------------------------------------
    const removeMatch = url.pathname.match(/^\/projects\/([^/]+)\/remove$/);
    if (removeMatch !== null && req.method === "POST") {
      const projectId = removeMatch[1];
      const now = Date.now();

      try {
        db.transaction(() => {
          // Soft-delete assets rows for project: and local: scopes (AC #3c)
          db.query(
            "UPDATE assets SET deleted_at = ?, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL",
          ).run(now, now, projectId);

          // Soft-delete hook_index rows for project:<id> and local:<id> scopes (AC #3c)
          db.query(
            "UPDATE hook_index SET deleted_at = ?, updated_at = ? WHERE (scope = ? OR scope = ?) AND deleted_at IS NULL",
          ).run(now, now, `project:${projectId}`, `local:${projectId}`);

          // Clear route_stacks rows for this project (AC #3d).
          // route_stacks has no project_id FK (Epic 06 will add scoping).
          // v1 behaviour: tombstone all active route_stacks rows on any project
          // remove — they will be re-created when the next project is activated.
          db.query(
            "UPDATE route_stacks SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL",
          ).run(now, now);

          // Clear recent_files rows for this project (AC #3d)
          db.query(
            "UPDATE recent_files SET deleted_at = ?, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL",
          ).run(now, now, projectId);

          // Soft-delete the project row itself
          db.query(
            "UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
          ).run(now, now, projectId);
        })();
      } catch (err) {
        log("ERROR", "Sidecar: /projects/:id/remove failed", {
          projectId,
          error: String(err),
        });
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
      }

      log("INFO", "Sidecar: project removed (soft-deleted)", { projectId });
      return Response.json({ ok: true, projectId }, { status: 200 });
    }

    // ------------------------------------------------------------------
    // POST /indexer/scan/project — trigger a scoped rescan (Story 3.7 / AC #1d)
    //
    // Body: { "projectRoot": "/absolute/path/to/project" }
    // ------------------------------------------------------------------
    if (url.pathname === "/indexer/scan/project" && req.method === "POST") {
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
        const projectRoot = (body as { projectRoot: string }).projectRoot.replaceAll("\\", "/");

        // Run the scan async — don't await the result to keep the HTTP response fast.
        void runProjectScan(db, projectRoot).catch((err: unknown) => {
          log("ERROR", "Sidecar: runProjectScan failed", {
            projectRoot,
            error: String(err),
          });
        });

        return Response.json({ ok: true, projectRoot }, { status: 200 });
      });
    }

    // ------------------------------------------------------------------
    // POST /indexer/shadows/recompute/:projectId — trigger shadow recompute
    //
    // Called by switch_project after rescan (Story 3.7 / AC #1f).
    // ------------------------------------------------------------------
    const shadowMatch = url.pathname.match(/^\/indexer\/shadows\/recompute\/([^/]+)$/);
    if (shadowMatch !== null && req.method === "POST") {
      const projectId = shadowMatch[1];

      try {
        recomputeShadows(db, projectId);
      } catch (err) {
        log("ERROR", "Sidecar: /indexer/shadows/recompute failed", {
          projectId,
          error: String(err),
        });
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
      }

      log("INFO", "Sidecar: shadow recompute triggered via HTTP", { projectId });
      return Response.json({ ok: true, projectId }, { status: 200 });
    }

    // ------------------------------------------------------------------
    // POST /state/route-stacks — persist outgoing route-stack state
    //
    // Body: { "projectId": string, "stackJson": string }
    // ------------------------------------------------------------------
    if (url.pathname === "/state/route-stacks" && req.method === "POST") {
      return req.json().then((body: unknown) => {
        if (
          typeof body !== "object" ||
          body === null ||
          typeof (body as Record<string, unknown>).stackJson !== "string"
        ) {
          return Response.json(
            { error: "Bad Request", message: "Body must include stackJson: string" },
            { status: 400 },
          );
        }
        const { stackJson } = body as { stackJson: string };
        const now = Date.now();

        try {
          db.query(
            `INSERT OR REPLACE INTO route_stacks
               (id, workspace_id, author_id, visibility, created_at, updated_at, deleted_at,
                tab_id, stack_json, active_index)
             VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 0)`,
          ).run(
            crypto.randomUUID(),
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000001",
            "private",
            now,
            now,
            "default",
            stackJson,
          );
        } catch (err) {
          log("ERROR", "Sidecar: /state/route-stacks INSERT failed", { error: String(err) });
          return Response.json({ error: "Internal Server Error" }, { status: 500 });
        }

        return Response.json({ ok: true }, { status: 200 });
      });
    }

    // ------------------------------------------------------------------
    // POST /state/window-layouts — persist outgoing window-layout state
    //
    // Body: { "projectId": string, "layoutJson": string }
    // ------------------------------------------------------------------
    if (url.pathname === "/state/window-layouts" && req.method === "POST") {
      return req.json().then((body: unknown) => {
        if (
          typeof body !== "object" ||
          body === null ||
          typeof (body as Record<string, unknown>).layoutJson !== "string"
        ) {
          return Response.json(
            { error: "Bad Request", message: "Body must include layoutJson: string" },
            { status: 400 },
          );
        }
        const { layoutJson } = body as { layoutJson: string };
        const now = Date.now();

        try {
          db.query(
            `INSERT OR REPLACE INTO window_layouts
               (id, workspace_id, author_id, visibility, created_at, updated_at, deleted_at,
                layout_name, layout_json)
             VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
          ).run(
            crypto.randomUUID(),
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000001",
            "private",
            now,
            now,
            "default",
            layoutJson,
          );
        } catch (err) {
          log("ERROR", "Sidecar: /state/window-layouts INSERT failed", { error: String(err) });
          return Response.json({ error: "Internal Server Error" }, { status: 500 });
        }

        return Response.json({ ok: true }, { status: 200 });
      });
    }

    // ------------------------------------------------------------------
    // GET /preferences/:key — read a user preference by key
    // ------------------------------------------------------------------
    const prefGetMatch = url.pathname.match(/^\/preferences\/([^/]+)$/);
    if (prefGetMatch !== null && req.method === "GET") {
      const prefKey = prefGetMatch[1];
      interface PrefRow {
        value: string;
      }
      const row = db
        .query<PrefRow, [string]>("SELECT value FROM user_preferences WHERE key = ? LIMIT 1")
        .get(prefKey);
      if (row === null) {
        return Response.json({ error: "Not Found", key: prefKey }, { status: 404 });
      }
      return Response.json({ key: prefKey, value: row.value }, { status: 200 });
    }

    // ------------------------------------------------------------------
    // POST /preferences — upsert a user preference key-value pair
    //
    // Body: { "key": string, "value": string }
    // ------------------------------------------------------------------
    if (url.pathname === "/preferences" && req.method === "POST") {
      return req.json().then((body: unknown) => {
        if (
          typeof body !== "object" ||
          body === null ||
          typeof (body as Record<string, unknown>).key !== "string" ||
          typeof (body as Record<string, unknown>).value !== "string"
        ) {
          return Response.json(
            { error: "Bad Request", message: "Body must be { key: string, value: string }" },
            { status: 400 },
          );
        }
        const { key, value } = body as { key: string; value: string };
        const now = Date.now();

        try {
          db.query(
            "INSERT INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
          ).run(key, value, now);
        } catch (err) {
          log("ERROR", "Sidecar: /preferences upsert failed", { key, error: String(err) });
          return Response.json({ error: "Internal Server Error" }, { status: 500 });
        }

        return Response.json({ ok: true, key }, { status: 200 });
      });
    }

    // ------------------------------------------------------------------
    // POST /editor/open — register a path as currently open for editing
    //
    // Body: { "path": "/absolute/path/to/asset.md" }
    //
    // Adds the path to the editorOpenSet. While registered, watcher events
    // for this path emit AssetExternallyModifiedWhileOpenEvent instead of
    // silently refreshing (FR-006 boundary / AC #5, #6, #7).
    //
    // Returns 400 with { code: "path_not_watched", path } if the path is not
    // under any watched root (AC #7).
    // ------------------------------------------------------------------
    if (url.pathname === "/editor/open" && req.method === "POST") {
      return req.json().then((body: unknown) => {
        if (
          typeof body !== "object" ||
          body === null ||
          typeof (body as Record<string, unknown>).path !== "string"
        ) {
          return Response.json(
            { error: "Bad Request", message: "Body must be { path: string }" },
            { status: 400 },
          );
        }
        const editorPath = (body as { path: string }).path;
        const err = eventRouter.registerOpenEditor(editorPath);
        if (err !== null) {
          return Response.json({ error: "Bad Request", ...err }, { status: 400 });
        }
        return Response.json({ ok: true, path: editorPath }, { status: 200 });
      });
    }

    // ------------------------------------------------------------------
    // POST /editor/close — unregister a path from the editorOpenSet
    //
    // Body: { "path": "/absolute/path/to/asset.md" }
    //
    // Removes the path from the editorOpenSet (no-op if not present).
    // Subsequent watcher events for this path resume the silent-reindex path.
    // ------------------------------------------------------------------
    if (url.pathname === "/editor/close" && req.method === "POST") {
      return req.json().then((body: unknown) => {
        if (
          typeof body !== "object" ||
          body === null ||
          typeof (body as Record<string, unknown>).path !== "string"
        ) {
          return Response.json(
            { error: "Bad Request", message: "Body must be { path: string }" },
            { status: 400 },
          );
        }
        const editorPath = (body as { path: string }).path;
        eventRouter.unregisterOpenEditor(editorPath);
        return Response.json({ ok: true, path: editorPath }, { status: 200 });
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
// CR-1: Orphan-sidecar parent watchdog (Sprint 3 carryover, lands Story 3.7)
//
// Exits cleanly when the Tauri parent process exits. Required because
// dev-mode hot-reload does not always fire RunEvent::Exit on the Rust side;
// without this, orphan sidecars accumulate and block the loopback port on
// the next `bun run tauri` invocation.
//
// Implementation: poll process.ppid every 2 seconds via signal 0 (existence
// check only — no signal is actually delivered). When the parent is gone,
// log and exit(0) so the kernel reclaims the ephemeral port immediately.
//
// process.ppid is a standard Node.js built-in property (not a function).
// Bun supports it natively. No import needed.
//
// 2-second cadence: low CPU cost (~0.05 % on macOS), fast enough to free
// the port before the user's next `bun run tauri` attempt typically completes
// its cold-start Rust compilation.
// ---------------------------------------------------------------------------

export const PARENT_PID_FOR_TEST = process.ppid;

setInterval(() => {
  try {
    // Signal 0 probes process existence without sending a real signal.
    // Throws ESRCH if the process does not exist, EPERM if it exists but
    // we lack permission (parent always gives permission to own children).
    process.kill(PARENT_PID_FOR_TEST, 0);
  } catch {
    // Parent process is gone — exit so the loopback port is freed.
    log("INFO", "Sidecar: parent process gone — orphan watchdog exiting", {
      parentPid: PARENT_PID_FOR_TEST,
    });
    process.exit(0);
  }
}, 2000);

// ---------------------------------------------------------------------------
// Cold-launch asset scan (Epic 03, Story 3.3)
// Sequencing: runMigrations() → runColdLaunchScan()
//             → runShadowRecomputeAll() (Story 3.4)
//             → startGlobalWatcher() (Story 3.2)
//
// Shadow recompute runs AFTER the cold-launch scan so that all INSERT OR IGNORE
// rows are committed before we stamp shadowed_by_project_id. This is required
// on every launch (not just first) because INSERT OR IGNORE leaves existing rows
// untouched (shadowed_by_project_id stays NULL from the previous run's state).
// ---------------------------------------------------------------------------

void runColdLaunchScan(db)
  .then(async (totals) => {
    log("INFO", "ZoePlane sidecar cold-launch scan complete — running shadow recompute", {
      totals,
    });
    // ---------------------------------------------------------------------------
    // Shadow recompute (Epic 03, Story 3.4)
    // Stamps shadowed_by_project_id on global rows that have project-scoped
    // counterparts. Must run before the FS watcher starts to ensure the index
    // reflects the current overlay state before any real-time events fire.
    // ---------------------------------------------------------------------------
    runShadowRecomputeAll(db);
    log("INFO", "ZoePlane sidecar shadow recompute complete — starting validation pipeline");
    // ---------------------------------------------------------------------------
    // Validation pipeline (Epic 03, Story 3.5)
    // Re-stamps validation_status and front_matter_json for every asset row.
    // Runs after runColdLaunchScan() so all INSERT OR IGNORE rows are committed.
    // Runs after runShadowRecomputeAll() (touches different columns; order is
    // acceptable either way — shadow and validation are independent columns).
    // ---------------------------------------------------------------------------
    await runValidationPipeline(db);
    log("INFO", "ZoePlane sidecar validation pipeline complete — starting hook discovery");
    // ---------------------------------------------------------------------------
    // Hook discovery (Epic 03, Story 3.6)
    // Upserts all hooks from ~/.claude/settings.json and every tracked project's
    // settings.json / settings.local.json into hook_index. Runs after the
    // validation pipeline so the asset index is fully current before hooks are
    // indexed. Emits HookIndexCompletedEvent when done.
    // ---------------------------------------------------------------------------
    await runHookDiscovery(db);
    log("INFO", "ZoePlane sidecar hook discovery complete — running editor detection");
    // ---------------------------------------------------------------------------
    // Editor detection (Epic 03, Story 3.9 — FR-035)
    //
    // Runs ONCE per launch when user_preferences.detected_editor is NULL.
    // Probes `which code` → `which cursor` → `which zed` (or `where` on Windows).
    // Persists the first found editor as { name, cli } JSON.
    // If none found, persists { name: "system", cli: null } so the fallback
    // chain terminates predictably on subsequent launches (AC #4).
    // ---------------------------------------------------------------------------
    interface PrefRow {
      value: string;
    }
    const existingEditorPref = db
      .query<PrefRow, [string]>("SELECT value FROM user_preferences WHERE key = ? LIMIT 1")
      .get("detected_editor");
    if (existingEditorPref === null) {
      const detected = await detectEditor();
      const editorValue =
        detected !== null
          ? JSON.stringify({ name: detected.name, cli: detected.cli })
          : JSON.stringify({ name: "system", cli: null });
      const now = Date.now();
      db.query(
        "INSERT INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      ).run("detected_editor", editorValue, now);
      if (detected !== null) {
        log("INFO", "ZoePlane sidecar editor detected and persisted", {
          name: detected.name,
          cli: detected.cli,
        });
      } else {
        log(
          "INFO",
          "ZoePlane sidecar no supported editor detected on PATH — persisting system fallback",
        );
      }
    } else {
      log("INFO", "ZoePlane sidecar editor preference already set — skipping detection", {
        value: existingEditorPref.value,
      });
    }
    log("INFO", "ZoePlane sidecar editor detection complete — starting FS watcher");
    // ---------------------------------------------------------------------------
    // FS Watcher startup (Epic 03, Story 3.2)
    // Start the global watcher after the cold-launch scan so that
    // WatcherStartedEvent emissions have an active SSE stream to fan out on,
    // and the index already has a warm baseline before the first event fires.
    // ---------------------------------------------------------------------------
    startGlobalWatcher();
    log("INFO", "ZoePlane sidecar FS watcher started");
  })
  .catch((err: unknown) => {
    log("ERROR", "ZoePlane sidecar cold-launch scan failed — starting FS watcher anyway", {
      error: String(err),
    });
    // Start the watcher even if the scan fails so real-time events still flow.
    startGlobalWatcher();
    log("INFO", "ZoePlane sidecar FS watcher started (post-scan-failure fallback)");
  });

// ---------------------------------------------------------------------------
// Event router (Epic 03, Story 3.8 — FR-007)
//
// Replaces the former inline subscribeToWatcherEvents block (Stories 3.4/3.5).
// initEventRouter subscribes to watcher events and dispatches:
//   - created  → INSERT + revalidate + shadow recompute + LibraryRefreshEvent
//   - modified → revalidate + shadow recompute + LibraryRefreshEvent
//               (or AssetExternallyModifiedWhileOpenEvent when path is open)
//   - removed  → tombstone + shadow recompute + LibraryRefreshEvent removed
//   - settings.json → hook reindex (delegated via deps.reindexHooksForPath)
//
// The eventRouter handle exposes registerOpenEditor / unregisterOpenEditor for
// the /editor/open and /editor/close HTTP endpoints below.
// ---------------------------------------------------------------------------

const eventRouter = initEventRouter(db, {
  reindexHooksForPath,
});

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
