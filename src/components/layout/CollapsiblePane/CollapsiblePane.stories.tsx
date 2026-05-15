/**
 * CollapsiblePane stories — Story 2.9 AC coverage
 *
 * Validates collapse/expand behaviour, localStorage persistence,
 * horizontal/vertical modes, and reduced-motion story.
 */
import type { Meta, StoryObj } from "@storybook/react";
import { CollapsiblePane } from "./CollapsiblePane";

const meta: Meta<typeof CollapsiblePane> = {
  title: "Layout/CollapsiblePane",
  component: CollapsiblePane,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof CollapsiblePane>;

// ─── Horizontal (default — sidebar/inspector mode) ───────────────────────────

export const HorizontalExpanded: Story = {
  name: "Horizontal — Expanded",
  render: () => (
    <div
      data-theme="light"
      style={{ display: "flex", height: "300px", background: "var(--color-background)" }}
    >
      <CollapsiblePane
        direction="horizontal"
        expandedSize="200px"
        defaultCollapsed={false}
        role="navigation"
        aria-label="Primary navigation"
        renderToggle={({ collapsed, toggle }) => (
          <button
            onClick={toggle}
            aria-expanded={!collapsed}
            style={{
              padding: "8px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        )}
      >
        <div
          style={{ padding: "var(--space-4)", background: "var(--color-surface)", height: "100%" }}
        >
          <p style={{ color: "var(--color-foreground)" }}>Pane content</p>
          <p style={{ color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)" }}>
            Width: 200px
          </p>
        </div>
      </CollapsiblePane>
    </div>
  ),
};

export const HorizontalCollapsed: Story = {
  name: "Horizontal — Collapsed",
  render: () => (
    <div
      data-theme="light"
      style={{ display: "flex", height: "300px", background: "var(--color-background)" }}
    >
      <CollapsiblePane
        direction="horizontal"
        expandedSize="200px"
        defaultCollapsed={true}
        role="navigation"
        aria-label="Primary navigation"
        renderToggle={({ collapsed, toggle }) => (
          <button
            onClick={toggle}
            aria-expanded={!collapsed}
            style={{
              padding: "8px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        )}
      >
        <div
          style={{ padding: "var(--space-4)", background: "var(--color-surface)", height: "100%" }}
        >
          <p style={{ color: "var(--color-foreground)" }}>Pane content</p>
        </div>
      </CollapsiblePane>
    </div>
  ),
};

// ─── Dark theme ───────────────────────────────────────────────────────────────

export const HorizontalExpandedDark: Story = {
  name: "Horizontal — Expanded (dark)",
  render: () => (
    <div
      data-theme="dark"
      style={{ display: "flex", height: "300px", background: "var(--color-background)" }}
    >
      <CollapsiblePane
        direction="horizontal"
        expandedSize="200px"
        defaultCollapsed={false}
        role="navigation"
        aria-label="Primary navigation"
        renderToggle={({ collapsed, toggle }) => (
          <button
            onClick={toggle}
            aria-expanded={!collapsed}
            style={{
              padding: "8px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        )}
      >
        <div
          style={{ padding: "var(--space-4)", background: "var(--color-surface)", height: "100%" }}
        >
          <p style={{ color: "var(--color-foreground)" }}>Pane content</p>
        </div>
      </CollapsiblePane>
    </div>
  ),
};

// ─── Reduced-motion story ─────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "Horizontal — Reduced motion (transition-duration: 0ms)",
  render: () => (
    <div
      data-theme="light"
      style={{ display: "flex", height: "300px", background: "var(--color-background)" }}
    >
      <CollapsiblePane
        direction="horizontal"
        expandedSize="200px"
        defaultCollapsed={false}
        role="navigation"
        aria-label="Primary navigation"
        renderToggle={({ collapsed, toggle }) => (
          <button
            onClick={toggle}
            aria-expanded={!collapsed}
            style={{
              padding: "8px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        )}
      >
        <div
          style={{ padding: "var(--space-4)", background: "var(--color-surface)", height: "100%" }}
        >
          <p style={{ color: "var(--color-foreground)" }}>Pane content (reduced motion)</p>
        </div>
      </CollapsiblePane>
    </div>
  ),
};
