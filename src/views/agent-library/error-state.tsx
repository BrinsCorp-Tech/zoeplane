/**
 * AgentLibraryErrorState — error state for the Agent Library view.
 *
 * Renders when the sidecar HTTP call fails (5xx, network error).
 * Per UX Design Handoff §AC #5 adjacent spec:
 *   - alert-circle icon (danger palette)
 *   - "Couldn't load agents" heading
 *   - Body copy explaining the connection issue
 *   - "Retry" action (calls TanStack Query refetch)
 *   - "Reveal in Finder" secondary action
 *
 * Story: 6.2 — Agent Library
 */

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { homeDir, join } from "@tauri-apps/api/path";
import { Icon } from "@/components/ui/Icon/Icon";
import { Button } from "@/components/ui/Button/Button";

interface AgentLibraryErrorStateProps {
  /** TanStack Query refetch function — called on Retry click. */
  onRetry: () => void;
}

export function AgentLibraryErrorState({
  onRetry,
}: AgentLibraryErrorStateProps): React.JSX.Element {
  // Finding 5: resolve ~ before invoking reveal_in_finder — Rust does NOT expand
  // tilde, so passing "~/.claude/agents/" fails the FS scope check silently.
  // Use homeDir() + join() from @tauri-apps/api/path (option a).
  const handleReveal = () => {
    void (async () => {
      try {
        const home = await homeDir();
        const agentsPath = await join(home, ".claude", "agents");
        await invoke("reveal_in_finder", { path: agentsPath });
      } catch (err: unknown) {
        console.error("[AgentLibraryErrorState] reveal_in_finder failed:", err);
      }
    })();
  };

  return (
    <div
      className="mx-auto flex max-w-[40ch] flex-col items-center justify-center gap-4 py-12 text-center"
      aria-label="Error loading agents"
    >
      {/* Icon */}
      <Icon name="alert-circle" size="lg" className="[color:var(--color-danger)]" aria-hidden />

      {/* Heading */}
      <h2 className="text-lg font-semibold [color:var(--color-foreground)]">
        Couldn&apos;t load agents
      </h2>

      {/* Body copy */}
      <p className="text-sm leading-relaxed [color:var(--color-foreground-muted)]">
        The sidecar didn&apos;t return a response. This is usually a connection issue, not a problem
        with your agent files.
      </p>

      {/* Actions */}
      <div className="flex w-full flex-col gap-2">
        <Button variant="default" size="sm" onClick={onRetry} className="w-full">
          Retry
        </Button>

        <Button variant="ghost" size="sm" onClick={handleReveal} className="w-full">
          Reveal in Finder
        </Button>
      </div>
    </div>
  );
}
