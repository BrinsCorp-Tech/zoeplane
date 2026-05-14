/**
 * PrimaryWorkArea stories — Story 2.9 AC coverage
 *
 * Light + dark themes; with children and placeholder (no children) states.
 */
import type { Meta, StoryObj } from "@storybook/react";
import { PrimaryWorkArea } from "./PrimaryWorkArea";

const meta: Meta<typeof PrimaryWorkArea> = {
  title: "Layout/PrimaryWorkArea",
  component: PrimaryWorkArea,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof PrimaryWorkArea>;

// ─── Light theme ──────────────────────────────────────────────────────────────

export const NoChildrenLight: Story = {
  name: "No children (placeholder, light)",
  render: () => (
    <div data-theme="light" style={{ display: "flex", height: "400px" }}>
      <PrimaryWorkArea />
    </div>
  ),
};

export const WithChildrenLight: Story = {
  name: "With children (light)",
  render: () => (
    <div data-theme="light" style={{ display: "flex", height: "400px" }}>
      <PrimaryWorkArea>
        <div style={{ padding: "var(--space-6)" }}>
          <h1
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--color-foreground)",
              marginBottom: "var(--space-4)",
            }}
          >
            Skills Library
          </h1>
          <p style={{ color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)" }}>
            Epic 03 wires real route content here. This is a placeholder.
          </p>
        </div>
      </PrimaryWorkArea>
    </div>
  ),
};

// ─── Dark theme ───────────────────────────────────────────────────────────────

export const NoChildrenDark: Story = {
  name: "No children (placeholder, dark)",
  render: () => (
    <div data-theme="dark" style={{ display: "flex", height: "400px" }}>
      <PrimaryWorkArea />
    </div>
  ),
};

export const WithChildrenDark: Story = {
  name: "With children (dark)",
  render: () => (
    <div data-theme="dark" style={{ display: "flex", height: "400px" }}>
      <PrimaryWorkArea>
        <div style={{ padding: "var(--space-6)" }}>
          <h1
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--color-foreground)",
              marginBottom: "var(--space-4)",
            }}
          >
            Agents Library
          </h1>
          <p style={{ color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)" }}>
            Placeholder content.
          </p>
        </div>
      </PrimaryWorkArea>
    </div>
  ),
};

// ─── Overflow / scroll test ───────────────────────────────────────────────────

export const OverflowScroll: Story = {
  name: "Overflow scroll (tall content)",
  render: () => (
    <div data-theme="light" style={{ display: "flex", height: "200px" }}>
      <PrimaryWorkArea>
        <div style={{ padding: "var(--space-6)" }}>
          {Array.from({ length: 20 }, (_, i) => (
            <p
              key={i}
              style={{
                color: "var(--color-foreground-muted)",
                fontSize: "var(--text-sm)",
                marginBottom: "var(--space-3)",
              }}
            >
              Content row {i + 1} — PrimaryWorkArea scrolls independently (overflow-y: auto).
            </p>
          ))}
        </div>
      </PrimaryWorkArea>
    </div>
  ),
};
