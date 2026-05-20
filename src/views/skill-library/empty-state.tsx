/**
 * SkillLibraryEmptyState — empty state for the Skill Library view.
 *
 * Renders when: ~/.claude/skills/ does not exist OR contains zero .md files.
 * Per UX Design Handoff §Empty state spec:
 *   - folder-open icon
 *   - "No skills found" heading
 *   - Body copy with the skills directory path in monospace
 *   - "Open ~/.claude/skills/ in Finder" action (Tauri reveal_in_finder)
 *     → resolves ~ via homeDir() + join() (Finding 5 from Story 6.2)
 *     → surfaces inline error when reveal_in_finder fails (Finding 1 from code review)
 *   - "Learn how to author a skill →" link (Anthropic docs, new tab)
 *
 * Story: 6.3 — Skill Library
 */

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { homeDir, join } from "@tauri-apps/api/path";
import { Icon } from "@/components/ui/Icon/Icon";
import { Button } from "@/components/ui/Button/Button";

/** Canonical Anthropic documentation URL for Claude Code skills. */
const SKILLS_DOCS_URL = "https://docs.claude.com/en/docs/claude-code/skills";

/** Path to the global skills directory (display only — Rust does not expand ~). */
const SKILLS_DIR_DISPLAY = "~/.claude/skills/";

export function SkillLibraryEmptyState(): React.JSX.Element {
  const [revealError, setRevealError] = React.useState<string | null>(null);

  // Finding 5 (Story 6.2): resolve ~ before invoking reveal_in_finder — Rust does NOT expand
  // tilde. Use homeDir() + join() from @tauri-apps/api/path.
  // Finding 1 (code review): create_dir_all command does not exist in the Tauri command
  // registry — invoking it fails silently. Remove the pre-create step and surface any
  // reveal_in_finder failure to the user instead of swallowing it.
  const handleOpenFinder = () => {
    setRevealError(null);
    void (async () => {
      try {
        const home = await homeDir();
        const skillsPath = await join(home, ".claude", "skills");
        await invoke("reveal_in_finder", { path: skillsPath });
      } catch (err: unknown) {
        if (import.meta.env.DEV) {
          console.error("[SkillLibraryEmptyState] reveal_in_finder failed:", err);
        }
        setRevealError("Couldn't open ~/.claude/skills/ — directory may not exist yet.");
      }
    })();
  };

  return (
    <div
      className="mx-auto flex max-w-[40ch] flex-col items-center justify-center gap-4 py-12 text-center"
      aria-label="No skills found"
    >
      {/* Icon */}
      <Icon
        name="folder-open"
        size="lg"
        className="[color:var(--color-foreground-subtle)]"
        aria-hidden
      />

      {/* Heading */}
      <h2 className="text-lg font-semibold [color:var(--color-foreground)]">No skills found</h2>

      {/* Body copy */}
      <p className="text-sm leading-relaxed [color:var(--color-foreground-muted)]">
        Drop a Claude Code skill definition file into{" "}
        <code className="[font-family:var(--font-mono)] text-xs [color:var(--color-foreground-muted)]">
          {SKILLS_DIR_DISPLAY}
        </code>{" "}
        to see it here.
      </p>

      {/* Actions */}
      <div className="flex w-full flex-col gap-2">
        <Button variant="secondary" size="sm" onClick={handleOpenFinder} className="w-full">
          Open {SKILLS_DIR_DISPLAY} in Finder
        </Button>

        {/* Inline error — appears when reveal_in_finder rejects */}
        {revealError !== null && (
          <p role="alert" aria-live="polite" className="text-xs [color:var(--color-danger)]">
            {revealError}
          </p>
        )}

        <a
          href={SKILLS_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 w-full items-center justify-center rounded-md px-3 text-xs font-medium [color:var(--color-foreground)] hover:[background-color:var(--color-hover-overlay)]"
        >
          Learn how to author a skill →
        </a>
      </div>
    </div>
  );
}
