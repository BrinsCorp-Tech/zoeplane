/**
 * SkillLibraryErrorState — error state for the Skill Library view.
 *
 * Thin wrapper over LibraryErrorPanel. Supplies skill-specific copy, icon,
 * and reveal path segments. The reveal-error state machine and inline alert
 * live in the shared primitive (Story 6.13).
 *
 * Story: 6.3 — Skill Library (original), 6.13 — extraction
 */

import * as React from "react";
import { LibraryErrorPanel } from "@/components/library-shell/LibraryStatePanel";

interface SkillLibraryErrorStateProps {
  /** TanStack Query refetch function — called on Retry click. */
  onRetry: () => void;
}

export function SkillLibraryErrorState({
  onRetry,
}: SkillLibraryErrorStateProps): React.JSX.Element {
  return (
    <LibraryErrorPanel
      icon="alert-circle"
      iconColor="[color:var(--color-danger)]"
      heading="Couldn't load skills"
      body="The sidecar didn't return a response. This is usually a connection issue, not a problem with your skill files."
      ariaLabel="Error loading skills"
      onRetry={onRetry}
      revealDirSegments={[".claude", "skills"]}
      revealErrorMessage="Couldn't open ~/.claude/skills/ — directory may not exist yet."
    />
  );
}
