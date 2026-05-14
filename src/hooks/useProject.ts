/**
 * useProject — read-only accessor for the active project context.
 *
 * Returns the current ProjectContext (projectRoot string) when a project
 * is open, or null when no project is open.
 *
 * Mutators are intentionally NOT exposed in Sprint 2 — Epic 03 owns
 * the runtime `project:open` event handler that drives this slice by
 * calling useAppStore.getState()._setProjectRoot() directly.
 *
 * Implementation note: the hook selects the primitive `projectRoot` string
 * (not a derived object) to avoid creating a new object reference on every
 * render, which would cause infinite re-render loops in Zustand's subscriber
 * model. The ProjectContext wrapper object is constructed in the hook body
 * using useMemo to ensure referential stability.
 *
 * Usage:
 *   const project = useProject();
 *   if (project === null) {
 *     return <span style={{ color: "var(--color-foreground-muted)" }}>No project open</span>;
 *   }
 *   return <span>{project.projectRoot}</span>;
 *
 * @see src/stores/app.ts — AppState.projectRoot + _setProjectRoot
 * @see packages/shared-types/src/project.ts — ProjectContext type
 */

import * as React from "react";
import type { ProjectContext } from "@zoeplane/shared-types";
import { useAppStore } from "../stores/app";

/**
 * Read-only selector for the active project context.
 *
 * Selects the primitive projectRoot string from the store (not a derived object)
 * to prevent new-reference-on-every-render infinite loops. The ProjectContext
 * wrapper is memoized so its reference only changes when projectRoot changes.
 */
export function useProject(): ProjectContext | null {
  // Select the primitive — Zustand compares primitives by value (stable).
  const projectRoot = useAppStore((s) => s.projectRoot);

  // Memoize the wrapper object so consumers don't receive a new reference
  // on every render when projectRoot hasn't changed.
  return React.useMemo(() => (projectRoot !== null ? { projectRoot } : null), [projectRoot]);
}
