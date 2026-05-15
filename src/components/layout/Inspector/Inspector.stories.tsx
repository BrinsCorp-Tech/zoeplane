/**
 * Inspector stories — Story 2.9 AC coverage
 *
 * Expanded + collapsed variants, light + dark themes, reduced-motion snapshot.
 */
import type { Meta, StoryObj } from "@storybook/react";
import { Inspector } from "./Inspector";

const meta: Meta<typeof Inspector> = {
  title: "Layout/Inspector",
  component: Inspector,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof Inspector>;

// ─── Light theme ──────────────────────────────────────────────────────────────

export const ExpandedLight: Story = {
  name: "Expanded (light)",
  render: () => (
    <div
      data-theme="light"
      style={{ display: "flex", height: "500px", background: "var(--color-background)" }}
    >
      <main
        style={{
          flex: 1,
          padding: "var(--space-6)",
          color: "var(--color-foreground)",
          borderRight: "1px solid var(--color-border)",
        }}
      >
        Main content area
      </main>
      <Inspector>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground)" }}>
          <p style={{ fontWeight: "var(--weight-medium)" }}>Selected: code-review skill</p>
          <p style={{ color: "var(--color-foreground-muted)", marginTop: "var(--space-2)" }}>
            Systematic code quality checks with structured feedback.
          </p>
        </div>
      </Inspector>
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
      <main
        style={{
          flex: 1,
          padding: "var(--space-6)",
          color: "var(--color-foreground)",
        }}
      >
        Click the inspector toggle to expand.
      </main>
      <Inspector />
    </div>
  ),
  parameters: {
    beforeEach: async () => {
      localStorage.setItem("zoeplane:inspector:collapsed", "true");
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
      <main
        style={{
          flex: 1,
          padding: "var(--space-6)",
          color: "var(--color-foreground)",
        }}
      >
        Main content area
      </main>
      <Inspector>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground)" }}>
          <p style={{ fontWeight: "var(--weight-medium)" }}>Selected: architect agent</p>
          <p style={{ color: "var(--color-foreground-muted)", marginTop: "var(--space-2)" }}>
            Technical Lead archetype.
          </p>
        </div>
      </Inspector>
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
      <main
        style={{
          flex: 1,
          padding: "var(--space-6)",
          color: "var(--color-foreground)",
        }}
      >
        Click the inspector toggle to expand.
      </main>
      <Inspector />
    </div>
  ),
  parameters: {
    beforeEach: async () => {
      localStorage.setItem("zoeplane:inspector:collapsed", "true");
    },
  },
};

// ─── Default (no selection) ───────────────────────────────────────────────────

export const NoSelection: Story = {
  name: "No selection (placeholder state)",
  render: () => (
    <div
      data-theme="light"
      style={{ display: "flex", height: "500px", background: "var(--color-background)" }}
    >
      <main style={{ flex: 1, padding: "var(--space-6)", color: "var(--color-foreground)" }}>
        Nothing selected
      </main>
      <Inspector />
    </div>
  ),
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
      <main style={{ flex: 1, padding: "var(--space-6)", color: "var(--color-foreground)" }}>
        Inspector collapses with no animation
      </main>
      <Inspector>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)" }}>
          Content
        </p>
      </Inspector>
    </div>
  ),
};
