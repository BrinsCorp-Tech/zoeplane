/**
 * AgentCard — 240×140 card component for the Agent Library grid.
 *
 * Composition per UX Design Handoff (Phase 0, 2026-05-19):
 *   Header row 1: Agent name + EvaluatorStatusBadge
 *   Body   row 2: Voice ID + voice name line
 *   Body   row 3: Archetype line (derived via deriveArchetype())
 *   Body   row 4: Trait chips (max 3 + "+N more")
 *   Footer row 5: Warning indicator (conditional) + last-modified
 *
 * States: idle / hover / focus / warning / invalid
 * (empty + loading states owned by LibraryShell at the view layer)
 *
 * Accessibility: WCAG 2.2 AA — role="button", aria-label with full summary,
 * aria-describedby pointing to EvaluatorStatusBadge, 44×44 touch target on `?` button.
 *
 * All colors reference semantic tokens from src/styles/tokens.css — no hex literals.
 *
 * @see docs/stories/epic-06/story-6.2-agent-library.md §UX Design Handoff
 * Story: 6.2
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/Card/Card";
import { EvaluatorStatusBadge } from "@/components/ui/EvaluatorStatusBadge/EvaluatorStatusBadge";
import type { AgentEvaluatorState } from "@/components/ui/EvaluatorStatusBadge/EvaluatorStatusBadge";
import { Icon } from "@/components/ui/Icon/Icon";
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip/Tooltip";
import type { AssetSummary } from "@zoeplane/shared-types";
import { deriveArchetype } from "./derive-archetype";
import { isValidVoiceId } from "./is-valid-voice-id";
import { formatRelativeTime } from "@/lib/format-relative-time";

// ---------------------------------------------------------------------------
// EvaluatorStatusBadge state mapping (UX Design Handoff §EvaluatorStatusBadge)
// ---------------------------------------------------------------------------

function toEvaluatorState(validationStatus: AssetSummary["validationStatus"]): AgentEvaluatorState {
  switch (validationStatus) {
    case "valid":
      return "approved";
    case "warnings":
      return "needs re-evaluation";
    case "invalid":
      return "declined";
  }
}

function toTooltipContent(state: AgentEvaluatorState): string {
  switch (state) {
    case "approved":
      return "Front-matter parses cleanly.";
    case "needs re-evaluation":
      return "Front-matter parsed with warnings. Open Agent Detail for full message.";
    case "declined":
      return "Front-matter could not be parsed. Open Agent Detail to diagnose.";
    default:
      return "Evaluation status unknown.";
  }
}

// ---------------------------------------------------------------------------
// Warning footer copy (UX Design Handoff §State spec)
// ---------------------------------------------------------------------------

function warningFooterCopy(validationStatus: AssetSummary["validationStatus"]): string {
  return validationStatus === "invalid"
    ? "Front-matter could not be parsed"
    : "Front-matter incomplete";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AgentCardProps {
  /** The asset summary from GET /assets (ADR-009 §2). */
  asset: AssetSummary;
  /** Called when the card is activated (click or Enter/Space). */
  onActivate?: (asset: AssetSummary) => void;
  /** Optional className for the card root. */
  className?: string;
}

// ---------------------------------------------------------------------------
// AgentCard
// ---------------------------------------------------------------------------

/**
 * AgentCard — card rendering a single agent from the asset index.
 *
 * Fixed dimensions: 240×140 CSS px (matches `.library-shell-grid` invariant).
 * All token references via CSS custom properties — no hex literals.
 */
export function AgentCard({ asset, onActivate, className }: AgentCardProps): React.JSX.Element {
  const { frontMatter, validationStatus, lastModifiedAt } = asset;

  // ── Derived values ─────────────────────────────────────────────────────────

  const agentName =
    typeof frontMatter?.name === "string" && frontMatter.name.trim().length > 0
      ? frontMatter.name.trim()
      : // Fall back to filename stem (sans .md extension) derived from sourcePath
        (asset.sourcePath.split("/").pop()?.replace(/\.md$/i, "") ?? asset.name);

  const voiceId = typeof frontMatter?.voice_id === "string" ? frontMatter.voice_id : null;
  const voiceName =
    typeof frontMatter?.voice_name === "string" && frontMatter.voice_name.trim().length > 0
      ? frontMatter.voice_name.trim()
      : null;

  const voiceIdValid = voiceId !== null && isValidVoiceId(voiceId);
  const voiceIdPresent = voiceId !== null;

  const archetypeResult = deriveArchetype(frontMatter);

  // Trait chips — flatten all three arrays.
  // Memoised at the `frontMatter` reference level (Finding 4): `frontMatter` is
  // stable across re-renders for unchanged TanStack Query data, so this correctly
  // caches. The previous pattern derived `traits` inline → new object reference
  // every render → useMemo([traits]) never memoised.
  const allTraits: string[] = React.useMemo(() => {
    const traitsObj =
      typeof frontMatter?.traits === "object" &&
      frontMatter.traits !== null &&
      !Array.isArray(frontMatter.traits)
        ? (frontMatter.traits as Record<string, unknown>)
        : null;
    if (traitsObj === null) return [];
    const expertise = Array.isArray(traitsObj.expertise)
      ? (traitsObj.expertise as unknown[]).filter((t): t is string => typeof t === "string")
      : [];
    const personality = Array.isArray(traitsObj.personality)
      ? (traitsObj.personality as unknown[]).filter((t): t is string => typeof t === "string")
      : [];
    const approach = Array.isArray(traitsObj.approach)
      ? (traitsObj.approach as unknown[]).filter((t): t is string => typeof t === "string")
      : [];
    return [...expertise, ...personality, ...approach];
  }, [frontMatter]);

  const visibleTraits = allTraits.slice(0, 3);
  const overflowCount = allTraits.length - visibleTraits.length;
  const noTraits = allTraits.length === 0;

  // Warning condition: any required field missing or invalid
  const hasWarning =
    validationStatus !== "valid" ||
    !voiceIdPresent ||
    (voiceIdPresent && !voiceIdValid) ||
    archetypeResult.source === "missing" ||
    noTraits;

  // EvaluatorStatusBadge
  const evaluatorState = toEvaluatorState(validationStatus);
  const badgeId = React.useId();
  const cardId = React.useId();

  // Screen reader aria-label
  const validationLabel =
    evaluatorState === "approved"
      ? "Front-matter valid"
      : evaluatorState === "needs re-evaluation"
        ? "Front-matter has warnings"
        : "Front-matter invalid";

  const voiceLabel = voiceName ?? voiceId ?? "no voice";

  const ariaLabel = `Agent: ${agentName}. ${validationLabel}. Voice: ${voiceLabel}.`;

  // ── Keyboard + click handler ───────────────────────────────────────────────

  const handleActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onActivate?.(asset);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <Card
        id={cardId}
        interactive
        role="button"
        aria-label={ariaLabel}
        aria-describedby={badgeId}
        onClick={handleActivate}
        onKeyDown={handleActivate}
        className={cn("flex min-h-[140px] w-[240px] flex-col", className)}
      >
        {/* ── Header: name + EvaluatorStatusBadge ────────────────────────── */}
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 p-4 pb-2">
          <span
            className="min-w-0 truncate text-base leading-tight font-semibold [color:var(--color-foreground)]"
            title={agentName}
          >
            {agentName}
          </span>

          {/* EvaluatorStatusBadge wrapped in Tooltip for hover/focus reveal (AC #3) */}
          <TooltipRoot>
            <TooltipTrigger asChild>
              {/* React.Fragment key triggers crossfade via badge unmount/remount (A-36) */}
              <React.Fragment key={validationStatus}>
                <EvaluatorStatusBadge
                  id={badgeId}
                  mode="evaluator-status"
                  resourceType="agent"
                  state={evaluatorState}
                  className="shrink-0"
                />
              </React.Fragment>
            </TooltipTrigger>
            <TooltipContent>{toTooltipContent(evaluatorState)}</TooltipContent>
          </TooltipRoot>
        </CardHeader>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <CardContent className="flex flex-1 flex-col gap-1 px-4 pt-0 pb-2">
          {/* Row 2: Voice ID + voice name */}
          <div className="flex items-center gap-1 text-xs [color:var(--color-foreground-muted)]">
            {voiceIdPresent ? (
              voiceIdValid ? (
                <span className="truncate">
                  {voiceName ? (
                    <>
                      <span>{voiceName}</span>
                      <span className="mx-0.5 opacity-60">·</span>
                    </>
                  ) : null}
                  <span className="[font-family:var(--font-mono)] text-xs">{voiceId}</span>
                </span>
              ) : (
                /* Invalid voice ID: strike-through + ? icon (AC #4) */
                <span className="flex items-center gap-1">
                  <span className="truncate [font-family:var(--font-mono)] text-xs line-through">
                    {voiceId}
                  </span>
                  {/* 44×44 touch target (WCAG 2.5.8) */}
                  <TooltipRoot>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="focus-visible:ring-ring inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        aria-label="Invalid voice ID format"
                      >
                        <Icon name="info" size="xs" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Voice ID does not match expected format (alphanumeric, 15–32 chars). Raw
                      value: {voiceId}
                    </TooltipContent>
                  </TooltipRoot>
                </span>
              )
            ) : (
              <span className="[color:var(--color-foreground-subtle)]">—</span>
            )}
          </div>

          {/* Row 3: Archetype line */}
          <div className="truncate text-xs [color:var(--color-foreground-muted)]">
            <span className="[color:var(--color-foreground-subtle)]">Archetype:</span>{" "}
            <span>{archetypeResult.value}</span>
          </div>

          {/* Row 4: Trait chips */}
          <div className="mt-0.5 flex flex-wrap gap-1">
            {noTraits ? (
              <span className="text-xs [color:var(--color-foreground-subtle)] italic">
                No traits declared
              </span>
            ) : (
              <>
                {visibleTraits.map((trait) => (
                  <span
                    key={trait}
                    className="inline-flex items-center rounded-full [background-color:var(--color-accent-muted)] px-2 py-0.5 text-xs [color:var(--color-accent)]"
                  >
                    {trait}
                  </span>
                ))}
                {overflowCount > 0 && (
                  <span className="inline-flex items-center rounded-full [background-color:var(--color-accent-muted)] px-2 py-0.5 text-xs [color:var(--color-accent)] opacity-70">
                    +{overflowCount} more
                  </span>
                )}
              </>
            )}
          </div>
        </CardContent>

        {/* ── Footer: warning indicator (conditional) + last-modified ─────── */}
        <CardFooter className="flex items-center justify-between gap-2 px-4 pt-0 pb-3">
          {hasWarning && (
            <div
              className="flex items-center gap-1 rounded [background-color:var(--color-warning-muted)] px-1.5 py-0.5 text-xs [color:var(--color-warning-foreground)]"
              aria-live="polite"
            >
              <Icon name="alert-triangle" size="xs" aria-hidden />
              <span>{warningFooterCopy(validationStatus)}</span>
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

AgentCard.displayName = "AgentCard";
