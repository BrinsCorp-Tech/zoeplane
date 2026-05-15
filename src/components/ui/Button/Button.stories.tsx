import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import { Icon } from "@/components/ui/Icon/Icon";

const meta: Meta<typeof Button> = {
  title: "Foundation/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg", "icon"],
    },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ─── Default ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    children: "Save changes",
    variant: "default",
  },
};

// ─── Secondary ───────────────────────────────────────────────────────────────

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Cancel",
  },
};

// ─── Destructive ────────────────────────────────────────────────────────────

export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Delete skill…",
  },
};

// ─── Outline ────────────────────────────────────────────────────────────────

export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Export",
  },
};

// ─── Ghost ───────────────────────────────────────────────────────────────────

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "More options",
  },
};

// ─── Link ────────────────────────────────────────────────────────────────────

export const Link: Story = {
  args: {
    variant: "link",
    children: "View documentation",
  },
};

// ─── Sizes ───────────────────────────────────────────────────────────────────

export const Sizes: Story = {
  name: "Size scale (sm / default / lg / icon)",
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Reveal in Finder">
        <Icon name="folder-open" size="sm" aria-hidden={true} />
      </Button>
    </div>
  ),
};

// ─── Loading ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  name: "Loading state",
  render: () => (
    <div className="flex items-center gap-3">
      <Button loading>Save changes</Button>
      <Button variant="secondary" loading>
        Running…
      </Button>
    </div>
  ),
};

// ─── Disabled ────────────────────────────────────────────────────────────────

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Save changes",
  },
};

// ─── WithIcon ────────────────────────────────────────────────────────────────

export const WithIcon: Story = {
  name: "With leading icon",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button>
        <Icon name="check" size="sm" aria-hidden={true} />
        Save changes
      </Button>
      <Button variant="destructive">
        <Icon name="trash" size="sm" aria-hidden={true} />
        Delete skill…
      </Button>
      <Button variant="ghost" size="icon" aria-label="Reveal in Finder">
        <Icon name="folder-open" size="sm" aria-hidden={true} />
      </Button>
    </div>
  ),
};

// ─── AllVariants ────────────────────────────────────────────────────────────

export const AllVariants: Story = {
  name: "All variants",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button variant="default">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};
