/**
 * SkillCard — 240×140 card component for the Skill Library grid.
 *
 * Composition per UX Design Handoff (Phase 0, 2026-05-19):
 *   Header row 1: Skill name (or filename basename in degraded state) + EvaluatorStatusBadge
 *   Body   row 2: Description (2-line clamp) OR degraded layout
 *   Body   row 3: Provenance chip (derivePluginSource)
 *   Footer row 4: Warning indicator (conditional) + last-modified
 *
 * States: idle / hover / focus / warning / invalid (degraded)
 * (empty + loading states owned by LibraryShell at the view layer)
 *
 * EvaluatorStatusBadge mapping diverges from AgentCard (intentional v1 decision):
 *   valid + evaluatorReportId===null → "pending review" (NOT "approved")
 *   valid + evaluatorReportId set    → "approved" (Epic 05 future path)
 *   warnings → "needs re-evaluation"
 *   invalid  → "declined"
 *
 * See UX Design Handoff §EvaluatorStatusBadge state mapping for full rationale.
 * Skills have a load-bearing safety surface; "pending review" is honest about v1 status.
 *
 * Accessibility: WCAG 2.2 AA — role="button", aria-label with full summary,
 * aria-describedby pointing to EvaluatorStatusBadge.
 *
 * All colors reference semantic tokens from src/styles/tokens.css — no hex literals.
 *
 * @see docs/stories/epic-06/story-6.3-skill-library.md §UX Design Handoff
 * Story: 6.3
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/Card/Card";
import { EvaluatorStatusBadge } from "@/components/ui/EvaluatorStatusBadge/EvaluatorStatusBadge";
import type { SkillEvaluatorState } from "@/components/ui/EvaluatorStatusBadge/EvaluatorStatusBadge";
import { Icon } from "@/components/ui/Icon/Icon";
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip/Tooltip";
import type { AssetSummary } from "@zoeplane/shared-types";
import { derivePluginSource } from "./derive-plugin-source";
import { formatRelativeTime } from "@/components/agent-card/format-relative-time";

// ---------------------------------------------------------------------------
// EvaluatorStatusBadge state mapping (UX Design Handoff §EvaluatorStatusBadge)
//
// INTENTIONAL DIVERGENCE FROM AgentCard:
//   valid + evaluatorReportId===null → "pending review" (not "approved")
//
// Rationale: Skills execute tool calls — the Skill Safety Evaluator (Epic 05)
// is the safety gate. Until it ships, every skill is "untrusted by review."
// Rendering "approved" before any evaluator has run would be a false claim.
// ---------------------------------------------------------------------------

function toSkillEvaluatorState(
  validationStatus: AssetSummary["validationStatus"],
  evaluatorReportId: string | null,
): SkillEvaluatorState {
  switch (validationStatus) {
    case "valid":
      // v1: evaluatorReportId is always null (Epic 05 not shipped)
      return evaluatorReportId !== null ? "approved" : "pending review";
    case "warnings":
      return "needs re-evaluation";
    case "invalid":
      return "declined";
  }
}

function toSkillTooltipContent(state: SkillEvaluatorState): string {
  switch (state) {
    case "pending review":
      return "Front-matter parses cleanly. Awaiting evaluator review (Epic 05).";
    case "approved":
      return "Approved by the skill evaluator.";
    case "needs re-evaluation":
      return "Front-matter parsed with warnings. Open Skill Detail for full message.";
    case "declined":
      return "Front-matter could not be parsed. See the file path below to diagnose.";
    default:
      return "Evaluation status unknown.";
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SkillCardProps {
  /** The asset summary from GET /assets (ADR-009 §2). */
  asset: AssetSummary;
  /** Called when the card is activated (click or Enter/Space). */
  onActivate?: (asset: AssetSummary) => void;
  /** Optional className for the card root. */
  className?: string;
}

// ---------------------------------------------------------------------------
// SkillCard
// ---------------------------------------------------------------------------

/**
 * SkillCard — card rendering a single skill from the asset index.
 *
 * Fixed dimensions: 240×140 CSS px (matches `.library-shell-grid` invariant).
 * All token references via CSS custom properties — no hex literals.
 */
export function SkillCard({ asset, onActivate, className }: SkillCardProps): React.JSX.Element {
  const { frontMatter, validationStatus, lastModifiedAt, sourcePath, provenance } = asset;

  // ── Derived values ─────────────────────────────────────────────────────────

  // Filename basename (used as fallback for name, and as identity in degraded state)
  const fileBasename = sourcePath.split("/").pop() ?? sourcePath;

  // In degraded state (invalid + frontMatter === null), basename preserves .md extension
  // per UX handoff: "SKILL.md makes clear this is the on-disk filename"
  const isDegraded = validationStatus === "invalid";

  // Name: frontMatter.name → filename stem (without .md) → basename
  const skillName =
    typeof frontMatter?.name === "string" && frontMatter.name.trim().length > 0
      ? frontMatter.name.trim()
      : (sourcePath.split("/").pop()?.replace(/\.md$/i, "") ?? asset.name);

  // Description
  const description =
    typeof frontMatter?.description === "string" && frontMatter.description.trim().length > 0
      ? frontMatter.description.trim()
      : null;

  // Missing description is a warning condition (when not degraded)
  const descriptionMissing = !isDegraded && description === null;

  // Provenance chip derivation — memoised at provenance reference level (Finding 4 lesson)
  const pluginSource = React.useMemo(() => derivePluginSource(provenance), [provenance]);

  // Warning condition (non-degraded path only)
  const hasWarning = !isDegraded && (validationStatus !== "valid" || descriptionMissing);

  // EvaluatorStatusBadge
  const evaluatorReportId = provenance?.evaluatorReportId ?? null;
  const evaluatorState = toSkillEvaluatorState(validationStatus, evaluatorReportId);
  const badgeId = React.useId();

  // Screen reader aria-label
  const validationLabel =
    evaluatorState === "pending review"
      ? "Pending review"
      : evaluatorState === "approved"
        ? "Approved"
        : evaluatorState === "needs re-evaluation"
          ? "Front-matter has warnings"
          : "Front-matter invalid";

  const provenanceLabel = pluginSource.label;

  const ariaLabel = isDegraded
    ? `Skill could not be parsed: ${fileBasename}. Open to diagnose.`
    : `Skill: ${skillName}. ${validationLabel}. ${provenanceLabel}.`;

  // ── Keyboard + click handler ───────────────────────────────────────────────

  const handleActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onActivate?.(asset);
  };

  // ── Degraded state layout ──────────────────────────────────────────────────

  if (isDegraded) {
    return (
      <TooltipProvider>
        <Card
          interactive
          role="button"
          aria-label={ariaLabel}
          aria-describedby={badgeId}
          onClick={handleActivate}
          onKeyDown={handleActivate}
          className={cn("flex min-h-[140px] w-[240px] flex-col", className)}
        >
          {/* Header: filename basename (with .md) + Declined badge */}
          <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 p-4 pb-2">
            <span
              className="min-w-0 truncate text-base leading-tight font-semibold [color:var(--color-foreground)]"
              title={fileBasename}
            >
              {fileBasename}
            </span>

            <TooltipRoot>
              <TooltipTrigger asChild>
                <React.Fragment key={validationStatus}>
                  <EvaluatorStatusBadge
                    id={badgeId}
                    mode="evaluator-status"
                    resourceType="skill"
                    state="declined"
                    className="shrink-0"
                  />
                </React.Fragment>
              </TooltipTrigger>
              <TooltipContent>{toSkillTooltipContent("declined")}</TooltipContent>
            </TooltipRoot>
          </CardHeader>

          {/* Body: alert-octagon icon + "Cannot parse front-matter" heading + canonical path */}
          <CardContent className="flex flex-1 flex-col items-start gap-1 px-4 pt-0 pb-2">
            <Icon
              name="alert-octagon"
              size="sm"
              className="[color:var(--color-danger)]"
              aria-hidden
            />
            <span className="text-xs font-semibold [color:var(--color-foreground)]">
              Cannot parse front-matter
            </span>
            <span
              className="w-full truncate [font-family:var(--font-mono)] text-xs [color:var(--color-foreground-muted)]"
              title={sourcePath}
            >
              {sourcePath}
            </span>
          </CardContent>

          {/* Footer: warning caption + last-modified */}
          <CardFooter className="flex items-center justify-between gap-2 px-4 pt-0 pb-3">
            <div
              className="flex items-center gap-1 rounded [background-color:var(--color-warning-muted)] px-1.5 py-0.5 text-xs [color:var(--color-warning-foreground)]"
              aria-live="polite"
            >
              <Icon name="alert-triangle" size="xs" aria-hidden />
              <span>Front-matter could not be parsed</span>
            </div>

            <span className="ml-auto text-xs whitespace-nowrap [color:var(--color-foreground-subtle)]">
              {formatRelativeTime(lastModifiedAt)}
            </span>
          </CardFooter>
        </Card>
      </TooltipProvider>
    );
  }

  // ── Standard layout (idle / hover / focus / warning) ──────────────────────

  return (
    <TooltipProvider>
      <Card
        interactive
        role="button"
        aria-label={ariaLabel}
        aria-describedby={badgeId}
        onClick={handleActivate}
        onKeyDown={handleActivate}
        className={cn("flex min-h-[140px] w-[240px] flex-col", className)}
      >
        {/* ── Header: name + EvaluatorStatusBadge ──────────────────────────── */}
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 p-4 pb-2">
          <span
            className="min-w-0 truncate text-base leading-tight font-semibold [color:var(--color-foreground)]"
            title={skillName}
          >
            {skillName}
          </span>

          {/* EvaluatorStatusBadge wrapped in Tooltip for hover/focus reveal */}
          <TooltipRoot>
            <TooltipTrigger asChild>
              {/* React.Fragment key triggers crossfade via badge unmount/remount (A-36) */}
              <React.Fragment key={validationStatus}>
                <EvaluatorStatusBadge
                  id={badgeId}
                  mode="evaluator-status"
                  resourceType="skill"
                  state={evaluatorState}
                  className="shrink-0"
                />
              </React.Fragment>
            </TooltipTrigger>
            <TooltipContent>{toSkillTooltipContent(evaluatorState)}</TooltipContent>
          </TooltipRoot>
        </CardHeader>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
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

          {/* Row 3: Provenance chip */}
          {pluginSource.variant === "plugin" ? (
            <div className="flex items-center gap-1">
              <span className="inline-flex max-w-full items-center gap-1 rounded-full [background-color:var(--color-accent-muted)] px-2 py-0.5 text-xs [color:var(--color-accent)]">
                <Icon name="link" size="xs" aria-hidden />
                <span className="truncate">{pluginSource.label}</span>
              </span>
            </div>
          ) : (
            <span className="text-xs [color:var(--color-foreground-subtle)]">
              {pluginSource.label}
            </span>
          )}
        </CardContent>

        {/* ── Footer: warning indicator (conditional) + last-modified ───────── */}
        <CardFooter className="flex items-center justify-between gap-2 px-4 pt-0 pb-3">
          {hasWarning && (
            <div
              className="flex items-center gap-1 rounded [background-color:var(--color-warning-muted)] px-1.5 py-0.5 text-xs [color:var(--color-warning-foreground)]"
              aria-live="polite"
            >
              <Icon name="alert-triangle" size="xs" aria-hidden />
              <span>Front-matter incomplete</span>
            </div>
          )}

          <span className="ml-auto text-xs whitespace-nowrap [color:var(--color-foreground-subtle)]">
            {formatRelativeTime(lastModifiedAt)}
          </span>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}

SkillCard.displayName = "SkillCard";
