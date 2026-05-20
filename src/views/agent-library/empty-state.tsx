/**
 * AgentLibraryEmptyState — empty state for the Agent Library view.
 *
 * Renders when: ~/.claude/agents/ does not exist OR contains zero .md files.
 * Per UX Design Handoff AC #5 spec:
 *   - folder-open icon
 *   - "No agents found" heading
 *   - Body copy with the agents directory path in monospace
 *   - "Open ~/.claude/agents/ in Finder" action (Tauri reveal_in_finder)
 *   - "Learn how to author an agent →" link (Anthropic docs)
 *
 * Story: 6.2 — Agent Library
 */

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { homeDir, join } from "@tauri-apps/api/path";
import { Icon } from "@/components/ui/Icon/Icon";
import { Button } from "@/components/ui/Button/Button";

/** Canonical Anthropic documentation URL for Claude Code sub-agents. */
const AGENTS_DOCS_URL = "https://docs.claude.com/en/docs/claude-code/sub-agents";

/** Path to the global agents directory. */
const AGENTS_DIR = "~/.claude/agents/";

export function AgentLibraryEmptyState(): React.JSX.Element {
  // Finding 5: resolve ~ before invoking reveal_in_finder — Rust does NOT expand
  // tilde, so passing "~/.claude/agents/" fails the FS scope check silently.
  // Use homeDir() + join() from @tauri-apps/api/path (option a).
  const handleOpenFinder = () => {
    void (async () => {
      try {
        const home = await homeDir();
        const agentsPath = await join(home, ".claude", "agents");
        await invoke("reveal_in_finder", { path: agentsPath });
      } catch (err: unknown) {
        console.error("[AgentLibraryEmptyState] reveal_in_finder failed:", err);
      }
    })();
  };

  return (
    <div
      className="mx-auto flex max-w-[40ch] flex-col items-center justify-center gap-4 py-12 text-center"
      aria-label="No agents found"
    >
      {/* Icon */}
      <Icon
        name="folder-open"
        size="lg"
        className="[color:var(--color-foreground-subtle)]"
        aria-hidden
      />

      {/* Heading */}
      <h2 className="text-lg font-semibold [color:var(--color-foreground)]">No agents found</h2>

      {/* Body copy */}
      <p className="text-sm leading-relaxed [color:var(--color-foreground-muted)]">
        Drop a Claude Code agent definition file into{" "}
        <code className="[font-family:var(--font-mono)] text-xs [color:var(--color-foreground-muted)]">
          {AGENTS_DIR}
        </code>{" "}
        to see it here.
      </p>

      {/* Actions */}
      <div className="flex w-full flex-col gap-2">
        <Button variant="secondary" size="sm" onClick={handleOpenFinder} className="w-full">
          Open {AGENTS_DIR} in Finder
        </Button>

        <a
          href={AGENTS_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 w-full items-center justify-center rounded-md px-3 text-xs font-medium [color:var(--color-foreground)] hover:[background-color:var(--color-hover-overlay)]"
        >
          Learn how to author an agent →
        </a>
      </div>
    </div>
  );
}
