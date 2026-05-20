/**
 * AgentLibraryErrorState — error state for the Agent Library view.
 *
 * Thin wrapper over LibraryErrorPanel. Supplies agent-specific copy, icon,
 * and reveal path segments. The reveal-error state machine and inline alert
 * live in the shared primitive (Story 6.13).
 *
 * Story: 6.2 — Agent Library (original), 6.13 — extraction
 */

import * as React from "react";
import { LibraryErrorPanel } from "@/components/library-shell/LibraryStatePanel";

interface AgentLibraryErrorStateProps {
  /** TanStack Query refetch function — called on Retry click. */
  onRetry: () => void;
}

export function AgentLibraryErrorState({
  onRetry,
}: AgentLibraryErrorStateProps): React.JSX.Element {
  return (
    <LibraryErrorPanel
      icon="alert-circle"
      iconColor="[color:var(--color-danger)]"
      heading="Couldn't load agents"
      body="The sidecar didn't return a response. This is usually a connection issue, not a problem with your agent files."
      ariaLabel="Error loading agents"
      onRetry={onRetry}
      revealDirSegments={[".claude", "agents"]}
      revealErrorMessage="Couldn't open ~/.claude/agents/ — directory may not exist yet."
    />
  );
}
