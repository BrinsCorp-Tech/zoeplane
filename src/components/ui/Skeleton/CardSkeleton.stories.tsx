/**
 * CardSkeleton stories — Story 2.11 AC #8 + AC #10 skeleton matrix.
 *
 * CardSkeleton is a composition primitive — it lives inside an aria-live
 * region (LibraryShell's loading state or RouteSkeleton). Stories wrap it
 * in a role="status" region to demonstrate the canonical consumer pattern.
 *
 * @see docs/design/components/LoadingSkeletons-spec.md §1.2
 */
import type { Meta, StoryObj } from "@storybook/react";
import { CardSkeleton } from "./CardSkeleton";

const meta: Meta<typeof CardSkeleton> = {
  title: "Foundation/Skeleton/CardSkeleton",
  component: CardSkeleton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof CardSkeleton>;

// ─── Default ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Default (single card placeholder)",
  render: () => (
    <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading skill library">
      <CardSkeleton />
    </div>
  ),
};

// ─── Grid ─────────────────────────────────────────────────────────────────────

export const Grid: Story = {
  name: "Grid (12 in library-shell-grid — LibraryShell loading state composition)",
  render: () => (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading skill library"
      className="library-shell-grid w-[900px]"
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  ),
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "Reduced motion (static muted fill, no shimmer)",
  parameters: {
    chromatic: { prefersReducedMotion: "reduce" },
  },
  decorators: [
    (StoryFn) => (
      <div>
        <style>{`@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`}</style>
        <div className="space-y-3 p-4">
          <p className="text-muted-foreground text-sm">
            Under prefers-reduced-motion: reduce — solid muted fill, no shimmer. Dimensions
            unchanged.
          </p>
          <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading skill card">
            <CardSkeleton />
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
      <div
        data-theme="light"
        className="bg-background space-y-3 rounded-lg p-6"
        style={{ minWidth: "260px" }}
      >
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Light theme
        </p>
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Loading skill library (light)"
        >
          <CardSkeleton />
        </div>
      </div>
      <div
        data-theme="dark"
        className="bg-background space-y-3 rounded-lg p-6"
        style={{ minWidth: "260px" }}
      >
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Dark theme
        </p>
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Loading skill library (dark)"
        >
          <CardSkeleton />
        </div>
      </div>
    </div>
  ),
};
