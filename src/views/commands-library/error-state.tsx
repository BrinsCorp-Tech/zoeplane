/**
 * CommandsLibraryErrorState — error state for the Commands Library view.
 *
 * Thin wrapper over LibraryErrorPanel. Supplies command-specific copy, icon,
 * and reveal path segments. The reveal-error state machine and inline alert
 * live in the shared primitive (Story 6.13).
 *
 * Story: 6.6 — Commands Library (FR-011)
 */

import * as React from "react";
import { LibraryErrorPanel } from "@/components/library-shell/LibraryStatePanel";

interface CommandsLibraryErrorStateProps {
  /** TanStack Query refetch function — called on Retry click. */
  onRetry: () => void;
}

export function CommandsLibraryErrorState({
  onRetry,
}: CommandsLibraryErrorStateProps): React.JSX.Element {
  return (
    <LibraryErrorPanel
      icon="alert-circle"
      iconColor="[color:var(--color-danger)]"
      heading="Couldn't load commands"
      body="The sidecar didn't return a response. This is usually a connection issue, not a problem with your command files."
      ariaLabel="Error loading commands"
      onRetry={onRetry}
      revealDirSegments={[".claude", "commands"]}
      revealErrorMessage="Couldn't open ~/.claude/commands/ — directory may not exist yet."
    />
  );
}
