import type { Meta, StoryObj } from "@storybook/react";
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  TooltipArrow,
} from "./Tooltip";
import { Button } from "@/components/ui/Button/Button";
import { Icon } from "@/components/ui/Icon/Icon";

const meta: Meta = {
  title: "Foundation/Tooltip",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj;

// ─── Default ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  render: () => (
    <TooltipRoot>
      <TooltipTrigger asChild>
        <Button variant="secondary">Hover me</Button>
      </TooltipTrigger>
      <TooltipContent>This is a tooltip with supplementary information.</TooltipContent>
    </TooltipRoot>
  ),
};

// ─── Sides ────────────────────────────────────────────────────────────────────

export const Sides: Story = {
  name: "Sides (top / right / bottom / left)",
  render: () => (
    <div className="grid grid-cols-2 gap-8 p-12">
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <TooltipRoot key={side}>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm">
              {side}
            </Button>
          </TooltipTrigger>
          <TooltipContent side={side}>Tooltip on the {side}</TooltipContent>
        </TooltipRoot>
      ))}
    </div>
  ),
};

// ─── WithShortcut ─────────────────────────────────────────────────────────────

export const WithShortcut: Story = {
  render: () => (
    <TooltipRoot>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open command palette">
          <Icon name="search" size="sm" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Open command palette · ⌘K</TooltipContent>
    </TooltipRoot>
  ),
};

// ─── IconOnlyButton ───────────────────────────────────────────────────────────

export const IconOnlyButton: Story = {
  name: "Icon-only Button (tooltip echoes aria-label)",
  render: () => (
    <TooltipRoot>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Reveal in Finder">
          <Icon name="folder-open" size="sm" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        Reveal in Finder · ⌘⇧R
      </TooltipContent>
    </TooltipRoot>
  ),
};

// ─── DisabledTriggerExplanation ───────────────────────────────────────────────

export const DisabledTriggerExplanation: Story = {
  name: "Disabled trigger (wrapped-span pattern)",
  render: () => (
    <TooltipRoot>
      <TooltipTrigger asChild>
        {/* Disabled buttons are not focusable — wrap in span so tooltip is keyboard-reachable */}
        <span tabIndex={0} className="inline-flex">
          <Button variant="default" disabled>
            Run task
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">Connect to sidecar to run.</TooltipContent>
    </TooltipRoot>
  ),
};

// ─── LongContent ──────────────────────────────────────────────────────────────

export const LongContent: Story = {
  name: "LongContent (80-char wrapping behavior)",
  render: () => (
    <TooltipRoot>
      <TooltipTrigger asChild>
        <Button variant="secondary" size="sm">
          Long tooltip
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        This tooltip contains a longer explanation that wraps to a second line to verify the 240px
        max-width constraint.
      </TooltipContent>
    </TooltipRoot>
  ),
};

// ─── WithArrow ────────────────────────────────────────────────────────────────

export const WithArrow: Story = {
  render: () => (
    <TooltipRoot>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm">
          With arrow
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        Tooltip with optional arrow
        <TooltipArrow />
      </TooltipContent>
    </TooltipRoot>
  ),
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "ReducedMotion (A-04 — instant fade)",
  decorators: [
    (Story) => (
      <div className="prefers-reduced-motion">
        <TooltipProvider>
          <Story />
        </TooltipProvider>
      </div>
    ),
  ],
  render: () => (
    <TooltipRoot defaultOpen>
      <TooltipTrigger asChild>
        <Button variant="secondary">Reduced motion</Button>
      </TooltipTrigger>
      <TooltipContent>Instant — no fade duration under reduced motion.</TooltipContent>
    </TooltipRoot>
  ),
};
