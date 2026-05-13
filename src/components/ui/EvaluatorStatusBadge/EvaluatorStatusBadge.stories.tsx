/**
 * EvaluatorStatusBadge stories — Chromatic baseline matrix + documentation.
 *
 * Baseline (Chromatic visual regression targets): stories 1–8 produce 16 snapshots.
 * Chromatic's global modes config in .storybook/preview.ts captures both
 * light + dark themes per story automatically — each of the 8 stories yields 2
 * snapshots (light, dark) = 16 total, satisfying Story 2.7 AC #3.
 *
 * Story groups:
 *   1–4  EvaluatorStatus mode — Hook consumer (4 canonical states)
 *   5–8  ValidityOnly mode   — Command consumer (4 states)
 *   9–10 Forced-colors       — non-Chromatic, manual review + a11y test coverage
 *  11–14 Documentation       — non-Chromatic, design-system docs site grid views
 *
 * @see docs/design/components/EvaluatorStatusBadge-spec.md §8.3
 */
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { EvaluatorStatusBadge } from "./EvaluatorStatusBadge";

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof EvaluatorStatusBadge> = {
  title: "Foundation/EvaluatorStatusBadge",
  component: EvaluatorStatusBadge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    // Global preview.ts Chromatic modes (light + dark) apply to all stories.
    // Stories 1–8 are the 16-snapshot regression baseline (8 stories × 2 themes).
    chromatic: { disableSnapshot: false },
  },
};

export default meta;

type Story = StoryObj<typeof EvaluatorStatusBadge>;

// =============================================================================
// SECTION 1 — EvaluatorStatus / Hook (baseline stories 1–4)
//   P0 first consumer: HookCard (Sprint 8.5). 4 representative states here;
//   full 7-state grid rendered in the Documentation section (story 11).
//   Each story is captured in both themes by Chromatic's global modes config.
// =============================================================================

// Story 1 — Hook / Approved
export const EvaluatorStatusHookApproved: Story = {
  name: "EvaluatorStatus / Hook / Approved",
  render: () => (
    <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="approved" />
  ),
};

// Story 2 — Hook / PendingReview
export const EvaluatorStatusHookPendingReview: Story = {
  name: "EvaluatorStatus / Hook / PendingReview",
  render: () => (
    <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="pending review" />
  ),
};

// Story 3 — Hook / Quarantined (Strict Mode — quarantine palette)
export const EvaluatorStatusHookQuarantined: Story = {
  name: "EvaluatorStatus / Hook / Quarantined",
  render: () => (
    <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="quarantined" />
  ),
};

// Story 4 — Hook / NeedsReEvaluation
export const EvaluatorStatusHookNeedsReEvaluation: Story = {
  name: "EvaluatorStatus / Hook / NeedsReEvaluation",
  render: () => (
    <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="needs re-evaluation" />
  ),
};

// =============================================================================
// SECTION 2 — ValidityOnly / Command (baseline stories 5–8)
//   CommandCard is the most contrastive consumer of validity-only mode.
//   Each story captured in both themes by Chromatic's global modes config.
// =============================================================================

// Story 5 — Command / Valid
export const ValidityOnlyCommandValid: Story = {
  name: "ValidityOnly / Command / Valid",
  render: () => <EvaluatorStatusBadge mode="validity-only" resourceType="command" state="valid" />,
};

// Story 6 — Command / Warnings
export const ValidityOnlyCommandWarnings: Story = {
  name: "ValidityOnly / Command / Warnings",
  render: () => (
    <EvaluatorStatusBadge mode="validity-only" resourceType="command" state="warnings" />
  ),
};

// Story 7 — Command / Invalid
export const ValidityOnlyCommandInvalid: Story = {
  name: "ValidityOnly / Command / Invalid",
  render: () => (
    <EvaluatorStatusBadge mode="validity-only" resourceType="command" state="invalid" />
  ),
};

// Story 8 — Command / Pending
export const ValidityOnlyCommandPending: Story = {
  name: "ValidityOnly / Command / Pending",
  render: () => (
    <EvaluatorStatusBadge mode="validity-only" resourceType="command" state="pending" />
  ),
};

// =============================================================================
// SECTION 3 — Forced-colors mode (stories 9–10)
//   Non-baseline: Chromatic snapshots disabled. These exist for manual review
//   of the WCAG forced-colors non-color-only signaling requirement.
//   The companion a11y test (EvaluatorStatusBadge.a11y.test.tsx) covers the
//   structural contract that must hold in forced-colors environments.
// =============================================================================

const ForcedColorsDecorator = (Story: () => React.ReactNode) => (
  <div
    style={
      {
        forcedColorAdjust: "none",
        background: "ButtonFace",
        color: "ButtonText",
        border: "1px solid ButtonBorder",
        padding: "8px",
      } as React.CSSProperties
    }
  >
    <style>{`
      .forced-colors-sim * {
        background-color: ButtonFace !important;
        color: ButtonText !important;
        border-color: ButtonBorder !important;
      }
    `}</style>
    <p style={{ fontSize: "11px", marginBottom: "8px", color: "GrayText" }}>
      Forced-colors simulation — icon + label must carry full meaning (non-color-only signaling).
    </p>
    <div className="forced-colors-sim">{Story()}</div>
  </div>
);

// Story 9 — ForcedColors / EvaluatorStatus / Hook / Quarantined
export const ForcedColorsEvaluatorStatusHookQuarantined: Story = {
  name: "ForcedColors / EvaluatorStatus / Hook / Quarantined",
  parameters: { chromatic: { disableSnapshot: true } },
  decorators: [ForcedColorsDecorator],
  render: () => (
    <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="quarantined" />
  ),
};

// Story 10 — ForcedColors / ValidityOnly / Command / Invalid
export const ForcedColorsValidityOnlyCommandInvalid: Story = {
  name: "ForcedColors / ValidityOnly / Command / Invalid",
  parameters: { chromatic: { disableSnapshot: true } },
  decorators: [ForcedColorsDecorator],
  render: () => (
    <EvaluatorStatusBadge mode="validity-only" resourceType="command" state="invalid" />
  ),
};

// =============================================================================
// SECTION 4 — Documentation stories (stories 11–14)
//   Non-Chromatic grid views for the design-system docs site.
//   NOT counted in the 16-snapshot Chromatic baseline (spec §8.3).
// =============================================================================

// Story 11 — Documentation / AllHookStates
export const DocumentationAllHookStates: Story = {
  name: "Documentation / AllHookStates",
  parameters: { chromatic: { disableSnapshot: true } },
  render: () => (
    <div className="flex flex-col gap-3">
      <p className="text-foreground-muted text-xs font-medium tracking-wide uppercase">
        All Hook states (evaluator-status mode)
      </p>
      <div className="flex flex-wrap gap-2">
        <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="approved" />
        <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="pending review" />
        <EvaluatorStatusBadge
          mode="evaluator-status"
          resourceType="hook"
          state="external — pending review"
        />
        <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="quarantined" />
        <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="declined" />
        <EvaluatorStatusBadge
          mode="evaluator-status"
          resourceType="hook"
          state="needs re-evaluation"
        />
        <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="disabled by you" />
      </div>
    </div>
  ),
};

// Story 12 — Documentation / AllSkillAndAgentStates
export const DocumentationAllSkillAndAgentStates: Story = {
  name: "Documentation / AllSkillAndAgentStates",
  parameters: { chromatic: { disableSnapshot: true } },
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-foreground-muted text-xs font-medium tracking-wide uppercase">
          Skill states
        </p>
        <div className="flex flex-wrap gap-2">
          <EvaluatorStatusBadge mode="evaluator-status" resourceType="skill" state="approved" />
          <EvaluatorStatusBadge
            mode="evaluator-status"
            resourceType="skill"
            state="pending review"
          />
          <EvaluatorStatusBadge
            mode="evaluator-status"
            resourceType="skill"
            state="external — pending review"
          />
          <EvaluatorStatusBadge mode="evaluator-status" resourceType="skill" state="declined" />
          <EvaluatorStatusBadge
            mode="evaluator-status"
            resourceType="skill"
            state="needs re-evaluation"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-foreground-muted text-xs font-medium tracking-wide uppercase">
          Agent states (identical vocabulary to Skill)
        </p>
        <div className="flex flex-wrap gap-2">
          <EvaluatorStatusBadge mode="evaluator-status" resourceType="agent" state="approved" />
          <EvaluatorStatusBadge
            mode="evaluator-status"
            resourceType="agent"
            state="pending review"
          />
          <EvaluatorStatusBadge
            mode="evaluator-status"
            resourceType="agent"
            state="external — pending review"
          />
          <EvaluatorStatusBadge mode="evaluator-status" resourceType="agent" state="declined" />
          <EvaluatorStatusBadge
            mode="evaluator-status"
            resourceType="agent"
            state="needs re-evaluation"
          />
        </div>
      </div>
    </div>
  ),
};

// Story 13 — Documentation / TypeSignaturePlayground
export const DocumentationTypeSignaturePlayground: Story = {
  name: "Documentation / TypeSignaturePlayground",
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    mode: "evaluator-status",
    resourceType: "hook",
    state: "approved",
  } as Parameters<typeof EvaluatorStatusBadge>[0],
  argTypes: {
    mode: { control: "select", options: ["evaluator-status", "validity-only"] },
    resourceType: {
      control: "select",
      options: ["skill", "agent", "hook", "command", "team", "workflow"],
    },
    state: {
      control: "select",
      options: [
        "approved",
        "pending review",
        "external — pending review",
        "quarantined",
        "declined",
        "needs re-evaluation",
        "disabled by you",
        "valid",
        "warnings",
        "invalid",
        "pending",
      ],
    },
  },
  render: (args) => (
    <EvaluatorStatusBadge {...(args as Parameters<typeof EvaluatorStatusBadge>[0])} />
  ),
};

// Story 14 — Documentation / CardComposition
export const DocumentationCardComposition: Story = {
  name: "Documentation / CardComposition",
  parameters: { chromatic: { disableSnapshot: true } },
  render: () => (
    <article
      aria-labelledby="doc-card-name"
      aria-describedby="doc-card-state"
      className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-4 shadow-sm"
      style={{ width: "280px" }}
    >
      <header className="flex items-start justify-between gap-2">
        <h3 id="doc-card-name" className="text-foreground text-sm font-semibold">
          PostToolUse: Bash
        </h3>
        <EvaluatorStatusBadge
          id="doc-card-state"
          mode="evaluator-status"
          resourceType="hook"
          state="quarantined"
        />
      </header>
      <p className="text-foreground-subtle text-xs">
        Consumer pattern: card uses{" "}
        <code className="bg-muted rounded px-1 font-mono">aria-describedby</code> to bind the badge
        as the state descriptor. The badge accepts an{" "}
        <code className="bg-muted rounded px-1 font-mono">id</code> prop for this linkage.
      </p>
    </article>
  ),
};
