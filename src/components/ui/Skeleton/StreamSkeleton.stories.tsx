/**
 * StreamSkeleton stories — Story 2.11 AC #8 + AC #10 skeleton matrix.
 *
 * StreamSkeleton is the C3 streaming-surface placeholder — used for the brief
 * liminal state before the first streaming token arrives. It carries its own
 * role="status" aria-live region.
 *
 * @see docs/design/components/LoadingSkeletons-spec.md §1.3
 */
import type { Meta, StoryObj } from "@storybook/react";
import { StreamSkeleton } from "./StreamSkeleton";

const meta: Meta<typeof StreamSkeleton> = {
  title: "Foundation/Skeleton/StreamSkeleton",
  component: StreamSkeleton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    lines: {
      control: { type: "range", min: 3, max: 8, step: 1 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof StreamSkeleton>;

// ─── Default ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Default (5 lines — canonical pre-first-token placeholder)",
  args: {
    ariaLabel: "Connecting to Zoe…",
    lines: 5,
  },
  decorators: [
    (StoryFn) => (
      <div className="w-80">
        <StoryFn />
      </div>
    ),
  ],
};

// ─── ShortStream ──────────────────────────────────────────────────────────────

export const ShortStream: Story = {
  name: "ShortStream (3 lines — compact pane)",
  args: {
    ariaLabel: "Waiting for researcher agent to start",
    lines: 3,
  },
  decorators: [
    (StoryFn) => (
      <div className="w-80">
        <StoryFn />
      </div>
    ),
  ],
};

// ─── LongStream ───────────────────────────────────────────────────────────────

export const LongStream: Story = {
  name: "LongStream (8 lines — evaluator report pane)",
  args: {
    ariaLabel: "Generating skill draft",
    lines: 8,
  },
  decorators: [
    (StoryFn) => (
      <div className="w-80">
        <StoryFn />
      </div>
    ),
  ],
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "Reduced motion (static muted fill — opacity tapering preserved)",
  parameters: {
    chromatic: { prefersReducedMotion: "reduce" },
  },
  decorators: [
    (StoryFn) => (
      <div>
        <style>{`@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`}</style>
        <div className="w-80 space-y-3 p-4">
          <p className="text-muted-foreground text-sm">
            Under prefers-reduced-motion: reduce — shimmer suppressed; static muted fill retained.
            Opacity tapering (1.0→0.4) is static CSS — preserved in reduced-motion mode.
          </p>
          <StoryFn />
        </div>
      </div>
    ),
  ],
  args: {
    ariaLabel: "Connecting to Zoe…",
    lines: 5,
  },
};

// ─── ThemeContrast ────────────────────────────────────────────────────────────

export const ThemeContrast: Story = {
  name: "ThemeContrast (light + dark — note: bottom line may fade in dark theme)",
  render: () => (
    <div className="flex gap-8">
      <div
        data-theme="light"
        className="bg-background space-y-3 rounded-lg p-6"
        style={{ minWidth: "280px" }}
      >
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Light theme
        </p>
        <StreamSkeleton ariaLabel="Connecting to Zoe… (light)" lines={5} />
      </div>
      <div
        data-theme="dark"
        className="bg-background space-y-3 rounded-lg p-6"
        style={{ minWidth: "280px" }}
      >
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Dark theme
        </p>
        <StreamSkeleton ariaLabel="Connecting to Zoe… (dark)" lines={5} />
        <p className="text-muted-foreground text-xs">
          Note: lowest-opacity line may fade to near-invisible in dark theme — accepted per
          LoadingSkeletons-spec §9 (reinforces "tapering off" metaphor).
        </p>
      </div>
    </div>
  ),
};
