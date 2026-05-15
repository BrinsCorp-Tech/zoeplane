/**
 * TabStrip stories — Story 2.9 AC coverage
 *
 * 0 / 1 / 3 / many tabs; light + dark themes.
 * Uses the `tabs` prop to bypass the Zustand store for Storybook rendering.
 */
import type { Meta, StoryObj } from "@storybook/react";
import { TabStrip } from "./TabStrip";

const meta: Meta<typeof TabStrip> = {
  title: "Layout/TabStrip",
  component: TabStrip,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof TabStrip>;

// ─── 0 tabs ───────────────────────────────────────────────────────────────────

export const NoTabsLight: Story = {
  name: "0 tabs (empty state, light)",
  render: () => (
    <div data-theme="light" style={{ background: "var(--color-background)" }}>
      <TabStrip tabs={[]} />
    </div>
  ),
};

export const NoTabsDark: Story = {
  name: "0 tabs (empty state, dark)",
  render: () => (
    <div data-theme="dark" style={{ background: "var(--color-background)" }}>
      <TabStrip tabs={[]} />
    </div>
  ),
};

// ─── 1 tab ────────────────────────────────────────────────────────────────────

export const OneTabLight: Story = {
  name: "1 tab (light)",
  render: () => (
    <div data-theme="light" style={{ background: "var(--color-background)" }}>
      <TabStrip tabs={[{ id: "tab-1", title: "skills" }]} />
    </div>
  ),
};

// ─── 3 tabs ───────────────────────────────────────────────────────────────────

export const ThreeTabsLight: Story = {
  name: "3 tabs (light)",
  render: () => (
    <div data-theme="light" style={{ background: "var(--color-background)" }}>
      <TabStrip
        tabs={[
          { id: "tab-1", title: "skills" },
          { id: "tab-2", title: "agents" },
          { id: "tab-3", title: "commands" },
        ]}
      />
    </div>
  ),
};

export const ThreeTabsDark: Story = {
  name: "3 tabs (dark)",
  render: () => (
    <div data-theme="dark" style={{ background: "var(--color-background)" }}>
      <TabStrip
        tabs={[
          { id: "tab-1", title: "skills" },
          { id: "tab-2", title: "agents" },
          { id: "tab-3", title: "commands" },
        ]}
      />
    </div>
  ),
};

// ─── Many tabs ────────────────────────────────────────────────────────────────

export const ManyTabsLight: Story = {
  name: "Many tabs (overflow, light)",
  render: () => (
    <div data-theme="light" style={{ width: "600px", background: "var(--color-background)" }}>
      <TabStrip
        tabs={[
          { id: "t1", title: "skills" },
          { id: "t2", title: "agents" },
          { id: "t3", title: "commands" },
          { id: "t4", title: "hooks" },
          { id: "t5", title: "teams" },
          { id: "t6", title: "workflows" },
          { id: "t7", title: "active-tasks" },
          { id: "t8", title: "history" },
          { id: "t9", title: "settings" },
          { id: "t10", title: "configuration" },
        ]}
      />
    </div>
  ),
};
