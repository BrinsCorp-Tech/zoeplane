/**
 * @zoeplane/shared-types — Project context types
 *
 * Architect-resolved contract (2026-05-14): read-only project context
 * for the active open project. Epic 03 owns the runtime mutator that
 * drives the store slice; Sprint 2 exposes only the read-only selector.
 *
 * Used by:
 *   - src/stores/app.ts (projectRoot slice)
 *   - src/hooks/useProject.ts (read-only selector)
 *   - Epic 03 project:open event handler (future — will call _setProjectRoot)
 */

/**
 * Read-only snapshot of the currently active project context.
 * Available via useProject(); null when no project is open.
 */
export interface ProjectContext {
  projectRoot: string;
}

/**
 * IPC event emitted by the sidecar when a project is opened.
 * Epic 03 wires the runtime handler that calls _setProjectRoot.
 */
export interface ProjectOpenEvent {
  type: "project:open";
  projectRoot: string;
}

/**
 * IPC event emitted by the sidecar when the active project is closed.
 * Epic 03 wires the runtime handler that clears projectRoot to null.
 *
 * WARN-1 (Story 3.2): `projectRoot` field added so the FS watcher service
 * knows which per-project watch root to remove on close. Previously omitted;
 * no current consumers existed at the time of this amendment.
 */
export interface ProjectCloseEvent {
  type: "project:close";
  projectRoot: string;
}
