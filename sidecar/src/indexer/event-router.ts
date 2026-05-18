// ZoePlane Sidecar — Watcher event router (Story 3.8, FR-007)
//
// Subscribes to AssetIndexUpdatedEvent from watcher.ts and dispatches each
// event to the appropriate handler:
//
//   created  → INSERT new assets row (if not already indexed) + revalidate
//              + shadow recompute + emit LibraryRefreshEvent
//   modified → revalidate + shadow recompute + emit LibraryRefreshEvent
//              (unless path is in editorOpenSet → emit
//               AssetExternallyModifiedWhileOpenEvent instead)
//   removed  → soft-delete assets row (tombstone) + shadow recompute
//              + emit LibraryRefreshEvent{ action: "removed" }
//
// editorOpenSet registration:
//   POST /editor/open  { path: string } → adds path to editorOpenSet
//   POST /editor/close { path: string } → removes path from editorOpenSet
//
// Paths in editorOpenSet must be under a watched root (isPathWatched guard).
// Normalization: backslash → forward-slash at entry only (AC-8 Windows-CI
// compliance). path.resolve() is NOT used because callers always pass absolute
// paths (chokidar emits absolute; Tauri command boundary applies to_posix()).
// Drive-letter prefixes (Windows D:/...) are preserved as-is for DB consistency.
//
// Exports:
//   initEventRouter(db, deps) → { unsubscribe, registerOpenEditor, unregisterOpenEditor }
//   See EditorRegistrationError for the rejection shape.

import { Database } from "bun:sqlite";
import { join } from "node:path";
import { log } from "../log";
import {
  LIBRARY_REFRESH,
  ASSET_EXTERNALLY_MODIFIED_WHILE_OPEN,
  WATCHER_ASSET_UPDATED,
  type AssetIndexUpdatedEvent,
  type LibraryRefreshEvent,
  type AssetExternallyModifiedWhileOpenEvent,
  type WatcherEvent,
} from "@zoeplane/shared-types";
import { subscribeToWatcherEvents, isPathWatched } from "./watcher";
import { pathToAssetIdentifier } from "./naming";
import { revalidateAsset } from "./validator";
import { recomputeShadows } from "./resolver";
import { insertAssetRow } from "./scanner";

// ---------------------------------------------------------------------------
// Event emission — mirrors the subscriber pattern from scanner.ts / validator.ts
// ---------------------------------------------------------------------------

/** Registered SSE subscriber callbacks. Set by index.ts when a client connects. */
const eventSubscribers = new Set<(event: WatcherEvent) => void>();

/**
 * Register a subscriber to receive event-router events
 * (LibraryRefreshEvent, AssetExternallyModifiedWhileOpenEvent).
 * Returns an unsubscribe function. Same API as subscribeToScannerEvents.
 */
export function subscribeToEventRouterEvents(callback: (event: WatcherEvent) => void): () => void {
  eventSubscribers.add(callback);
  return () => {
    eventSubscribers.delete(callback);
  };
}

function emitEvent(event: WatcherEvent): void {
  for (const sub of eventSubscribers) {
    try {
      sub(event);
    } catch (err) {
      log("WARN", "EventRouter: subscriber threw during event emission", {
        eventType: event.type,
        error: String(err),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Dependencies injected at init time
// ---------------------------------------------------------------------------

export interface EventRouterDeps {
  /** Hook reindex callback — for settings.json / settings.local.json events. */
  reindexHooksForPath?: (db: Database, path: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Editor open set registration error
// ---------------------------------------------------------------------------

/** Structured rejection returned when register_open_editor validation fails. */
export interface EditorRegistrationError {
  code: "path_not_watched";
  path: string;
}

// ---------------------------------------------------------------------------
// Tombstone helper — soft-delete assets row for a removed file
// ---------------------------------------------------------------------------

/**
 * Soft-delete the assets row for `sourcePath` by setting deleted_at = now.
 * Returns the asset UUID if a row was found and tombstoned, or null if the row
 * did not exist (e.g., it was never indexed).
 */
function tombstoneAssetRow(db: Database, sourcePath: string): string | null {
  interface AssetIdRow {
    id: string;
  }
  const row = db
    .query<
      AssetIdRow,
      [string]
    >("SELECT id FROM assets WHERE source_path = ? AND deleted_at IS NULL LIMIT 1")
    .get(sourcePath);

  if (row === null) {
    log("WARN", "EventRouter: tombstoneAssetRow — no live row found for path (already removed?)", {
      sourcePath,
    });
    return null;
  }

  const now = Date.now();
  db.query(
    "UPDATE assets SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
  ).run(now, now, row.id);

  log("INFO", "EventRouter: tombstoned asset row", { sourcePath, assetId: row.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Project-id lookup helper
// ---------------------------------------------------------------------------

/**
 * Look up the projects.id UUID for a given projectRoot path.
 * Returns null if the root is not tracked or is soft-deleted.
 */
function lookupProjectId(db: Database, projectRoot: string): string | null {
  interface ProjectIdRow {
    id: string;
  }
  const row = db
    .query<
      ProjectIdRow,
      [string]
    >("SELECT id FROM projects WHERE path = ? AND deleted_at IS NULL LIMIT 1")
    .get(projectRoot);
  return row?.id ?? null;
}

// ---------------------------------------------------------------------------
// Derive claudeRoot from an asset path + projectRoot
// ---------------------------------------------------------------------------

function deriveClaudeRoot(_assetPath: string, projectRoot: string | null): string {
  if (projectRoot !== null) {
    return join(projectRoot, ".claude");
  }
  // Global root: use HOME/.claude
  return join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".claude");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface EventRouterHandle {
  /** Unsubscribe from the watcher event stream and clean up resources. */
  unsubscribe: () => void;
  /**
   * Add a path to the editorOpenSet.
   *
   * Canonicalizes and POSIX-normalises `path` before insertion.
   * Returns an EditorRegistrationError if the path is not under any watched root.
   */
  registerOpenEditor: (path: string) => EditorRegistrationError | null;
  /** Remove a path from the editorOpenSet (no-op if not present). */
  unregisterOpenEditor: (path: string) => void;
}

/**
 * Initialize the watcher event router.
 *
 * Subscribes to the watcher event stream and dispatches each
 * `AssetIndexUpdatedEvent` through the silent-reindex pipeline (FR-007).
 *
 * @param db    Open bun:sqlite Database instance.
 * @param deps  Optional injected callbacks (hook reindex, etc.).
 * @returns     A handle with unsubscribe + editorOpenSet management methods.
 */
export function initEventRouter(db: Database, deps: EventRouterDeps): EventRouterHandle {
  // -------------------------------------------------------------------------
  // editorOpenSet — POSIX-normalized absolute paths of files open for editing.
  // -------------------------------------------------------------------------
  const editorOpenSet = new Set<string>();

  function normalizePath(p: string): string {
    return p.replaceAll("\\", "/");
  }

  // -------------------------------------------------------------------------
  // Watcher event subscriber
  // -------------------------------------------------------------------------

  const unsubscribe = subscribeToWatcherEvents((event: WatcherEvent) => {
    if (event.type !== WATCHER_ASSET_UPDATED) {
      return;
    }

    const { path: assetPath, projectRoot, eventKind } = event as AssetIndexUpdatedEvent;

    // -----------------------------------------------------------------------
    // Settings file hook reindex — delegate to index.ts hook handler if wired.
    // -----------------------------------------------------------------------
    if (
      deps.reindexHooksForPath !== undefined &&
      (assetPath.endsWith("settings.json") || assetPath.endsWith("settings.local.json"))
    ) {
      deps.reindexHooksForPath(db, assetPath).catch((err: unknown) => {
        log("ERROR", "EventRouter: per-event hook reindex failed", {
          assetPath,
          error: String(err),
        });
      });
    }

    const normalizedPath = normalizePath(assetPath);
    const isOpen = editorOpenSet.has(normalizedPath);

    // -----------------------------------------------------------------------
    // Derive (kind, name) — needed for most dispatch branches.
    // -----------------------------------------------------------------------
    const claudeRoot = deriveClaudeRoot(assetPath, projectRoot);
    const identifier = pathToAssetIdentifier(assetPath, claudeRoot);

    // -----------------------------------------------------------------------
    // REMOVED — tombstone + shadow recompute + LibraryRefreshEvent removed
    // -----------------------------------------------------------------------
    if (eventKind === "removed") {
      tombstoneAssetRow(db, normalizedPath);

      // One lookup covers both shadow recompute and LibraryRefreshEvent emission.
      const removedProjectId = projectRoot !== null ? lookupProjectId(db, projectRoot) : null;

      // Shadow recompute only for project-scoped assets.
      if (projectRoot !== null && identifier !== null && removedProjectId !== null) {
        try {
          recomputeShadows(db, removedProjectId, { kind: identifier.kind, name: identifier.name });
        } catch (err) {
          log("ERROR", "EventRouter: per-event shadow recompute failed (removed)", {
            assetPath: normalizedPath,
            error: String(err),
          });
        }
      }

      // Emit LibraryRefreshEvent with action "removed".
      if (identifier !== null) {
        const refreshEvent: LibraryRefreshEvent = {
          type: LIBRARY_REFRESH,
          kind: identifier.kind,
          name: identifier.name,
          scope: projectRoot !== null ? "project" : "global",
          projectId: removedProjectId,
          action: "removed",
          summary: { created: 0, modified: 0, removed: 1 },
        };
        emitEvent(refreshEvent);
      }

      return;
    }

    // -----------------------------------------------------------------------
    // CREATED or MODIFIED — path may or may not be in editorOpenSet.
    // -----------------------------------------------------------------------
    if (eventKind !== "created" && eventKind !== "modified") {
      // "renamed" is reserved/future — skip.
      return;
    }

    if (identifier === null) {
      // Not a recognised asset file (e.g., .DS_Store, partial directory).
      return;
    }

    const projectId = projectRoot !== null ? lookupProjectId(db, projectRoot) : null;
    const scope = projectRoot !== null ? ("project" as const) : ("global" as const);

    // -----------------------------------------------------------------------
    // Modified-while-open path (AC #5 / AC #6 / AC #7)
    // -----------------------------------------------------------------------
    if (isOpen && eventKind === "modified") {
      // Data layer ALWAYS stays current — revalidate silently.
      revalidateAsset(db, normalizedPath, identifier.kind).catch((err: unknown) => {
        log("ERROR", "EventRouter: per-event revalidation failed (open path)", {
          assetPath: normalizedPath,
          kind: identifier.kind,
          error: String(err),
        });
      });

      // Emit the editor-conflict event instead of LibraryRefreshEvent.
      const conflictEvent: AssetExternallyModifiedWhileOpenEvent = {
        type: ASSET_EXTERNALLY_MODIFIED_WHILE_OPEN,
        path: normalizedPath,
        projectId,
      };
      emitEvent(conflictEvent);

      log("INFO", "EventRouter: asset modified while open — emitting conflict event", {
        assetPath,
        projectId,
      });
      return;
    }

    // -----------------------------------------------------------------------
    // Silent-reindex path (AC #1 — created, AC #2 — modified, not open)
    // -----------------------------------------------------------------------

    // For "created" events: INSERT the row if it doesn't exist yet.
    if (eventKind === "created") {
      insertAssetRow(db, normalizedPath, scope, projectId)
        .then((newId) => {
          if (newId !== null) {
            // New row inserted — revalidate it immediately to stamp
            // validation_status from real front-matter content.
            return revalidateAsset(db, normalizedPath, identifier.kind);
          }
          // Row already existed (INSERT OR IGNORE no-op) — still revalidate
          // in case the file was recreated with new content.
          return revalidateAsset(db, normalizedPath, identifier.kind);
        })
        .then(() => {
          // Shadow recompute for project-scoped assets.
          if (projectRoot !== null && projectId !== null) {
            try {
              recomputeShadows(db, projectId, {
                kind: identifier.kind,
                name: identifier.name,
              });
            } catch (err) {
              log("ERROR", "EventRouter: per-event shadow recompute failed (created)", {
                assetPath: normalizedPath,
                error: String(err),
              });
            }
          }

          // Emit LibraryRefreshEvent.
          const refreshEvent: LibraryRefreshEvent = {
            type: LIBRARY_REFRESH,
            kind: identifier.kind,
            name: identifier.name,
            scope,
            projectId,
            validityStatus: undefined, // validator will have updated the row; Epic 06 can re-query
            action: "inserted",
            summary: { created: 1, modified: 0, removed: 0 },
          };
          emitEvent(refreshEvent);
        })
        .catch((err: unknown) => {
          log("ERROR", "EventRouter: created-event pipeline failed", {
            assetPath: normalizedPath,
            error: String(err),
          });
        });
      return;
    }

    // eventKind === "modified", path NOT in editorOpenSet.
    revalidateAsset(db, normalizedPath, identifier.kind)
      .then(() => {
        // Shadow recompute for project-scoped assets.
        if (projectRoot !== null && projectId !== null) {
          try {
            recomputeShadows(db, projectId, {
              kind: identifier.kind,
              name: identifier.name,
            });
          } catch (err) {
            log("ERROR", "EventRouter: per-event shadow recompute failed (modified)", {
              assetPath: normalizedPath,
              error: String(err),
            });
          }
        }

        // Emit LibraryRefreshEvent.
        const refreshEvent: LibraryRefreshEvent = {
          type: LIBRARY_REFRESH,
          kind: identifier.kind,
          name: identifier.name,
          scope,
          projectId,
          validityStatus: undefined,
          action: "updated",
          summary: { created: 0, modified: 1, removed: 0 },
        };
        emitEvent(refreshEvent);
      })
      .catch((err: unknown) => {
        log("ERROR", "EventRouter: modified-event pipeline failed", {
          assetPath: normalizedPath,
          error: String(err),
        });
      });
  });

  // -------------------------------------------------------------------------
  // editorOpenSet management
  // -------------------------------------------------------------------------

  function registerOpenEditor(path: string): EditorRegistrationError | null {
    const normalized = normalizePath(path);
    if (!isPathWatched(normalized)) {
      log("WARN", "EventRouter: registerOpenEditor — path not under any watched root", {
        path: normalized,
      });
      return { code: "path_not_watched", path: normalized };
    }
    editorOpenSet.add(normalized);
    log("INFO", "EventRouter: registerOpenEditor — path added to editorOpenSet", {
      path: normalized,
      setSize: editorOpenSet.size,
    });
    return null;
  }

  function unregisterOpenEditor(path: string): void {
    const normalized = normalizePath(path);
    editorOpenSet.delete(normalized);
    log("INFO", "EventRouter: unregisterOpenEditor — path removed from editorOpenSet", {
      path: normalized,
      setSize: editorOpenSet.size,
    });
  }

  return { unsubscribe, registerOpenEditor, unregisterOpenEditor };
}
