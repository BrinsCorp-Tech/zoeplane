import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./Skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "Foundation/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["text", "avatar", "card", "custom"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

// ─── Default ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Default (text variant)",
  args: {
    variant: "text",
    className: "w-48",
  },
};

// ─── Variants ─────────────────────────────────────────────────────────────────

export const Variants: Story = {
  name: "Variants (text / avatar / card / custom)",
  render: () => (
    <div className="flex flex-wrap items-start gap-8 p-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">text</p>
        <Skeleton variant="text" className="w-48" />
        <p className="text-muted-foreground text-xs">h-4 w-full (default)</p>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          avatar
        </p>
        <Skeleton variant="avatar" />
        <p className="text-muted-foreground text-xs">h-10 w-10 rounded-full</p>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">card</p>
        <Skeleton variant="card" />
        <p className="text-muted-foreground text-xs">h-[120px] w-60 rounded-lg</p>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          custom
        </p>
        <Skeleton
          variant="custom"
          className="h-5 w-full rounded-sm font-mono"
          style={{ width: "200px" }}
        />
        <p className="text-muted-foreground text-xs">caller-provided dimensions</p>
      </div>
    </div>
  ),
};

// ─── Composition ──────────────────────────────────────────────────────────────

export const Composition: Story = {
  name: "Composition (SkillCard placeholder + row-header pattern)",
  render: () => (
    <div className="flex flex-wrap items-start gap-8 p-4">
      {/* SkillCard placeholder — 5 Skeletons in canonical 240×120 shape */}
      <div>
        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          SkillCard placeholder
        </p>
        <div className="border-border bg-surface flex h-[120px] w-60 flex-col gap-2 rounded-lg border p-4">
          <Skeleton variant="text" className="h-5 w-3/4" />
          <Skeleton variant="text" className="h-3 w-1/2" />
          <Skeleton variant="text" className="h-3 w-full" />
          <Skeleton variant="text" className="h-3 w-5/6" />
          <Skeleton variant="text" className="mt-auto h-3 w-1/3" />
        </div>
      </div>

      {/* Row-header: avatar + two text lines */}
      <div>
        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Row-header (avatar + text)
        </p>
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="h-4 w-32" />
            <Skeleton variant="text" className="h-3 w-48" />
          </div>
        </div>
      </div>

      {/* Ragged paragraph */}
      <div>
        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Ragged paragraph
        </p>
        <div className="w-64 space-y-2">
          <Skeleton variant="text" className="w-full" />
          <Skeleton variant="text" className="w-11/12" />
          <Skeleton variant="text" className="w-3/4" />
        </div>
      </div>
    </div>
  ),
};

// ─── GridLayout ───────────────────────────────────────────────────────────────

export const GridLayout: Story = {
  name: "GridLayout (12-card grid, aria-live region)",
  render: () => (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading skill library"
      className="grid grid-cols-3 gap-4 p-4"
    >
      {Array.from({ length: 12 }).map((_, i) => (
        // Inline composition — no SkillCardSkeleton wrapper (Sprint 3+ deliverable)
        <div
          key={i}
          className="border-border bg-surface flex h-[120px] w-60 flex-col gap-2 rounded-lg border p-4"
        >
          <Skeleton variant="text" className="h-5 w-3/4" />
          <Skeleton variant="text" className="h-3 w-1/2" />
          <Skeleton variant="text" className="h-3 w-full" />
          <Skeleton variant="text" className="h-3 w-5/6" />
          <Skeleton variant="text" className="mt-auto h-3 w-1/3" />
        </div>
      ))}
    </div>
  ),
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "Reduced motion (static muted fill)",
  parameters: {
    chromatic: { prefersReducedMotion: "reduce" },
  },
  decorators: [
    (StoryFn) => (
      <div>
        <style>{`@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`}</style>
        <div className="space-y-4 p-4">
          <p className="text-muted-foreground text-sm">
            Under prefers-reduced-motion: reduce — solid muted fill, no shimmer gradient, no
            animation. Dimensions and border-radius identical to animated state.
          </p>
          <div className="space-y-3">
            <Skeleton variant="text" className="w-64" />
            <Skeleton variant="avatar" />
            <Skeleton variant="card" />
          </div>
        </div>
        <StoryFn />
      </div>
    ),
  ],
  render: () => <></>,
};

// ─── ThemeContrast ────────────────────────────────────────────────────────────

export const ThemeContrast: Story = {
  name: "ThemeContrast (light + dark shimmer verification)",
  render: () => (
    <div className="flex gap-8">
      {/* Light theme panel */}
      <div
        data-theme="light"
        className="bg-background space-y-3 rounded-lg p-6"
        style={{ minWidth: "200px" }}
      >
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Light theme
        </p>
        <Skeleton variant="text" className="w-full" />
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="avatar" />
        <p className="text-muted-foreground text-xs">Base: gray-100 / Highlight: white</p>
      </div>

      {/* Dark theme panel */}
      <div
        data-theme="dark"
        className="bg-background space-y-3 rounded-lg p-6"
        style={{ minWidth: "200px" }}
      >
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Dark theme
        </p>
        <Skeleton variant="text" className="w-full" />
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="avatar" />
        <p className="text-muted-foreground text-xs">
          Base: gray-900 / Highlight: gray-850 (surface-raised)
        </p>
      </div>
    </div>
  ),
};
