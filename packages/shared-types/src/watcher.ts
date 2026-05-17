/**
 * @zoeplane/shared-types — FS Watcher event types
 *
 * IPC event shapes and channel name constants for the sidecar FS watcher
 * service (Story 3.2, Epic 03). These events are emitted by the sidecar
 * over the SSE event stream (`GET /events`) and consumed by:
 *
 *   - The asset indexer (Stories 3.3–3.5) — triggers re-index on change
 *   - The Project Switcher UI (Epic 06) — renders empty-state CTA on error
 *   - The status bar / indicator (Epic 06) — reflects watcher liveness
 *
 * Channel name constants prevent string-literal drift between the sidecar
 * emitter and UI consumer. Import from `@zoeplane/shared-types` in both.
 */

// ============================================================
// Channel name constants
// ============================================================

/** SSE event type name for AssetIndexUpdatedEvent. */
export const WATCHER_ASSET_UPDATED = "asset:index:updated" as const;

/** SSE event type name for WatcherStartedEvent. */
export const WATCHER_STARTED = "watcher:started" as const;

/** SSE event type name for WatcherErrorEvent. */
export const WATCHER_ERROR = "watcher:error" as const;

/** SSE event type name for AssetIndexHydratedEvent. */
export const ASSET_INDEX_HYDRATED = "asset:index:hydrated" as const;

// ============================================================
// Event shapes
// ============================================================

/**
 * Emitted by the sidecar watcher service after the 250 ms coalescing window
 * closes for a given path. Signals the asset indexer to re-parse the file.
 *
 * `projectRoot` is null for events under the global `~/.claude/` tree.
 */
export interface AssetIndexUpdatedEvent {
  type: typeof WATCHER_ASSET_UPDATED;
  /** Absolute path of the changed file or directory. */
  path: string;
  /** Kind of FS event that triggered the coalescing window. */
  eventKind:
    | "created"
    | "modified"
    | "removed"
    /**
     * Reserved for a future rename-detection layer. NOT emitted by the current
     * chokidar v5 sidecar implementation — atomic renames collapse to "modified"
     * (or "created" if the target path is new) via the 250 ms debounce window.
     */
    | "renamed";
  /** Project root the path belongs to, or null for global roots. */
  projectRoot: string | null;
}

/**
 * Emitted once after the watcher successfully begins watching a root.
 * Consumed by the UI to confirm watch registration (e.g., after project:open).
 *
 * `projectRoot` is null for the global `~/.claude/` roots registered at startup.
 */
export interface WatcherStartedEvent {
  type: typeof WATCHER_STARTED;
  /** The watch root that was registered (absolute path). */
  root: string;
  /** Project root this watch belongs to, or null for global roots. */
  projectRoot: string | null;
}

/**
 * Emitted when the watcher encounters an error registering or maintaining a
 * watch root. The Project Switcher UI (Epic 06) consumes this to render the
 * empty-state CTA when the per-project `.claude/` directory is missing.
 *
 * The watcher continues running for other roots after emitting this event.
 */
export interface WatcherErrorEvent {
  type: typeof WATCHER_ERROR;
  /** The watch root that caused the error (absolute path). */
  root: string;
  /**
   * Machine-readable error reason. Known values:
   *   - "project_claude_missing"       — `<projectRoot>/.claude/` does not exist
   *   - "global_root_missing"          — a global `~/.claude/` sub-path does not exist at startup
   *   - "global_root_permission_denied" — a global root exists but is not readable (EACCES/EPERM)
   *   - Any `Error.message` string for OS-level errors surfaced by the chokidar error event
   *     (e.g., EMFILE — too many open files). Note: chokidar v5 swallows EACCES/EPERM
   *     internally at runtime via `ignorePermissionErrors: true`; start-time permission
   *     errors are caught by explicit `accessSync` pre-checks and use the named reasons above.
   */
  reason: string;
}

/**
 * Emitted once after `runColdLaunchScan()` completes at sidecar startup.
 * Carries totals for each asset kind plus elapsed time so the UI sidebar
 * can populate item-count badges (loading-architecture §"cold-launch badges").
 *
 * Story 3.3 is the sole emitter. Consumed by Epic 06 sidebar rendering.
 */
export interface AssetIndexHydratedEvent {
  type: typeof ASSET_INDEX_HYDRATED;
  /**
   * Number of global-scope skill files enumerated and submitted for insert.
   * Some may be no-ops on re-launch due to `ON CONFLICT DO NOTHING` in the DB layer.
   */
  skills: number;
  /**
   * Number of global-scope agent files enumerated and submitted for insert.
   * Some may be no-ops on re-launch due to `ON CONFLICT DO NOTHING` in the DB layer.
   */
  agents: number;
  /**
   * Number of global-scope command files enumerated and submitted for insert.
   * Some may be no-ops on re-launch due to `ON CONFLICT DO NOTHING` in the DB layer.
   */
  commands: number;
  /**
   * Number of global-scope team files enumerated and submitted for insert.
   * Some may be no-ops on re-launch due to `ON CONFLICT DO NOTHING` in the DB layer.
   */
  teams: number;
  /**
   * Number of global-scope workflow files enumerated and submitted for insert.
   * Some may be no-ops on re-launch due to `ON CONFLICT DO NOTHING` in the DB layer.
   */
  workflows: number;
  /**
   * Total project-scoped files enumerated and submitted for insert across all project roots.
   * Some may be no-ops on re-launch due to `ON CONFLICT DO NOTHING` in the DB layer.
   */
  projectScopedCount: number;
  /** Elapsed time in milliseconds from scan start to event emission. */
  elapsedMs: number;
}

/** Union of all watcher event types for exhaustive switching in consumers. */
export type WatcherEvent =
  | AssetIndexUpdatedEvent
  | WatcherStartedEvent
  | WatcherErrorEvent
  | AssetIndexHydratedEvent;
