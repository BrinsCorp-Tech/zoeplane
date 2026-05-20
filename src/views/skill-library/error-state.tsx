/**
 * SkillLibraryErrorState — error state for the Skill Library view.
 *
 * Renders when the sidecar HTTP call fails (5xx, network error).
 * Per UX Design Handoff §Error state spec:
 *   - alert-circle icon (danger palette)
 *   - "Couldn't load skills" heading
 *   - Body copy explaining the connection issue
 *   - "Retry" action (calls TanStack Query refetch)
 *   - "Reveal in Finder" secondary action
 *     → surfaces inline error when reveal_in_finder fails (Finding 1 from code review)
 *
 * Story: 6.3 — Skill Library
 */

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { homeDir, join } from "@tauri-apps/api/path";
import { Icon } from "@/components/ui/Icon/Icon";
import { Button } from "@/components/ui/Button/Button";

interface SkillLibraryErrorStateProps {
  /** TanStack Query refetch function — called on Retry click. */
  onRetry: () => void;
}

export function SkillLibraryErrorState({
  onRetry,
}: SkillLibraryErrorStateProps): React.JSX.Element {
  const [revealError, setRevealError] = React.useState<string | null>(null);

  // Finding 5: resolve ~ before invoking reveal_in_finder — Rust does NOT expand tilde.
  // Finding 1 (code review): surface reveal_in_finder failures to the user instead of
  // swallowing them silently.
  const handleReveal = () => {
    setRevealError(null);
    void (async () => {
      try {
        const home = await homeDir();
        const skillsPath = await join(home, ".claude", "skills");
        await invoke("reveal_in_finder", { path: skillsPath });
      } catch (err: unknown) {
        if (import.meta.env.DEV) {
          console.error("[SkillLibraryErrorState] reveal_in_finder failed:", err);
        }
        setRevealError("Couldn't open ~/.claude/skills/ — directory may not exist yet.");
      }
    })();
  };

  return (
    <div
      className="mx-auto flex max-w-[40ch] flex-col items-center justify-center gap-4 py-12 text-center"
      aria-label="Error loading skills"
    >
      {/* Icon */}
      <Icon name="alert-circle" size="lg" className="[color:var(--color-danger)]" aria-hidden />

      {/* Heading */}
      <h2 className="text-lg font-semibold [color:var(--color-foreground)]">
        Couldn&apos;t load skills
      </h2>

      {/* Body copy */}
      <p className="text-sm leading-relaxed [color:var(--color-foreground-muted)]">
        The sidecar didn&apos;t return a response. This is usually a connection issue, not a problem
        with your skill files.
      </p>

      {/* Actions */}
      <div className="flex w-full flex-col gap-2">
        <Button variant="default" size="sm" onClick={onRetry} className="w-full">
          Retry
        </Button>

        <Button variant="ghost" size="sm" onClick={handleReveal} className="w-full">
          Reveal in Finder
        </Button>

        {/* Inline error — appears when reveal_in_finder rejects */}
        {revealError !== null && (
          <p role="alert" aria-live="polite" className="text-xs [color:var(--color-danger)]">
            {revealError}
          </p>
        )}
      </div>
    </div>
  );
}
