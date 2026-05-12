import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./Input";
import { Icon } from "@/components/ui/Icon/Icon";

const meta: Meta<typeof Input> = {
  title: "Foundation/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Input>;

// ─── Default ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    type: "text",
    placeholder: "Enter text…",
  },
};

// ─── WithLeadingAffix ────────────────────────────────────────────────────────

export const WithLeadingAffix: Story = {
  name: "With leading affix (search icon)",
  args: {
    type: "search",
    placeholder: "Search skills, agents…",
    leadingAffix: <Icon name="search" size="sm" aria-hidden={true} />,
    "aria-label": "Search",
  },
};

// ─── WithTrailingAffix ───────────────────────────────────────────────────────

export const WithTrailingAffix: Story = {
  name: "With trailing affix (clear button)",
  args: {
    type: "text",
    defaultValue: "some-value",
    trailingAffix: (
      <button
        type="button"
        aria-label="Clear input"
        className="rounded-full p-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Icon name="x" size="xs" aria-hidden={true} />
      </button>
    ),
  },
};

// ─── Numeric ────────────────────────────────────────────────────────────────

export const Numeric: Story = {
  name: "Numeric (inputMode + pattern, not type=number)",
  args: {
    type: "text",
    inputMode: "numeric",
    pattern: "[0-9]*",
    placeholder: "0",
    "aria-label": "Port number",
  },
};

// ─── Disabled ────────────────────────────────────────────────────────────────

export const Disabled: Story = {
  args: {
    type: "text",
    placeholder: "Disabled",
    disabled: true,
  },
};

// ─── Error ────────────────────────────────────────────────────────────────────

export const Error: Story = {
  name: "Error state",
  args: {
    type: "email",
    defaultValue: "not-an-email",
    "aria-invalid": true,
    "aria-describedby": "email-error-demo",
    className: "border-danger",
  },
  render: (args) => (
    <div className="space-y-1">
      <Input {...args} />
      <p id="email-error-demo" className="text-xs text-danger">
        Please enter a valid email address.
      </p>
    </div>
  ),
};
