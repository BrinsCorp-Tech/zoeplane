/**
 * Sidebar stories — Story 2.9 AC coverage
 *
 * Expanded + collapsed variants, light + dark themes, reduced-motion snapshot.
 */
import type { Meta, StoryObj } from "@storybook/react";
import { Sidebar } from "./Sidebar";
import type { NavGroup } from "./Sidebar";

const meta: Meta<typeof Sidebar> = {
  title: "Layout/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof Sidebar>;

const DEMO_GROUPS: NavGroup[] = [
  {
    id: "libraries",
    label: "Libraries",
    items: [
      { id: "skills", label: "Skills" },
      { id: "agents", label: "Agents" },
      { id: "commands", label: "Commands" },
      { id: "hooks", label: "Hooks" },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "tasks", label: "Active Tasks" },
      { id: "settings", label: "Settings" },
    ],
  },
];

// ─── Light theme ──────────────────────────────────────────────────────────────

export const ExpandedLight: Story = {
  name: "Expanded (light)",
  render: () => (
    <div
      data-theme="light"
      style={{ display: "flex", height: "500px", background: "var(--color-background)" }}
    >
      <Sidebar groups={DEMO_GROUPS} activeItemId="skills" />
      <main style={{ flex: 1, padding: "var(--space-6)", color: "var(--color-foreground)" }}>
        Main content area
      </main>
    </div>
  ),
};

export const CollapsedLight: Story = {
  name: "Collapsed (light)",
  render: () => (
    <div
      data-theme="light"
      style={{ display: "flex", height: "500px", background: "var(--color-background)" }}
    >
      {/* Render with localStorage pre-set to collapsed for demo */}
      <Sidebar groups={DEMO_GROUPS} activeItemId="skills" />
      <main style={{ flex: 1, padding: "var(--space-6)", color: "var(--color-foreground)" }}>
        Click the collapse toggle on the sidebar to collapse it.
      </main>
    </div>
  ),
  parameters: {
    // Set localStorage before story renders for Chromatic collapsed snapshot
    beforeEach: async () => {
      localStorage.setItem("zoeplane:sidebar:collapsed", "true");
    },
  },
};

// ─── Dark theme ───────────────────────────────────────────────────────────────

export const ExpandedDark: Story = {
  name: "Expanded (dark)",
  render: () => (
    <div
      data-theme="dark"
      style={{ display: "flex", height: "500px", background: "var(--color-background)" }}
    >
      <Sidebar groups={DEMO_GROUPS} activeItemId="agents" />
      <main style={{ flex: 1, padding: "var(--space-6)", color: "var(--color-foreground)" }}>
        Main content area
      </main>
    </div>
  ),
};

export const CollapsedDark: Story = {
  name: "Collapsed (dark)",
  render: () => (
    <div
      data-theme="dark"
      style={{ display: "flex", height: "500px", background: "var(--color-background)" }}
    >
      <Sidebar groups={DEMO_GROUPS} activeItemId="agents" />
      <main style={{ flex: 1, padding: "var(--space-6)", color: "var(--color-foreground)" }}>
        Click the collapse toggle.
      </main>
    </div>
  ),
  parameters: {
    beforeEach: async () => {
      localStorage.setItem("zoeplane:sidebar:collapsed", "true");
    },
  },
};

// ─── Reduced-motion ───────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "Reduced motion (no transition animation)",
  parameters: {
    chromatic: { prefersReducedMotion: "reduce" },
  },
  render: () => (
    <div
      data-theme="light"
      style={{ display: "flex", height: "500px", background: "var(--color-background)" }}
    >
      <Sidebar groups={DEMO_GROUPS} activeItemId="skills" />
      <main style={{ flex: 1, padding: "var(--space-6)", color: "var(--color-foreground)" }}>
        Main content — sidebar collapses with no animation
      </main>
    </div>
  ),
};
