/**
 * EvaluatorStatusBadge — cross-library evaluator/validity state badge.
 *
 * @see docs/design/components/EvaluatorStatusBadge-spec.md
 *
 * FROZEN UNTIL v1.0.0 — type signature changes require an ADR per Story 2.7 AC #8.
 *
 * Composes the Badge primitive (pill shape, padding, radius) with a mandatory
 * leading Icon and human-readable state label. The discriminated-union `mode`
 * prop narrows the `state` union at the call site — compile errors surface
 * vocabulary mismatches before runtime.
 *
 * Motion policy: EvaluatorStatusBadge authors NO motion. Card-level crossfade
 * (A-36) is owned by the parent via `key={state}`. Hook quarantine icon-pulse
 * (A-12) is applied externally by HookCard chrome — not via a badge prop.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon/Icon";
import type { IconName } from "@zoeplane/shared-types";

// ─── Locked type signature (Story 2.7 AC #8 — frozen until v1.0.0) ──────────

export type SkillEvaluatorState =
  | "approved"
  | "pending review"
  | "external — pending review"
  | "declined"
  | "needs re-evaluation";

export type AgentEvaluatorState =
  | "approved"
  | "pending review"
  | "external — pending review"
  | "declined"
  | "needs re-evaluation";

export type HookEvaluatorState =
  | "approved"
  | "pending review"
  | "external — pending review"
  | "quarantined"
  | "declined"
  | "needs re-evaluation"
  | "disabled by you";

export type ValidityState = "valid" | "warnings" | "invalid" | "pending";

export type EvaluatorStatusBadgeProps =
  | {
      mode: "evaluator-status";
      resourceType: "skill";
      state: SkillEvaluatorState;
      id?: string;
      className?: string;
    }
  | {
      mode: "evaluator-status";
      resourceType: "agent";
      state: AgentEvaluatorState;
      id?: string;
      className?: string;
    }
  | {
      mode: "evaluator-status";
      resourceType: "hook";
      state: HookEvaluatorState;
      id?: string;
      className?: string;
    }
  | {
      mode: "validity-only";
      resourceType: "command" | "team" | "workflow";
      state: ValidityState;
      id?: string;
      className?: string;
    };

// ─── assertNever guard ────────────────────────────────────────────────────────

/**
 * Compile-time exhaustiveness marker. Assigning an unhandled union member to
 * `_: never` produces a TypeScript error — all union members must be covered.
 * This is a TYPE-LEVEL check only; the symbol is never reached at runtime when
 * TypeScript is satisfied. Call sites must handle the runtime fallback themselves
 * (see `getEvaluatorVisual` / `getValidityVisual` default branches).
 */
function _exhaustiveCheck(_: never): void {
  // Intentionally empty — exists only to trigger TS error on missing cases.
}

// ─── State → visual mapping ───────────────────────────────────────────────────

/**
 * Maps an evaluator/validity state to its icon, label, and Tailwind token classes.
 *
 * Token classes use semantic CSS custom properties only (no raw hex, no Tailwind
 * theme-variant prefixes) — per ADR-004 invariant 1 and dark-mode-architecture.md
 * §"Architecture overview". The theme switch happens at the CSS custom property layer.
 *
 * Icon name mapping notes (operator-adjudicated, 2026-05-13):
 *   - Spec "refresh"     → "refresh-cw"   (canonical Lucide name already in allowlist)
 *   - Spec "play-triangle" → "play"        (canonical Lucide name already in allowlist)
 *   - "clock"            → new addition to allowlist (clock, Clock)
 *   - "x-octagon"        → new addition (XOctagon, semantic-stronger than x-circle)
 *   - "power"            → new addition (Power, user-toggled disabled state)
 *
 * Token fallback note (operator-adjudicated, 2026-05-13):
 *   Hook "disabled by you" state — Maya's spec calls for `--color-foreground-subtle-muted`
 *   (bg) / `--color-foreground-subtle` (fg) but `--color-foreground-subtle-muted` is not
 *   yet defined in tokens.css. Operator approved fallback: `--color-surface-muted` (bg) /
 *   `--color-foreground-muted` (fg). The proper token will be added as a Sprint 2
 *   carryover if Maya wants exact-match neutral palette later.
 */
interface StateVisual {
  icon: IconName;
  label: string;
  /**
   * Tailwind utility string applying semantic-token bg + fg.
   * No theme-variant prefix — the token layer handles theming.
   */
  classes: string;
}

/**
 * Maps an evaluator state to its icon, label, and token classes.
 *
 * `pending review` is handled BEFORE the switch because the correct icon differs
 * by resourceType (spec §3.1 / §3.2 vs §3.3):
 *   - Skill / Agent: "clock" — pure waiting state, no "currently active" semantics.
 *   - Hook: "play" — signals the hook IS firing (FR-097 Soft Notification semantics).
 * Collapsing this into a single switch case would silently apply Hook's "play" icon
 * to Skill/Agent badges, implying they are "running" — which is wrong.
 *
 * Runtime fallback per spec §9: if an unrecognised state reaches the default branch
 * (e.g., via an `as`-cast bypass), log a dev-mode error and return the pending-review
 * palette so the badge stays legible rather than propagating a throw to React's error
 * boundary. The `_exhaustiveCheck` assignment ensures TypeScript still flags missing
 * union members at compile time.
 */
function getEvaluatorVisual(
  resourceType: "skill" | "agent" | "hook",
  state: SkillEvaluatorState | AgentEvaluatorState | HookEvaluatorState,
): StateVisual {
  // Override "pending review" icon per resourceType — must precede the switch.
  // Hook = "play" (signals hook IS firing — FR-097 Soft Notification semantics, spec §3.3)
  // Skill / Agent = "clock" (pure waiting state — no "currently active" semantics, spec §3.1 / §3.2)
  if (state === "pending review") {
    return {
      icon: resourceType === "hook" ? "play" : "clock",
      label: "Pending review",
      classes: "[background-color:var(--color-info-muted)] [color:var(--color-info)]",
    };
  }

  switch (state) {
    case "approved":
      return {
        icon: "check",
        label: "Approved",
        classes: "[background-color:var(--color-success-muted)] [color:var(--color-success)]",
      };
    case "external — pending review":
      return {
        // Spec icon name "refresh" → canonical Lucide name "refresh-cw" (already in allowlist)
        icon: "refresh-cw",
        label: "External — pending review",
        classes: "[background-color:var(--color-info-muted)] [color:var(--color-info)]",
      };
    case "quarantined":
      return {
        icon: "shield",
        label: "Quarantined",
        classes: "[background-color:var(--color-quarantine-muted)] [color:var(--color-quarantine)]",
      };
    case "declined":
      return {
        icon: "x-octagon",
        label: "Declined",
        classes: "[background-color:var(--color-danger-muted)] [color:var(--color-danger)]",
      };
    case "needs re-evaluation":
      return {
        icon: "alert-triangle",
        label: "Needs re-evaluation",
        classes:
          "[background-color:var(--color-warning-muted)] [color:var(--color-warning-foreground)]",
      };
    case "disabled by you":
      return {
        // Token fallback: --color-surface-muted (bg) / --color-foreground-muted (fg)
        // Spec calls for --color-foreground-subtle-muted / --color-foreground-subtle,
        // but --color-foreground-subtle-muted is not yet in tokens.css.
        // See JSDoc above for operator decision and carryover reference.
        icon: "power",
        label: "Disabled by you",
        classes:
          "[background-color:var(--color-surface-muted)] [color:var(--color-foreground-muted)]",
      };
    default: {
      // TypeScript exhaustive check — dead code path at compile time.
      // The _exhaustiveCheck assignment fails to compile if any state is
      // added to the union without a corresponding case above.
      _exhaustiveCheck(state);
      if (process.env.NODE_ENV !== "production") {
        console.error(
          `[EvaluatorStatusBadge] Unrecognised evaluator state "${String(state)}" — falling back to pending-review palette per spec §9.`,
        );
      }
      // Soft fallback: keep the badge legible rather than propagating a throw
      // to React's error boundary (spec §9: "log a dev-mode error and fall back
      // to rendering the pending/pending-review palette so the badge remains legible").
      return {
        icon: "clock",
        label: "Pending review",
        classes: "[background-color:var(--color-info-muted)] [color:var(--color-info)]",
      };
    }
  }
}

/**
 * Maps a validity state to its icon, label, and token classes.
 *
 * Runtime fallback per spec §9: unrecognised states log a dev-mode error and
 * return the `pending` palette so the badge remains legible. See `getEvaluatorVisual`
 * JSDoc for the full fallback rationale.
 */
function getValidityVisual(state: ValidityState): StateVisual {
  switch (state) {
    case "valid":
      return {
        icon: "check",
        label: "Valid",
        classes: "[background-color:var(--color-success-muted)] [color:var(--color-success)]",
      };
    case "warnings":
      return {
        icon: "alert-triangle",
        label: "Warnings",
        classes:
          "[background-color:var(--color-warning-muted)] [color:var(--color-warning-foreground)]",
      };
    case "invalid":
      return {
        icon: "x-octagon",
        label: "Invalid",
        classes: "[background-color:var(--color-danger-muted)] [color:var(--color-danger)]",
      };
    case "pending":
      return {
        icon: "clock",
        label: "Pending",
        classes: "[background-color:var(--color-info-muted)] [color:var(--color-info)]",
      };
    default: {
      // TypeScript exhaustive check — dead code path at compile time.
      _exhaustiveCheck(state);
      if (process.env.NODE_ENV !== "production") {
        console.error(
          `[EvaluatorStatusBadge] Unrecognised validity state "${String(state)}" — falling back to pending palette per spec §9.`,
        );
      }
      // Soft fallback: keep the badge legible rather than throwing to React's error boundary.
      return {
        icon: "clock",
        label: "Pending",
        classes: "[background-color:var(--color-info-muted)] [color:var(--color-info)]",
      };
    }
  }
}

/** Maps resourceType to the human-readable label used in aria-label prefix. */
const RESOURCE_LABEL: Record<"skill" | "agent" | "hook" | "command" | "team" | "workflow", string> =
  {
    skill: "Skill",
    agent: "Agent",
    hook: "Hook",
    command: "Command",
    team: "Team",
    workflow: "Workflow",
  };

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * EvaluatorStatusBadge — unified cross-library status badge.
 *
 * Usage:
 * ```tsx
 * // evaluator-status mode (Skill / Agent / Hook)
 * <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="quarantined" />
 *
 * // validity-only mode (Command / Team / Workflow)
 * <EvaluatorStatusBadge mode="validity-only" resourceType="command" state="invalid" />
 * ```
 *
 * ARIA contract:
 *   - `role="status"` — implicit aria-live="polite"; screen readers announce state changes.
 *   - `aria-label` — "<ResourceType>: <State label>", e.g. "Hook: Quarantined".
 *   - Icon is aria-hidden (decorative); label text carries the meaning.
 *
 * Consumer integration: pass `id` so the parent card can bind `aria-describedby`:
 * ```tsx
 * <article aria-describedby="hook-card-123-state">
 *   <EvaluatorStatusBadge id="hook-card-123-state" mode="evaluator-status" resourceType="hook" state="approved" />
 * </article>
 * ```
 *
 * @see docs/design/components/EvaluatorStatusBadge-spec.md
 */
export function EvaluatorStatusBadge(props: EvaluatorStatusBadgeProps): React.JSX.Element {
  const { mode, resourceType, state, id, className } = props;

  const visual: StateVisual =
    mode === "evaluator-status"
      ? getEvaluatorVisual(
          resourceType as "skill" | "agent" | "hook",
          state as SkillEvaluatorState | AgentEvaluatorState | HookEvaluatorState,
        )
      : getValidityVisual(state as ValidityState);

  const resourceLabel = RESOURCE_LABEL[resourceType];
  const ariaLabel = `${resourceLabel}: ${visual.label}`;

  return (
    <span
      id={id}
      role="status"
      aria-label={ariaLabel}
      className={cn(
        // Badge chrome — pill shape, sizing, typography (matches Badge primitive)
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        // Semantic-token color (no raw hex, no theme-variant prefix — token layer handles theming)
        visual.classes,
        className,
      )}
    >
      <Icon name={visual.icon} size="xs" aria-hidden={true} />
      {visual.label}
    </span>
  );
}

EvaluatorStatusBadge.displayName = "EvaluatorStatusBadge";

export default EvaluatorStatusBadge;
