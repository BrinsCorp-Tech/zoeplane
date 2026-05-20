/**
 * SkillCard Storybook stories — all 7 card states + provenance variants.
 *
 * States covered:
 *   idle / hover / focus / warning / invalid (degraded) / pending-review (new skill)
 *   + no-provenance-default + with-plugin-provenance
 *
 * Story: 6.3 — Skill Library + SkillCard
 */

import type { Meta, StoryObj } from "@storybook/react";
import type { AssetSummary } from "@zoeplane/shared-types";
import { SkillCard } from "./SkillCard";

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

const BASE_ASSET: AssetSummary = {
  id: "00000000-0000-0000-0000-000000000001",
  kind: "skill",
  name: "code-reviewer",
  scope: "global",
  projectId: null,
  sourcePath: "/Users/zeke/.claude/skills/code-reviewer.md",
  validationStatus: "valid",
  lastModifiedAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
  lastModifiedBy: "external",
  frontMatter: {
    name: "Code Reviewer",
    description: "Reviews code for quality, correctness, and architectural alignment.",
  },
  bodyExcerpt: "Review code for quality and correctness.",
  provenance: null,
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof SkillCard> = {
  title: "Epic06/SkillCard",
  component: SkillCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } },
  },
  decorators: [
    (Story) => (
      <div className="p-8">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SkillCard>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/**
 * Idle — default state. validationStatus="valid", no provenance (user-authored).
 * EvaluatorStatusBadge renders "pending review" (v1 default — no evaluator has run).
 */
export const Idle: Story = {
  name: "Idle (all fields valid, pending review)",
  render: () => <SkillCard asset={BASE_ASSET} />,
};

/**
 * Hover — CSS-driven (pointer-over card).
 * Shown here as the same visual; the hover state is applied by the browser via Card interactive.
 */
export const Hover: Story = {
  name: "Hover (CSS-driven — same as idle, hover in browser)",
  render: () => <SkillCard asset={BASE_ASSET} />,
  parameters: {
    pseudo: { hover: true },
  },
};

/**
 * Focus — keyboard focus ring via Card interactive (A-11).
 */
export const Focus: Story = {
  name: "Focus (keyboard focus ring)",
  render: () => <SkillCard asset={BASE_ASSET} />,
  parameters: {
    pseudo: { focus: true, focusVisible: true },
  },
};

/**
 * Warning — validationStatus="warnings". EvaluatorStatusBadge renders "needs re-evaluation".
 * Warning footer caption "Front-matter incomplete" appears.
 */
export const Warning: Story = {
  name: "Warning (front-matter has warnings)",
  render: () => (
    <SkillCard
      asset={{
        ...BASE_ASSET,
        id: "00000000-0000-0000-0000-000000000002",
        validationStatus: "warnings",
        frontMatter: {
          name: "Partial Skill",
          description: "This skill has front-matter warnings.",
        },
      }}
    />
  ),
};

/**
 * Invalid (degraded) — validationStatus="invalid", frontMatter=null.
 * Renders dedicated degraded layout: filename basename, alert-octagon icon,
 * "Cannot parse front-matter" heading, full canonical path in monospace.
 * EvaluatorStatusBadge renders "declined".
 */
export const Invalid: Story = {
  name: "Invalid — degraded state (Cannot parse front-matter)",
  render: () => (
    <SkillCard
      asset={{
        ...BASE_ASSET,
        id: "00000000-0000-0000-0000-000000000003",
        validationStatus: "invalid",
        frontMatter: null,
        sourcePath: "/Users/zeke/.claude/skills/broken-skill/SKILL.md",
      }}
    />
  ),
};

/**
 * Pending review (new skill default) — validationStatus="valid", no evaluatorReportId.
 * Visually the same as Idle; story documents the "pending review" semantic intentionally.
 */
export const PendingReview: Story = {
  name: "Pending review (new skill, no evaluator has run)",
  render: () => (
    <SkillCard
      asset={{
        ...BASE_ASSET,
        id: "00000000-0000-0000-0000-000000000004",
        provenance: null, // evaluatorReportId implicitly null
      }}
    />
  ),
};

/**
 * No provenance (default) — provenance row is null.
 * Renders "User-authored" label in plain text (no chip chrome).
 */
export const NoProvenanceDefault: Story = {
  name: "No provenance (User-authored label)",
  render: () => (
    <SkillCard
      asset={{
        ...BASE_ASSET,
        id: "00000000-0000-0000-0000-000000000005",
        provenance: null,
      }}
    />
  ),
};

/**
 * With plugin provenance — sourceUrl is a valid URL.
 * Renders "From github.com" chip with Lucide link icon + accent colours.
 */
export const WithPluginProvenance: Story = {
  name: "Plugin provenance (From github.com chip)",
  render: () => (
    <SkillCard
      asset={{
        ...BASE_ASSET,
        id: "00000000-0000-0000-0000-000000000006",
        provenance: {
          id: "prov-001",
          sourceUrl: "https://github.com/anthropic/claude-skills/blob/main/code-reviewer/SKILL.md",
          sourceHash: "abc123def456",
          importedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
          evaluatorReportId: null,
          lastEvaluatedAt: null,
        },
      }}
    />
  ),
};

/**
 * Missing description — name present but description absent.
 * Renders "No description provided" in italic, triggers warning footer.
 */
export const MissingDescription: Story = {
  name: "Missing description (warning footer)",
  render: () => (
    <SkillCard
      asset={{
        ...BASE_ASSET,
        id: "00000000-0000-0000-0000-000000000007",
        frontMatter: {
          name: "Undocumented Skill",
          // no description
        },
      }}
    />
  ),
};
