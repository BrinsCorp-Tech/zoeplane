/**
 * SkillLibraryEmptyState — empty state for the Skill Library view.
 *
 * Thin wrapper over LibraryEmptyPanel. Supplies skill-specific copy, icon,
 * docs URL, and reveal path segments. The reveal-error state machine and
 * inline alert live in the shared primitive (Story 6.13).
 *
 * Story: 6.3 — Skill Library (original), 6.13 — extraction
 */

import * as React from "react";
import { LibraryEmptyPanel } from "@/components/library-shell/LibraryStatePanel";

/** Canonical Anthropic documentation URL for Claude Code skills. */
const SKILLS_DOCS_URL = "https://docs.claude.com/en/docs/claude-code/skills";

/** Path to the global skills directory (display only — Rust does not expand ~). */
const SKILLS_DIR_DISPLAY = "~/.claude/skills/";

export function SkillLibraryEmptyState(): React.JSX.Element {
  return (
    <LibraryEmptyPanel
      icon="folder-open"
      iconColor="[color:var(--color-foreground-subtle)]"
      heading="No skills found"
      body={
        <>
          Drop a Claude Code skill definition file into{" "}
          <code className="[font-family:var(--font-mono)] text-xs [color:var(--color-foreground-muted)]">
            {SKILLS_DIR_DISPLAY}
          </code>{" "}
          to see it here.
        </>
      }
      ariaLabel="No skills found"
      primaryActionLabel={`Open ${SKILLS_DIR_DISPLAY} in Finder`}
      revealDirSegments={[".claude", "skills"]}
      revealErrorMessage="Couldn't open ~/.claude/skills/ — directory may not exist yet."
      learnMoreUrl={SKILLS_DOCS_URL}
      learnMoreLabel="Learn how to author a skill →"
    />
  );
}
