import type { Meta, StoryObj } from "@storybook/react";
import { Spinner } from "./Spinner";
import { Button } from "@/components/ui/Button/Button";

const meta: Meta<typeof Spinner> = {
  title: "Foundation/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg", "xl"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Spinner>;

// ─── Default ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Default (sm, decorative)",
  args: {
    size: "sm",
  },
};

// ─── Sizes ────────────────────────────────────────────────────────────────────

export const Sizes: Story = {
  name: "Size scale (xs → xl)",
  render: () => (
    <div className="flex items-end gap-4">
      <div className="flex flex-col items-center gap-2">
        <Spinner size="xs" />
        <span className="text-muted-foreground text-xs">xs 14px</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner size="sm" />
        <span className="text-muted-foreground text-xs">sm 16px</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner size="md" />
        <span className="text-muted-foreground text-xs">md 20px</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner size="lg" />
        <span className="text-muted-foreground text-xs">lg 24px</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner size="xl" />
        <span className="text-muted-foreground text-xs">xl 32px</span>
      </div>
    </div>
  ),
};

// ─── Standalone ───────────────────────────────────────────────────────────────

export const Standalone: Story = {
  name: "Standalone (role=status + aria-label)",
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground mb-2 text-xs">Inline pair — Category C1 indicator</p>
        <span className="text-muted-foreground inline-flex items-center gap-2">
          <Spinner size="sm" role="status" aria-label="Loading settings" />
          Loading…
        </span>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-xs">Empty-pane liminal state — lg size</p>
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-8">
          <Spinner size="lg" role="status" aria-label="Connecting to Zoe" />
          <span>Connecting to Zoe…</span>
        </div>
      </div>
    </div>
  ),
};

// ─── InsideButton ─────────────────────────────────────────────────────────────

export const InsideButton: Story = {
  name: "Inside Button (loading state — validates swap)",
  render: () => (
    <div className="flex items-center gap-3">
      <Button loading>Save changes</Button>
      <Button variant="secondary" loading>
        Running…
      </Button>
      <Button variant="outline" loading size="sm">
        Saving
      </Button>
    </div>
  ),
};

// ─── ColorInheritance ─────────────────────────────────────────────────────────

export const ColorInheritance: Story = {
  name: "Color inheritance (currentColor)",
  render: () => (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <span className="text-foreground">
          <Spinner size="md" />
        </span>
        <span className="text-muted-foreground text-xs">foreground</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-muted-foreground">
          <Spinner size="md" />
        </span>
        <span className="text-muted-foreground text-xs">muted</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-primary">
          <Spinner size="md" />
        </span>
        <span className="text-muted-foreground text-xs">primary</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-destructive">
          <Spinner size="md" />
        </span>
        <span className="text-muted-foreground text-xs">destructive</span>
      </div>
    </div>
  ),
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "Reduced motion (static 270° arc)",
  parameters: {
    // Force prefers-reduced-motion: reduce in this story.
    // The Tailwind motion-reduce:animate-none utility removes the spin keyframe;
    // the static arc (border-current / border-t-transparent geometry) is preserved.
    chromatic: { prefersReducedMotion: "reduce" },
  },
  decorators: [
    (StoryFn) => (
      <div
        style={
          {
            // Inject the media query override via a style tag in the decorator root.
            // Storybook's chromatic parameter handles this for CI snapshots;
            // this CSS custom property signals intent for manual review.
          } as React.CSSProperties
        }
      >
        <style>{`@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`}</style>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Under prefers-reduced-motion: reduce — static 270° arc, no rotation. Same dimensions,
            same border-radius. Affordance preserved.
          </p>
          <div className="flex items-end gap-4">
            <Spinner size="xs" />
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
            <Spinner size="xl" />
          </div>
        </div>
        <StoryFn />
      </div>
    ),
  ],
  render: () => <></>,
};
