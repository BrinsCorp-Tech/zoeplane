/**
 * CommandCard — 240×140 card component for the Commands Library grid.
 *
 * Composition:
 *   Header row 1: Command name (or filename stem in fallback) + scope badge (Global / Project)
 *   Body   row 2: Description (2-line clamp) OR "No description provided" italic fallback
 *   Body   row 3: Scope path hint (monospace, truncated)
 *   Footer row 4: Parse-warning indicator (conditional) + last-modified
 *
 * States: idle / hover / focus / warning / parse-error (degraded)
 * (empty + loading states owned by LibraryShell at the view layer)
 *
 * Parse-warning state (AC #5):
 *   When frontMatter is null/empty (unparseable YAML), the card renders with the
 *   filename as the title and a "Cannot parse front-matter" warning indicator.
 *   Unlike SkillCard's degraded layout, CommandCard uses a single unified layout
 *   for both healthy and parse-error states — the warning indicator in the footer
 *   communicates the issue without restructuring the card body.
 *
 * Scope badge (AC #1):
 *   "Global" badge for scope="global" assets, "Project" badge for scope="project".
 *   Styled via semantic tokens — no hex literals.
 *
 * Windows POSIX path normalization (Constraint 9):
 *   Display name derivation uses toPosix() at entry so nested commands
 *   (e.g. `consider/first-principles`) render correctly on all platforms.
 *
 * Accessibility: WCAG 2.2 AA — role="button", aria-label with full summary.
 *
 * All colors reference semantic tokens from src/styles/tokens.css — no hex literals.
 *
 * @see docs/stories/epic-06/story-6.6-commands-library.md
 * Story: 6.6
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/Card/Card";
import { Badge } from "@/components/ui/Badge/Badge";
import { Icon } from "@/components/ui/Icon/Icon";
import type { AssetSummary } from "@zoeplane/shared-types";
import { formatRelativeTime } from "@/lib/format-relative-time";

// ---------------------------------------------------------------------------
// Path helper — POSIX normalization at entry (Constraint 9)
// ---------------------------------------------------------------------------

/** Normalize a path to POSIX separators at the entry of any path operation. */
function toPosix(p: string): string {
  return p.replaceAll("\\", "/");
}

/**
 * Derive the display name for a command from its sourcePath.
 *
 * Commands live at a flat or one-level-deep layout:
 *   ~/.claude/commands/my-command.md          → "my-command"
 *   ~/.claude/commands/consider/inversion.md  → "consider/inversion"
 *
 * Normalized at entry via toPosix so Windows paths work correctly.
 */
export function deriveCommandDisplayName(sourcePath: string): string {
  const posix = toPosix(sourcePath);
  // Split, drop empty segments
  const segments = posix.split("/").filter(Boolean);
  if (segments.length === 0) return posix;

  const filename = segments[segments.length - 1] ?? sourcePath;
  const stem = filename.replace(/\.md$/i, "");

  // If one level deep inside a named subfolder (e.g. commands/consider/inversion),
  // include the parent folder for disambiguation.
  if (segments.length >= 2) {
    const parent = segments[segments.length - 2] ?? "";
    // Only include parent if it is not a standard root dir name.
    // A "standard root" is any known Claude dir: commands, .claude, agents, skills, etc.
    const ROOT_DIRS = new Set(["commands", ".claude", "agents", "skills", "hooks"]);
    if (!ROOT_DIRS.has(parent)) {
      return `${parent}/${stem}`;
    }
  }

  return stem;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CommandCardProps {
  /** The asset summary from GET /assets (ADR-009 §2). */
  asset: AssetSummary;
  /** Called when the card is activated (click or Enter/Space). */
  onActivate?: (asset: AssetSummary) => void;
  /** Optional className for the card root. */
  className?: string;
}

// ---------------------------------------------------------------------------
// CommandCard
// ---------------------------------------------------------------------------

/**
 * CommandCard — card rendering a single command from the asset index.
 *
 * Fixed dimensions: 240×140 CSS px (matches `.library-shell-grid` invariant).
 * All token references via CSS custom properties — no hex literals.
 */
export function CommandCard({ asset, onActivate, className }: CommandCardProps): React.JSX.Element {
  const { frontMatter, validationStatus, lastModifiedAt, sourcePath, scope } = asset;

  // ── Derived values ──────────────────────────────────────────────────────────

  // Display name: frontMatter.name → derived from sourcePath
  const displayName =
    typeof frontMatter?.name === "string" && frontMatter.name.trim().length > 0
      ? frontMatter.name.trim()
      : deriveCommandDisplayName(sourcePath);

  // Description
  const description =
    typeof frontMatter?.description === "string" && frontMatter.description.trim().length > 0
      ? frontMatter.description.trim()
      : null;

  // AC #5: parse-error state — frontMatter is null when YAML is unparseable
  const hasParseError = frontMatter === null || validationStatus === "invalid";

  // Warning condition: parse error OR non-valid status OR missing description
  const hasWarning = hasParseError || validationStatus !== "valid" || description === null;

  const badgeId = React.useId();

  // Screen reader aria-label
  const scopeLabel = scope === "project" ? "Project" : "Global";
  const ariaLabel = hasParseError
    ? `Command: ${displayName}. Cannot parse front-matter. ${scopeLabel}.`
    : `Command: ${displayName}. ${scopeLabel}.`;

  // ── Keyboard + click handler ─────────────────────────────────────────────────

  const handleActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onActivate?.(asset);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Card
      interactive
      role="button"
      aria-label={ariaLabel}
      aria-describedby={badgeId}
      onClick={handleActivate}
      onKeyDown={handleActivate}
      className={cn("flex min-h-[140px] w-[240px] flex-col", className)}
    >
      {/* ── Header: display name + scope badge ─────────────────────────────── */}
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 p-4 pb-2">
        <span
          className="min-w-0 truncate text-base leading-tight font-semibold [color:var(--color-foreground)]"
          title={displayName}
        >
          {displayName}
        </span>

        {/* Scope badge — "Global" or "Project" (AC #1) */}
        <Badge
          id={badgeId}
          variant="outline"
          className="shrink-0 text-xs"
          aria-label={`Scope: ${scopeLabel}`}
        >
          {scopeLabel}
        </Badge>
      </CardHeader>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <CardContent className="flex flex-1 flex-col gap-1 px-4 pt-0 pb-2">
        {/* Row 2: Description (2-line clamp) */}
        {description !== null ? (
          <p className="line-clamp-2 text-xs leading-relaxed [color:var(--color-foreground-muted)]">
            {description}
          </p>
        ) : (
          <p className="text-xs leading-relaxed [color:var(--color-foreground-subtle)] italic">
            No description provided
          </p>
        )}

        {/* Row 3: Source path hint (monospace) */}
        <span
          className="w-full truncate [font-family:var(--font-mono)] text-xs [color:var(--color-foreground-subtle)]"
          title={sourcePath}
        >
          {toPosix(sourcePath)}
        </span>
      </CardContent>

      {/* ── Footer: warning indicator (conditional) + last-modified ────────── */}
      <CardFooter className="flex items-center justify-between gap-2 px-4 pt-0 pb-3">
        {hasWarning && (
          <div
            className="flex items-center gap-1 rounded [background-color:var(--color-warning-muted)] px-1.5 py-0.5 text-xs [color:var(--color-warning-foreground)]"
            aria-live="polite"
          >
            <Icon name="alert-triangle" size="xs" aria-hidden />
            <span>{hasParseError ? "Cannot parse front-matter" : "Front-matter incomplete"}</span>
          </div>
        )}

        <span className="ml-auto text-xs whitespace-nowrap [color:var(--color-foreground-subtle)]">
          {formatRelativeTime(lastModifiedAt)}
        </span>
      </CardFooter>
    </Card>
  );
}

CommandCard.displayName = "CommandCard";
