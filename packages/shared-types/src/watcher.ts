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

/** SSE event type name for ValidationCompletedEvent. */
export const VALIDATION_COMPLETED = "validation:completed" as const;

/** SSE event type name for AssetValidationUpdatedEvent. */
export const ASSET_VALIDATION_UPDATED = "asset:validation:updated" as const;

/** SSE event type name for HookIndexCompletedEvent. */
export const HOOK_INDEX_COMPLETED = "hook:index:completed" as const;

/** SSE event type name for LibraryRefreshEvent (Story 3.8 — FR-007). */
export const LIBRARY_REFRESH = "library:refresh" as const;

/**
 * SSE event type name for AssetExternallyModifiedWhileOpenEvent (Story 3.8 — FR-006 boundary).
 * Emitted when a watcher event fires for a path that is registered in the editorOpenSet.
 * Epic 06 editor consumes this to render the FR-006 "modified while editing" banner.
 */
export const ASSET_EXTERNALLY_MODIFIED_WHILE_OPEN = "asset:externally-modified-while-open" as const;

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

/**
 * Emitted once after `runValidationPipeline()` completes at sidecar startup.
 * Carries parse-outcome totals so the UI can render validation badges in the
 * Library sidebar (Epic 06). Also emitted in fallback mode (when gray-matter
 * is unavailable) with `fallback: true`.
 *
 * Story 3.5 is the sole emitter. Consumed by Epic 06 Library views.
 */
export interface ValidationCompletedEvent {
  type: typeof VALIDATION_COMPLETED;
  /** Number of assets that parsed as fully valid (valid YAML front-matter + non-empty body). */
  valid: number;
  /** Number of assets with valid YAML but missing recommended fields or exceeding size cap. */
  warnings: number;
  /** Number of assets with malformed YAML, missing delimiters, or empty body. */
  invalid: number;
  /** Elapsed time in milliseconds from pipeline start to event emission. */
  elapsedMs: number;
  /**
   * True when gray-matter could not be loaded and the pipeline fell back to
   * treating all rows as `valid` with `front_matter_json=NULL`. Only the
   * warning-derivation UI degrades in this case; the index remains usable.
   */
  fallback: boolean;
}

/**
 * Emitted per-asset after a watcher-triggered revalidation completes.
 * The Library card for this asset should refresh its validation badge.
 *
 * Story 3.5 is the sole emitter. Consumed by Epic 06 asset card rendering.
 */
export interface AssetValidationUpdatedEvent {
  type: typeof ASSET_VALIDATION_UPDATED;
  /** UUID of the updated asset row. */
  assetId: string;
  /** Absolute path to the asset file that was revalidated. */
  sourcePath: string;
  /** Asset kind. */
  kind: string;
  /** Updated validation status for the asset. */
  validationStatus: "valid" | "warnings" | "invalid";
}

/**
 * Emitted once after `runHookDiscovery()` completes at sidecar startup.
 * Carries hook-discovery totals so the UI can populate any hook-count badges.
 *
 * Story 3.6 is the sole emitter. Consumed by Epic 09 hook-management views.
 */
export interface HookIndexCompletedEvent {
  type: typeof HOOK_INDEX_COMPLETED;
  /** Total number of hook rows upserted (new or updated) across all scopes. */
  hooksDiscovered: number;
  /** Number of project settings files scanned (user scope is always 1 if present). */
  projectsScanned: number;
  /** Elapsed time in milliseconds from discovery start to event emission. */
  elapsedMs: number;
}

/**
 * Emitted by the event-router once per debounce window, summarising all
 * asset-level changes that occurred within that window. Library views
 * subscribe to this event to re-render without polling.
 *
 * `action` distinguishes three mutually exclusive cases:
 *   - "inserted" — a brand-new file was detected and a new assets row was
 *                  inserted (FR-007, Story 3.8 AC #5).
 *   - "updated"  — an existing file was modified; the row's validation_status
 *                  and front_matter_json have been re-stamped (AC #1, #2).
 *   - "removed"  — the canonical file was deleted; the row has been soft-deleted
 *                  via deleted_at (AC #6).
 *
 * Story 3.8 is the sole emitter. Consumed by Epic 06 Library views.
 */
export interface LibraryRefreshEvent {
  type: typeof LIBRARY_REFRESH;
  /** The asset kind that changed (e.g., "skill", "agent"). */
  kind: string;
  /** Asset name as stored in assets.name. */
  name: string;
  /** Scope of the asset row ("global" | "project" | "local"). */
  scope: string;
  /**
   * Project UUID if the asset is project-scoped, or null for global assets.
   * Library views use this to filter to the active project.
   */
  projectId: string | null;
  /**
   * Current validity status after re-parse. Present for "inserted" and
   * "updated" actions; undefined for "removed" (no row to re-parse).
   */
  validityStatus?: "valid" | "warnings" | "invalid";
  /** Whether this is an insert, update, or soft-delete event. */
  action: "inserted" | "updated" | "removed";
  /**
   * Batch-window summary counters — how many events of each kind were
   * coalesced into this single LibraryRefreshEvent emission.
   */
  summary: {
    created: number;
    modified: number;
    removed: number;
  };
}

/**
 * Emitted when an AssetIndexUpdatedEvent fires for a path that is currently
 * registered in the `editorOpenSet` (i.e., the user has that file open for
 * editing in the Epic 06 editor).
 *
 * The data layer (assets row) IS updated silently as with any other watcher
 * event. However, the silent LibraryRefreshEvent is SUPPRESSED for this path,
 * and this event is emitted instead so Epic 06's editor can render the
 * FR-006 "modified while editing" banner.
 *
 * Story 3.8 is the sole emitter. Consumed by Epic 06 editor surfaces.
 */
export interface AssetExternallyModifiedWhileOpenEvent {
  type: typeof ASSET_EXTERNALLY_MODIFIED_WHILE_OPEN;
  /** Absolute path of the file that was modified externally. */
  path: string;
  /**
   * Project UUID if the file is project-scoped, or null for global assets.
   * The editor uses this to scope its banner to the correct project panel.
   */
  projectId: string | null;
}

/** Union of all watcher event types for exhaustive switching in consumers. */
export type WatcherEvent =
  | AssetIndexUpdatedEvent
  | WatcherStartedEvent
  | WatcherErrorEvent
  | AssetIndexHydratedEvent
  | ValidationCompletedEvent
  | AssetValidationUpdatedEvent
  | HookIndexCompletedEvent
  | LibraryRefreshEvent
  | AssetExternallyModifiedWhileOpenEvent;
