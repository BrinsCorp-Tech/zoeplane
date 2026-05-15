// ZoePlane Sidecar — FS Watcher Service
//
// Implements the chokidar-based watcher layer decided in ADR-005.
//
// Design:
//   - Single chokidar FSWatcher instance shared across all watch roots.
//   - Global roots (~/.claude/{skills,agents,commands,teams,workflows,settings.json})
//     are registered at startup via startGlobalWatcher().
//   - Per-project root (<projectRoot>/.claude/) is added via startProjectWatcher()
//     and removed via stopProjectWatcher().
//   - 250 ms coalescing window per-path (FR-077): same-path events within the
//     window are collapsed into a single AssetIndexUpdatedEvent emission.
//   - Out-of-root events do not occur by design (chokidar only emits for paths
//     it was told to watch), but a defensive debug log is included at the handler
//     boundary (gated by DEBUG=watcher:*).
//   - Errors are logged + emitted as WatcherErrorEvent; the watcher continues
//     running for all other roots.
//
// See ADR-005 for full rationale.

import { watch as chokidarWatch, type FSWatcher } from "chokidar";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync, accessSync, constants as fsConstants } from "node:fs";
import { log } from "../log";
import {
  WATCHER_ASSET_UPDATED,
  WATCHER_STARTED,
  WATCHER_ERROR,
  type AssetIndexUpdatedEvent,
  type WatcherStartedEvent,
  type WatcherErrorEvent,
  type WatcherEvent,
} from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// Debug logging — gated by DEBUG=watcher:*
// ---------------------------------------------------------------------------

const DEBUG_ENABLED =
  process.env.DEBUG !== undefined &&
  (process.env.DEBUG === "*" ||
    process.env.DEBUG.split(",").some((s) => s.trim() === "watcher:*" || s.trim() === "watcher"));

function debugLog(message: string, extra?: Record<string, unknown>): void {
  if (DEBUG_ENABLED) {
    console.debug(JSON.stringify({ level: "DEBUG", channel: "watcher", message, ...extra }));
  }
}

// ---------------------------------------------------------------------------
// Event emission — subscribers (SSE connections in index.ts) receive events
// ---------------------------------------------------------------------------

/** Registered SSE subscriber callbacks. Set by index.ts when a client connects. */
const eventSubscribers = new Set<(event: WatcherEvent) => void>();

/** Register a subscriber to receive watcher events. Returns an unsubscribe function. */
export function subscribeToWatcherEvents(callback: (event: WatcherEvent) => void): () => void {
  eventSubscribers.add(callback);
  return () => {
    eventSubscribers.delete(callback);
  };
}

function emit(event: WatcherEvent): void {
  for (const sub of eventSubscribers) {
    try {
      sub(event);
    } catch (err) {
      log("WARN", "Watcher: subscriber threw during event emission", {
        eventType: event.type,
        error: String(err),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Coalescing state
// ---------------------------------------------------------------------------

// Map<absolutePath, timeoutHandle> — cleared on each new event for that path,
// reset with a 250 ms delay. On fire: emit AssetIndexUpdatedEvent.
const coalescingMap = new Map<string, ReturnType<typeof setTimeout>>();

// Track the last event kind per path so the emitted event has the right kind.
const lastEventKind = new Map<string, AssetIndexUpdatedEvent["eventKind"]>();

// Map<absolutePath, projectRoot | null> — so we can stamp the event correctly.
const pathToProjectRoot = new Map<string, string | null>();

// ---------------------------------------------------------------------------
// Watch root registry — used to attribute events to projects
// ---------------------------------------------------------------------------

// Set of global root absolute paths (registered at startup).
const globalRoots = new Set<string>();

// Map<projectRoot, absoluteWatchPath> — per-project roots.
const projectRootMap = new Map<string, string>();

// ---------------------------------------------------------------------------
// Chokidar instance
// ---------------------------------------------------------------------------

let watcher: FSWatcher | null = null;

// ---------------------------------------------------------------------------
// Chokidar event name → our event kind
// ---------------------------------------------------------------------------

// The chokidar "all" event delivers any EventName value; we only process the
// five file-change events below and discard others (e.g., "ready", "error").
type FileEventName = "add" | "addDir" | "change" | "unlink" | "unlinkDir";

function isFileEventName(event: string): event is FileEventName {
  return (
    event === "add" ||
    event === "addDir" ||
    event === "change" ||
    event === "unlink" ||
    event === "unlinkDir"
  );
}

function mapEventKind(event: FileEventName): AssetIndexUpdatedEvent["eventKind"] {
  switch (event) {
    case "add":
      return "created";
    case "addDir":
      return "created";
    case "change":
      return "modified";
    case "unlink":
      return "removed";
    case "unlinkDir":
      return "removed";
  }
}

// ---------------------------------------------------------------------------
// Path → project root resolution
// ---------------------------------------------------------------------------

function resolveProjectRoot(absolutePath: string): string | null {
  // Check per-project roots first (more specific).
  for (const [projectRoot, watchPath] of projectRootMap.entries()) {
    if (absolutePath.startsWith(watchPath)) {
      return projectRoot;
    }
  }
  // Check global roots.
  for (const root of globalRoots) {
    if (absolutePath.startsWith(root)) {
      return null; // global root → no projectRoot
    }
  }
  // Unexpected path — chokidar should not fire for unregistered roots,
  // but log defensively.
  debugLog("Received event for unexpected path (not under any registered root)", {
    path: absolutePath,
  });
  return null;
}

// ---------------------------------------------------------------------------
// Coalescing handler — called for every chokidar event
// ---------------------------------------------------------------------------

function handleFsEvent(chokidarEvent: FileEventName, absolutePath: string): void {
  const kind = mapEventKind(chokidarEvent);
  const resolved = resolve(absolutePath);

  // Update the last-seen event kind for this path.
  lastEventKind.set(resolved, kind);

  // Resolve the project root attribution (may be null for global roots).
  pathToProjectRoot.set(resolved, resolveProjectRoot(resolved));

  // Clear any existing timer for this path and set a new 250 ms window.
  const existing = coalescingMap.get(resolved);
  if (existing !== undefined) {
    clearTimeout(existing);
  }

  const handle = setTimeout(() => {
    coalescingMap.delete(resolved);

    const eventKind = lastEventKind.get(resolved) ?? kind;
    lastEventKind.delete(resolved);

    const projectRoot = pathToProjectRoot.get(resolved) ?? null;
    pathToProjectRoot.delete(resolved);

    const event: AssetIndexUpdatedEvent = {
      type: WATCHER_ASSET_UPDATED,
      path: resolved,
      eventKind,
      projectRoot,
    };

    debugLog("Coalescing window closed — emitting AssetIndexUpdatedEvent", {
      path: resolved,
      eventKind,
      projectRoot,
    });

    emit(event);
  }, 250);

  coalescingMap.set(resolved, handle);
}

// ---------------------------------------------------------------------------
// Initialise the shared chokidar watcher instance
// ---------------------------------------------------------------------------

function ensureWatcher(): FSWatcher {
  if (watcher !== null) {
    return watcher;
  }

  watcher = chokidarWatch([], {
    persistent: true,
    ignoreInitial: true, // Don't emit events for existing files at startup.
    followSymlinks: false,
    usePolling: false, // Use node:fs.watch (kernel-level FS events) natively.
    // chokidar v5 swallows EACCES/EPERM internally at runtime to prevent
    // crashes. Start-time errors are surfaced via explicit existsSync +
    // accessSync pre-checks in startGlobalWatcher/startProjectWatcher.
    ignorePermissionErrors: true,
  });

  // Wire the "all" event to our coalescing handler.
  // The "all" event delivers any EventName value (add, addDir, change, unlink,
  // unlinkDir, ready, raw, error). We guard to the five file-change events only.
  watcher.on("all", (event: string, path: string) => {
    if (isFileEventName(event)) {
      handleFsEvent(event, path);
    }
  });

  // Wire rename events — chokidar emits "unlink" + "add" for atomic renames.
  // These collapse within the 250 ms window per the coalescing design.
  // No additional handling needed beyond the "all" listener above.

  watcher.on("error", (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    log("WARN", "Watcher: chokidar error event", { error: message });
    const event: WatcherErrorEvent = {
      type: WATCHER_ERROR,
      root: "(unknown — OS-level error)",
      reason: message,
    };
    emit(event);
  });

  watcher.on("ready", () => {
    log("INFO", "Watcher: chokidar instance ready");
  });

  return watcher;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register the global `~/.claude/` watch roots at sidecar startup.
 * Called once from `index.ts` immediately after the HTTP server starts.
 *
 * Roots:
 *   - ~/.claude/skills/        (recursive)
 *   - ~/.claude/agents/        (recursive)
 *   - ~/.claude/commands/      (recursive)
 *   - ~/.claude/teams/         (recursive)
 *   - ~/.claude/workflows/     (recursive)
 *   - ~/.claude/settings.json  (file, non-recursive)
 */
export function startGlobalWatcher(): void {
  const home = homedir();
  const claudeDir = join(home, ".claude");

  const rootsToWatch = [
    join(claudeDir, "skills"),
    join(claudeDir, "agents"),
    join(claudeDir, "commands"),
    join(claudeDir, "teams"),
    join(claudeDir, "workflows"),
    join(claudeDir, "settings.json"),
  ];

  const fsw = ensureWatcher();

  for (const root of rootsToWatch) {
    if (!existsSync(root)) {
      log("WARN", "Watcher: global root does not exist — skipping (will not watch)", { root });
      const missingEvent: WatcherErrorEvent = {
        type: WATCHER_ERROR,
        root: resolve(root),
        reason: "global_root_missing",
      };
      emit(missingEvent);
      continue;
    }

    try {
      accessSync(root, fsConstants.R_OK);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? "UNKNOWN";
      log("WARN", "Watcher: global root is not readable — skipping (will not watch)", {
        root,
        code,
      });
      const permEvent: WatcherErrorEvent = {
        type: WATCHER_ERROR,
        root: resolve(root),
        reason: "global_root_permission_denied",
      };
      emit(permEvent);
      continue;
    }

    globalRoots.add(resolve(root));
    fsw.add(root);

    log("INFO", "Watcher: registered global root", { root });

    const event: WatcherStartedEvent = {
      type: WATCHER_STARTED,
      root: resolve(root),
      projectRoot: null,
    };
    emit(event);
  }
}

/**
 * Add a per-project watch root when a project is opened.
 *
 * @param projectRoot  Absolute path to the project root (e.g. "/Users/zeke/MyProject").
 *
 * Behaviour:
 *  - Verifies `<projectRoot>/.claude/` exists.
 *  - If missing: emits WatcherErrorEvent with reason "project_claude_missing"; does NOT add.
 *  - If already watched: no-op (idempotent).
 *  - On success: emits WatcherStartedEvent.
 */
export function startProjectWatcher(projectRoot: string): void {
  const resolvedRoot = resolve(projectRoot);
  const claudePath = join(resolvedRoot, ".claude");

  if (!existsSync(claudePath)) {
    log("WARN", "Watcher: project .claude/ directory does not exist", {
      projectRoot: resolvedRoot,
      claudePath,
    });
    const event: WatcherErrorEvent = {
      type: WATCHER_ERROR,
      root: claudePath,
      reason: "project_claude_missing",
    };
    emit(event);
    return;
  }

  if (projectRootMap.has(resolvedRoot)) {
    debugLog("startProjectWatcher called for already-watched project (no-op)", {
      projectRoot: resolvedRoot,
    });
    return;
  }

  const resolvedClaudePath = resolve(claudePath);
  projectRootMap.set(resolvedRoot, resolvedClaudePath);

  const fsw = ensureWatcher();
  fsw.add(claudePath);

  log("INFO", "Watcher: registered project root", {
    projectRoot: resolvedRoot,
    watchPath: resolvedClaudePath,
  });

  const event: WatcherStartedEvent = {
    type: WATCHER_STARTED,
    root: resolvedClaudePath,
    projectRoot: resolvedRoot,
  };
  emit(event);
}

/**
 * Remove a per-project watch root when the project is closed.
 *
 * @param projectRoot  Absolute path to the project root.
 *
 * Behaviour:
 *  - If the project root was not being watched: no-op.
 *  - Cancels any pending coalescing timers for paths under this root.
 *  - Calls chokidar .unwatch() on the project .claude/ path.
 */
export function stopProjectWatcher(projectRoot: string): void {
  const resolvedRoot = resolve(projectRoot);
  const watchPath = projectRootMap.get(resolvedRoot);

  if (watchPath === undefined) {
    debugLog("stopProjectWatcher called for untracked project (no-op)", {
      projectRoot: resolvedRoot,
    });
    return;
  }

  // Cancel pending coalescing timers for paths under this root.
  let cancelledTimers = 0;
  for (const [path, handle] of coalescingMap.entries()) {
    if (path.startsWith(watchPath)) {
      clearTimeout(handle);
      coalescingMap.delete(path);
      lastEventKind.delete(path);
      pathToProjectRoot.delete(path);
      cancelledTimers++;
    }
  }

  projectRootMap.delete(resolvedRoot);

  if (watcher !== null) {
    watcher.unwatch(watchPath);
  }

  log("INFO", "Watcher: removed project root", {
    projectRoot: resolvedRoot,
    watchPath,
    cancelledTimers,
  });
}

/**
 * Gracefully shut down the watcher instance.
 *
 * Cancels all pending coalescing timers, calls chokidar.close(), and
 * logs the count of watch roots dropped (global + per-project).
 *
 * Called from the SIGTERM / SIGINT handlers in index.ts.
 */
export async function stopWatcher(): Promise<void> {
  // Cancel all pending coalescing timers.
  let pendingTimers = 0;
  for (const [, handle] of coalescingMap.entries()) {
    clearTimeout(handle);
    pendingTimers++;
  }
  coalescingMap.clear();
  lastEventKind.clear();
  pathToProjectRoot.clear();

  const globalRootCount = globalRoots.size;
  const projectRootCount = projectRootMap.size;
  const totalRoots = globalRootCount + projectRootCount;

  globalRoots.clear();
  projectRootMap.clear();

  if (watcher !== null) {
    await watcher.close();
    watcher = null;
  }

  log("INFO", "Watcher: graceful shutdown complete", {
    droppedRoots: totalRoots,
    globalRoots: globalRootCount,
    projectRoots: projectRootCount,
    cancelledCoalescingTimers: pendingTimers,
  });
}
