/**
 * @zoeplane/shared-types — Shared TypeScript types
 *
 * Types consumed by both the React UI (src/) and the Node.js sidecar (sidecar/).
 * This package is private (not published to npm) — consumed only within the monorepo.
 *
 * Add types here when a data structure must be understood by both processes.
 * Types private to one process live in that process's own source tree.
 */

// Theme contract (ThemeProvider ↔ Plugin SDK)
import type { ThemePreference } from "./theme";
export type { ThemePreference, ResolvedTheme, ThemeChangeMessage } from "./theme";

// Icon allowlist
export type { IconName } from "./icons";

// ============================================================
// Resource taxonomy (PRD §1.9)
// ============================================================

/** The six first-class resource kinds tracked by ZoePlane. */
export type ResourceKind = "skill" | "agent" | "command" | "team" | "workflow" | "hook";

/** Scope of a resource — where it lives on disk. */
export type ResourceScope = "global" | "project" | "local";

/** Base fields shared by all resource kinds. */
export interface BaseResource {
  id: string; // Stable hash of (kind + diskPath)
  kind: ResourceKind;
  name: string;
  diskPath: string; // Absolute path to the source file
  scope: ResourceScope;
  lastModifiedAt: string; // ISO 8601
  validityStatus: "valid" | "warnings" | "invalid";
}

// ============================================================
// Evaluator status vocabulary (ux-spec §1 Principle 6 v1.4)
// ============================================================

/**
 * Evaluator status for evaluator-gated resources (skills, agents, hooks).
 * Commands, teams, and workflows are not evaluator-gated — they carry
 * validityStatus only.
 */
export type EvaluatorStatus =
  | "approved"
  | "pending review"
  | "external — pending review"
  | "quarantined"
  | "declined"
  | "needs re-evaluation"
  | "disabled by you";

// ============================================================
// IPC message envelope
// ============================================================

/**
 * Generic JSON-RPC-style message envelope for sidecar ↔ Tauri IPC.
 * The transport (stdout/stdin vs Unix socket) is decided in Epic 01.
 *
 * TODO (Epic 01): finalize the IPC transport and expand this envelope
 * with the appropriate framing (e.g., Content-Length headers for JSON-RPC over stdio).
 */
export interface IpcMessage<T = unknown> {
  id: string; // Request correlation ID (UUID)
  method: string; // e.g., "indexer.watch_path", "task.spawn"
  params?: T;
}

export interface IpcResponse<T = unknown> {
  id: string; // Matches the request ID
  result?: T;
  error?: IpcError;
}

export interface IpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ============================================================
// Task / run stream types
// ============================================================

/**
 * A single structured event emitted by a running task.
 * Per ux-spec §3.3 and PRD §8.7 (Task Console).
 *
 * TODO (Epic 07): expand with full event discriminated union.
 */
export interface RunEvent {
  taskId: string;
  agentId: string;
  sequence: number; // monotonically increasing per task
  timestamp: string; // ISO 8601
  type: RunEventType;
  payload: unknown;
}

export type RunEventType =
  | "agent.started"
  | "agent.streaming"
  | "agent.tool_use"
  | "agent.awaiting_approval"
  | "agent.completed"
  | "agent.errored"
  | "agent.cancelled"
  | "task.completed"
  | "task.errored";

// ============================================================
// Project context (architect contract 2026-05-14)
// ============================================================

export type { ProjectContext, ProjectOpenEvent, ProjectCloseEvent } from "./project";

// ============================================================
// Project-switch IPC events (Story 3.7 — FR-040)
// ============================================================

/**
 * Emitted by the Tauri `switch_project` command when a project switch
 * completes successfully. The UI uses this to render the new project name
 * and dismiss any loading state.
 */
export interface ProjectSwitchCompletedEvent {
  type: "project:switch:completed";
  projectId: string;
  previousProjectId: string | null;
  elapsedMs: number;
}

/**
 * Emitted by `switch_project` when the target project's `.claude/` directory
 * has been externally deleted since the project was added. The switch
 * completes with an empty rescan; the project remains in the Switcher but
 * its asset count is zero.
 */
export interface ProjectClaudeMissingWarning {
  type: "project:claude:missing";
  projectId: string;
}

/**
 * Emitted by `switch_project` when the Tauri runtime FS scope extension
 * fails (e.g., path resolution error). The previous active project remains
 * active; the UI should surface an error toast.
 */
export interface ProjectSwitchFailedEvent {
  type: "project:switch:failed";
  projectId: string;
  reason: string;
}

// ============================================================
// FS Watcher events (Epic 03, Story 3.2)
// ============================================================

export type {
  AssetIndexUpdatedEvent,
  WatcherStartedEvent,
  WatcherErrorEvent,
  AssetIndexHydratedEvent,
  ValidationCompletedEvent,
  AssetValidationUpdatedEvent,
  HookIndexCompletedEvent,
  LibraryRefreshEvent,
  AssetExternallyModifiedWhileOpenEvent,
  WatcherEvent,
} from "./watcher";
export {
  WATCHER_ASSET_UPDATED,
  WATCHER_STARTED,
  WATCHER_ERROR,
  ASSET_INDEX_HYDRATED,
  VALIDATION_COMPLETED,
  ASSET_VALIDATION_UPDATED,
  HOOK_INDEX_COMPLETED,
  LIBRARY_REFRESH,
  ASSET_EXTERNALLY_MODIFIED_WHILE_OPEN,
} from "./watcher";

// ============================================================
// Epic 03 IPC contract barrel (Story 3.10 — locked Sprint 4 surface)
// ============================================================

export * from "./epic-03";

// ============================================================
// User preferences
// ============================================================

/**
 * User preferences persisted in SQLite.
 * Loaded at startup and available globally.
 *
 * TODO (Epic 10): expand with per-feature preferences.
 */
export interface UserPreferences {
  theme: ThemePreference;
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  commandPaletteHistory: string[]; // recent commands, max 20
}
