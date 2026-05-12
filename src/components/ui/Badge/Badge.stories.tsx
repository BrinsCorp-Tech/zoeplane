import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";
import { Icon } from "@/components/ui/Icon/Icon";

const meta: Meta<typeof Badge> = {
  title: "Foundation/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

// ─── Default ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    children: "Global",
  },
};

// ─── Variants ────────────────────────────────────────────────────────────────

export const Variants: Story = {
  name: "All variants",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

// ─── WithIcon ────────────────────────────────────────────────────────────────

export const WithIcon: Story = {
  name: "With icon (non-color-only signaling)",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default" className="bg-success text-success-foreground">
        <Icon name="check" size="xs" aria-hidden={true} />
        Valid
      </Badge>
      <Badge variant="destructive">
        <Icon name="alert-circle" size="xs" aria-hidden={true} />
        Invalid
      </Badge>
      <Badge variant="secondary" className="bg-warning-muted text-warning-foreground">
        <Icon name="alert-triangle" size="xs" aria-hidden={true} />
        Warning
      </Badge>
      <Badge variant="outline">
        <Icon name="info" size="xs" aria-hidden={true} />
        Draft
      </Badge>
    </div>
  ),
};

// ─── WithDismiss ─────────────────────────────────────────────────────────────

export const WithDismiss: Story = {
  name: "Dismissible filter chip",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant="secondary"
        onDismiss={() => {}}
        dismissLabel="Dismiss filter: Global"
      >
        Scope: Global
      </Badge>
      <Badge
        variant="default"
        onDismiss={() => {}}
        dismissLabel="Dismiss filter: Bash"
      >
        Bash
      </Badge>
    </div>
  ),
};

// ─── Secondary ───────────────────────────────────────────────────────────────

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Python",
  },
};

// ─── Destructive ────────────────────────────────────────────────────────────

export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Error",
  },
};

// ─── Outline ────────────────────────────────────────────────────────────────

export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Draft",
  },
};
