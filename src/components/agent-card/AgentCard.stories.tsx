/**
 * AgentCard Storybook stories — all 5 card-level states (idle / hover / focus / warning / invalid).
 * Story: 6.2 — Agent Library + AgentCard
 */

import type { Meta, StoryObj } from "@storybook/react";
import type { AssetSummary } from "@zoeplane/shared-types";
import { AgentCard } from "./AgentCard";

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

const BASE_ASSET: AssetSummary = {
  id: "00000000-0000-0000-0000-000000000001",
  kind: "agent",
  name: "sprint-programmer",
  scope: "global",
  projectId: null,
  sourcePath: "/Users/zeke/.claude/agents/sprint-programmer.md",
  validationStatus: "valid",
  lastModifiedAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
  lastModifiedBy: "external",
  frontMatter: {
    name: "Sprint Programmer",
    voice_id: "8fcyCHOzlKDlxh1InJSf",
    voice_name: "Joseph",
    traits: {
      expertise: ["implementation", "debugging"],
      personality: ["efficiency"],
      approach: ["rapid", "systematic"],
    },
    description: "Efficient craftsman who ships working code consistently.",
  },
  bodyExcerpt: "Ship working code. Perfect is the enemy of done.",
  provenance: null,
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof AgentCard> = {
  title: "Epic06/AgentCard",
  component: AgentCard,
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
type Story = StoryObj<typeof AgentCard>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Idle — default state with all fields present and valid. */
export const Idle: Story = {
  name: "Idle (all fields valid)",
  render: () => <AgentCard asset={BASE_ASSET} onActivate={(a) => console.log("activated", a.id)} />,
};

/**
 * Hover — CSS-driven (pointer-over card). Shown here as the same visual;
 * the hover state is applied automatically by the browser via Card interactive=true.
 */
export const Hover: Story = {
  name: "Hover (CSS-driven — same as idle, hover in browser)",
  render: () => <AgentCard asset={BASE_ASSET} />,
  parameters: {
    pseudo: { hover: true },
  },
};

/**
 * Focus — keyboard focus ring via Card interactive=true (A-11).
 * Shown with pseudo-focused state in Chromatic/a11y addons.
 */
export const Focus: Story = {
  name: "Focus (keyboard focus ring)",
  render: () => <AgentCard asset={BASE_ASSET} />,
  parameters: {
    pseudo: { focus: true, focusVisible: true },
  },
};

/** Warning — validationStatus="warnings" + missing archetype triggers warning footer. */
export const Warning: Story = {
  name: "Warning (front-matter has warnings)",
  render: () => (
    <AgentCard
      asset={{
        ...BASE_ASSET,
        id: "00000000-0000-0000-0000-000000000002",
        validationStatus: "warnings",
        frontMatter: {
          // No archetype, no traits.personality → derives from description
          name: "Research Analyst",
          voice_id: "abc123def456xyz0123456",
          description: "Systematic researcher who synthesizes complex information.",
          traits: {
            expertise: ["research"],
            personality: [],
            approach: [],
          },
        },
      }}
    />
  ),
};

/** Invalid — validationStatus="invalid" — front-matter could not be parsed. */
export const Invalid: Story = {
  name: "Invalid (front-matter unparseable)",
  render: () => (
    <AgentCard
      asset={{
        ...BASE_ASSET,
        id: "00000000-0000-0000-0000-000000000003",
        validationStatus: "invalid",
        frontMatter: null,
        sourcePath: "/Users/zeke/.claude/agents/broken-agent.md",
      }}
    />
  ),
};

/** Missing fields — voice ID missing, traits all empty → warning indicator on all rows. */
export const MissingFields: Story = {
  name: "Missing required fields (AC #4)",
  render: () => (
    <AgentCard
      asset={{
        ...BASE_ASSET,
        id: "00000000-0000-0000-0000-000000000004",
        validationStatus: "warnings",
        frontMatter: {
          name: "Incomplete Agent",
          // no voice_id, no traits, no archetype, no description
        },
      }}
    />
  ),
};

/** Invalid voice ID format — strike-through + ? icon. */
export const InvalidVoiceId: Story = {
  name: "Invalid voice ID format (strike-through + tooltip)",
  render: () => (
    <AgentCard
      asset={{
        ...BASE_ASSET,
        id: "00000000-0000-0000-0000-000000000005",
        frontMatter: {
          ...BASE_ASSET.frontMatter,
          voice_id: "short!", // fails /^[A-Za-z0-9]{15,32}$/
        },
      }}
    />
  ),
};

/** Many traits — tests the +N overflow chip. */
export const ManyTraits: Story = {
  name: "Many traits (overflow chip)",
  render: () => (
    <AgentCard
      asset={{
        ...BASE_ASSET,
        id: "00000000-0000-0000-0000-000000000006",
        frontMatter: {
          ...BASE_ASSET.frontMatter,
          traits: {
            expertise: ["implementation", "debugging", "architecture"],
            personality: ["efficiency", "directness"],
            approach: ["systematic", "rapid"],
          },
        },
      }}
    />
  ),
};
