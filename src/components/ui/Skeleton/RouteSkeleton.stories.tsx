/**
 * RouteSkeleton stories — Story 2.11 AC #8 + AC #10 skeleton matrix.
 *
 * RouteSkeleton is the full-route C2 cold-launch placeholder. It includes its
 * own role="status" aria-live region — stories do not need to wrap it.
 *
 * @see docs/design/components/LoadingSkeletons-spec.md §1.1
 */
import type { Meta, StoryObj } from "@storybook/react";
import { RouteSkeleton } from "./RouteSkeleton";

const meta: Meta<typeof RouteSkeleton> = {
  title: "Foundation/Skeleton/RouteSkeleton",
  component: RouteSkeleton,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof RouteSkeleton>;

// ─── Default ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Default (12 cards — canonical route placeholder)",
  args: {
    ariaLabel: "Loading skills library",
  },
};

// ─── CustomCount ──────────────────────────────────────────────────────────────

export const CustomCount: Story = {
  name: "CustomCount (cardCount=4 — sparse library override)",
  args: {
    ariaLabel: "Loading hooks library",
    cardCount: 4,
  },
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "Reduced motion (static muted fill, no shimmer)",
  decorators: [
    (StoryFn) => (
      <div>
        <style>{`@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`}</style>
        <div className="space-y-2 p-4">
          <p className="text-muted-foreground text-sm">
            Under prefers-reduced-motion: reduce — static muted fill, no shimmer. Dimensions and
            grid layout unchanged.
          </p>
          <StoryFn />
        </div>
      </div>
    ),
  ],
  args: {
    ariaLabel: "Loading skills library",
    cardCount: 4,
  },
};

// ─── ThemeContrast ────────────────────────────────────────────────────────────

export const ThemeContrast: Story = {
  name: "ThemeContrast (light + dark shimmer verification)",
  render: () => (
    <div className="space-y-8">
      <div data-theme="light" className="bg-background rounded-lg p-6">
        <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wide uppercase">
          Light theme
        </p>
        <RouteSkeleton ariaLabel="Loading skills library (light)" cardCount={4} />
      </div>
      <div data-theme="dark" className="bg-background rounded-lg p-6">
        <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wide uppercase">
          Dark theme
        </p>
        <RouteSkeleton ariaLabel="Loading skills library (dark)" cardCount={4} />
      </div>
    </div>
  ),
};
