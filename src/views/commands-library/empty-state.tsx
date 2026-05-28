/**
 * CommandsLibraryEmptyState — empty state for the Commands Library view.
 *
 * Thin wrapper over LibraryEmptyPanel. Supplies command-specific copy, icon,
 * docs URL, and reveal path segments. The reveal-error state machine and
 * inline alert live in the shared primitive (Story 6.13).
 *
 * Story: 6.6 — Commands Library (FR-011)
 */

import * as React from "react";
import { LibraryEmptyPanel } from "@/components/library-shell/LibraryStatePanel";

/** Canonical Anthropic documentation URL for Claude Code commands. */
const COMMANDS_DOCS_URL = "https://docs.claude.com/en/docs/claude-code/slash-commands";

/** Path to the global commands directory (display only — Rust does not expand ~). */
const COMMANDS_DIR_DISPLAY = "~/.claude/commands/";

export function CommandsLibraryEmptyState(): React.JSX.Element {
  return (
    <LibraryEmptyPanel
      icon="folder-open"
      iconColor="[color:var(--color-foreground-subtle)]"
      heading="No commands found"
      body={
        <>
          Drop a Claude Code command file into{" "}
          <code className="[font-family:var(--font-mono)] text-xs [color:var(--color-foreground-muted)]">
            {COMMANDS_DIR_DISPLAY}
          </code>{" "}
          to see it here.
        </>
      }
      ariaLabel="No commands found"
      primaryActionLabel={`Open ${COMMANDS_DIR_DISPLAY} in Finder`}
      revealDirSegments={[".claude", "commands"]}
      revealErrorMessage="Couldn't open ~/.claude/commands/ — directory may not exist yet."
      learnMoreUrl={COMMANDS_DOCS_URL}
      learnMoreLabel="Learn how to author a command →"
    />
  );
}
