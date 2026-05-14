/**
 * TitleBar stories — Story 2.9 AC coverage
 *
 * Light + dark themes; with and without control slots.
 */
import type { Meta, StoryObj } from "@storybook/react";
import { TitleBar } from "./TitleBar";

const meta: Meta<typeof TitleBar> = {
  title: "Layout/TitleBar",
  component: TitleBar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof TitleBar>;

// Mock control buttons for stories
function MockButton({ label }: { label: string }) {
  return (
    <button
      style={{
        padding: "4px 8px",
        background: "var(--color-surface-muted)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
        fontSize: "var(--text-xs)",
        color: "var(--color-foreground-muted)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ─── Light theme ──────────────────────────────────────────────────────────────

export const DefaultLight: Story = {
  name: "Default (light)",
  render: () => (
    <div data-theme="light">
      <TitleBar title="ZoePlane" />
    </div>
  ),
};

export const WithControlsLight: Story = {
  name: "With controls (light)",
  render: () => (
    <div data-theme="light">
      <TitleBar
        title="ZoePlane"
        leftControls={<MockButton label="File" />}
        rightControls={
          <>
            <MockButton label="Cmd-K" />
            <MockButton label="Settings" />
          </>
        }
      />
    </div>
  ),
};

// ─── Dark theme ───────────────────────────────────────────────────────────────

export const DefaultDark: Story = {
  name: "Default (dark)",
  render: () => (
    <div data-theme="dark">
      <TitleBar title="ZoePlane" />
    </div>
  ),
};

export const WithControlsDark: Story = {
  name: "With controls (dark)",
  render: () => (
    <div data-theme="dark">
      <TitleBar
        title="ZoePlane"
        leftControls={<MockButton label="File" />}
        rightControls={<MockButton label="Cmd-K" />}
      />
    </div>
  ),
};

// ─── Custom title ─────────────────────────────────────────────────────────────

export const CustomTitle: Story = {
  name: "Custom title",
  render: () => (
    <div data-theme="light">
      <TitleBar title="ZoePlane — MyProject" />
    </div>
  ),
};
