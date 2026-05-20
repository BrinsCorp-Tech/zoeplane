/**
 * AgentLibraryEmptyState — empty state for the Agent Library view.
 *
 * Thin wrapper over LibraryEmptyPanel. Supplies agent-specific copy, icon,
 * docs URL, and reveal path segments. The reveal-error state machine and
 * inline alert live in the shared primitive (Story 6.13).
 *
 * Story: 6.2 — Agent Library (original), 6.13 — extraction
 */

import * as React from "react";
import { LibraryEmptyPanel } from "@/components/library-shell/LibraryStatePanel";

/** Canonical Anthropic documentation URL for Claude Code sub-agents. */
const AGENTS_DOCS_URL = "https://docs.claude.com/en/docs/claude-code/sub-agents";

/** Path to the global agents directory (display only). */
const AGENTS_DIR = "~/.claude/agents/";

export function AgentLibraryEmptyState(): React.JSX.Element {
  return (
    <LibraryEmptyPanel
      icon="folder-open"
      iconColor="[color:var(--color-foreground-subtle)]"
      heading="No agents found"
      body={
        <>
          Drop a Claude Code agent definition file into{" "}
          <code className="[font-family:var(--font-mono)] text-xs [color:var(--color-foreground-muted)]">
            {AGENTS_DIR}
          </code>{" "}
          to see it here.
        </>
      }
      ariaLabel="No agents found"
      primaryActionLabel={`Open ${AGENTS_DIR} in Finder`}
      revealDirSegments={[".claude", "agents"]}
      revealErrorMessage="Couldn't open ~/.claude/agents/ — directory may not exist yet."
      learnMoreUrl={AGENTS_DOCS_URL}
      learnMoreLabel="Learn how to author an agent →"
    />
  );
}
