/**
 * @zoeplane/shared-types — Epic 03 IPC contract barrel (Sprint 4 locked surface)
 *
 * This file consolidates every IPC event type and Tauri command signature
 * introduced across Epic 03 (Stories 3.2–3.9) into a single re-export surface
 * for Epic 06 consumers.
 *
 * ADR-007 (`docs/architecture/decisions/ADR-007-epic-03-ipc-contract.md`)
 * documents the lockdown rationale, SemVer policy, and backward-compatibility
 * commitment through v1.0.
 *
 * SemVer policy (summary):
 *   - Additive changes (new events, new optional fields) → minor version bump.
 *   - Field renames, removals, or type narrowing → major version bump + coordinated
 *     Epic 06 amendment required before merge.
 *
 * Import surface for Epic 06:
 *   import type { WatcherStartedEvent, LibraryRefreshEvent, ... } from '@zoeplane/shared-types';
 *
 * All types re-exported here are also available at the package root via the
 * `export * from './epic-03'` line in `index.ts`. Epic 06 consumers should import
 * from `@zoeplane/shared-types` (not deep-import from `./epic-03` directly).
 */

// ============================================================
// FS watcher event types (Story 3.2 — watcher.ts)
// ============================================================

export type {
  /** Emitted once when a watch root is successfully registered. */
  WatcherStartedEvent,
  /**
   * Emitted when the watcher encounters an error registering or maintaining
   * a watch root. Named `WatcherErrorEvent` in the type system.
   * NOTE: the story AC listed this as `WatcherError` — the shipped name is
   * `WatcherErrorEvent`. Use `WatcherErrorEvent` in all consumers.
   */
  WatcherErrorEvent,
  /** Emitted after 250 ms coalescing window closes for a changed path. */
  AssetIndexUpdatedEvent,
  /** Emitted once after cold-launch scan completes (Story 3.3). */
  AssetIndexHydratedEvent,
  /** Emitted per-asset after watcher-triggered revalidation (Story 3.5). */
  AssetValidationUpdatedEvent,
  /** Emitted once after the validation pipeline completes (Story 3.5). */
  ValidationCompletedEvent,
  /**
   * Emitted per batch-window by the event-router (Story 3.8).
   * Carries insert / update / remove action for Library view refresh.
   */
  LibraryRefreshEvent,
  /**
   * Emitted when a watcher event fires for a path in the `editorOpenSet`
   * (Story 3.8 — FR-006 boundary). Triggers the "modified while editing" banner.
   */
  AssetExternallyModifiedWhileOpenEvent,
} from "./watcher";

// ============================================================
// Project-switch event types (Story 3.7)
//
// ProjectSwitchCompletedEvent, ProjectClaudeMissingWarning, and
// ProjectSwitchFailedEvent are defined directly in index.ts (not in a
// separate file) to keep the Epic 03 contract barrel acyclic. They are
// part of the locked Epic 03 surface and documented in ADR-007.
//
// Epic 06 consumers import them from '@zoeplane/shared-types' which
// re-exports everything from index.ts directly.
// ============================================================

// ============================================================
// Tauri command signatures (documented inline for Epic 06)
//
// Runtime invocation goes via @tauri-apps/api/core:
//   import { invoke } from '@tauri-apps/api/core';
//   const result = await invoke<CommandResponse>('switch_project', { ... });
//
// All commands return CommandResponse (ADR-007 AC #7 normalization):
//   On success: { ok: true }
//   On failure: { ok: false, code: string, message: string, path?: string }
//
// No command throws. All error conditions are encoded as ok:false payloads.
// ============================================================

/**
 * switch_project(projectId: string, stackJson?: string, layoutJson?: string): Promise<CommandResponse>
 *
 * Activates a tracked project. Full orchestration:
 *   1. Persists outgoing route_stacks (stackJson) and window_layouts (layoutJson).
 *   2. Updates user_preferences.active_project_id.
 *   3. Extends the runtime FS scope for <projectRoot>/.claude/** (FB-015).
 *   4. POSTs /watcher/project/open to the sidecar.
 *   5. Triggers sidecar rescan (POST /indexer/scan/project).
 *   6. Recomputes shadows (POST /indexer/shadows/recompute/{projectId}).
 *   7. Emits ProjectSwitchCompletedEvent or ProjectSwitchFailedEvent via Tauri.
 *
 * Error codes (ok: false):
 *   - "unknown_project"            — projectId not found in sidecar DB.
 *   - "fs_scope_extension_failed"  — Tauri runtime scope extension failed;
 *                                    previous project remains active.
 *   - "internal_error"             — lock failure or sidecar unreachable.
 */
export declare function switch_project(
  projectId: string,
  stackJson?: string,
  layoutJson?: string,
): Promise<CommandResponse>;

/**
 * add_project(projectRoot: string): Promise<CommandResponse>
 *
 * Registers a new project root without activating it.
 * Verifies <projectRoot>/.claude/ exists, then inserts a projects row via sidecar.
 *
 * Error codes (ok: false):
 *   - "claude_dir_missing"         — <projectRoot>/.claude/ does not exist.
 *   - "claude_dir_not_directory"   — <projectRoot>/.claude exists but is not a directory.
 *   - "internal_error"             — lock failure or sidecar unreachable.
 */
export declare function add_project(projectRoot: string): Promise<CommandResponse>;

/**
 * remove_project(projectId: string): Promise<CommandResponse>
 *
 * Soft-deletes a tracked project:
 *   1. POSTs /watcher/project/close (drops watch root).
 *   2. Logs FS scope gap (Tauri 2.5.1 has no scope-narrow API — v1 known limitation).
 *   3. POSTs /projects/{id}/remove (soft-deletes assets + hook_index rows,
 *      clears route_stacks + recent_files).
 *
 * Error codes (ok: false):
 *   - "unknown_project"   — projectId not found in sidecar DB.
 *   - "internal_error"    — lock failure or sidecar unreachable.
 */
export declare function remove_project(projectId: string): Promise<CommandResponse>;

/**
 * reveal_in_finder(path: string): Promise<CommandResponse>
 *
 * Reveals an asset's canonical disk path in the OS-native file manager.
 *   macOS   — `open -R <path>` (Finder, file selected)
 *   Windows — `explorer /select,<path>` (native backslashes — do NOT POSIX-normalise)
 *   Linux   — `xdg-open <parent_dir>` (freedesktop opener, parent directory)
 *
 * Pre-flight: scope check (scope_denied) + existence check (file_not_found).
 *
 * Error codes (ok: false):
 *   - "scope_denied"              — path is outside the runtime FS scope.
 *   - "file_not_found"            — path does not exist on disk.
 *   - "shell_invocation_failed"   — OS shell command failed.
 */
export declare function reveal_in_finder(path: string): Promise<CommandResponse>;

/**
 * open_in_editor(path: string): Promise<CommandResponse>
 *
 * Opens an asset's canonical disk path in the user's configured editor.
 *   1. Pre-flight: scope check + existence check.
 *   2. Fetches detected_editor from sidecar GET /preferences/detected_editor.
 *      Shape: { name: "vscode"|"cursor"|"zed"|"system", cli: string|null }
 *   3. Invokes <cli> <path>. Falls back to platform default if cli is null or
 *      name is "system": `open` (macOS), `xdg-open` (Linux), `cmd /c start` (Windows).
 *
 * Error codes (ok: false):
 *   - "scope_denied"              — path is outside the runtime FS scope.
 *   - "file_not_found"            — path does not exist on disk.
 *   - "shell_invocation_failed"   — editor invocation failed.
 *   - "internal_error"            — lock failure or sidecar unreachable.
 */
export declare function open_in_editor(path: string): Promise<CommandResponse>;

/**
 * register_open_editor(path: string): Promise<CommandResponse>
 *
 * Registers an asset path as currently open for editing in the sidecar's
 * `editorOpenSet`. While registered, watcher events for `path` emit
 * AssetExternallyModifiedWhileOpenEvent (FR-006 banner) instead of the silent
 * LibraryRefreshEvent (FR-007).
 *
 * Error codes (ok: false):
 *   - "path_not_watched"  — path is not under any watched root.
 *   - "internal_error"    — lock failure or sidecar unreachable.
 */
export declare function register_open_editor(path: string): Promise<CommandResponse>;

/**
 * unregister_open_editor(path: string): Promise<CommandResponse>
 *
 * Removes an asset path from the sidecar's `editorOpenSet`. Subsequent watcher
 * events resume the silent FR-007 reindex path. No-op if path was not registered.
 *
 * Error codes (ok: false):
 *   - "internal_error"  — lock failure or sidecar unreachable.
 */
export declare function unregister_open_editor(path: string): Promise<CommandResponse>;

// ============================================================
// CommandResponse — the shared structured response type
// (Rust: src-tauri/src/commands/response.rs — Story 3.10 AC #7)
// ============================================================

/**
 * Normalised structured response returned by all Epic 03 Tauri commands.
 *
 * On success: `{ ok: true }`
 * On failure: `{ ok: false, code: string, message: string, path?: string }`
 *
 * No command throws. All error conditions are encoded as ok:false payloads,
 * so callers can use a simple discriminated union check:
 *
 *   const result = await invoke<CommandResponse>('reveal_in_finder', { path });
 *   if (!result.ok) {
 *     console.error(result.code, result.message);
 *     return;
 *   }
 *   // success path
 */
export interface CommandResponse {
  ok: boolean;
  code?: string;
  message?: string;
  path?: string;
}
