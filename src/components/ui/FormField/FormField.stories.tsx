import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { FormField, FormLabel, FormControl, FormHelperText, FormErrorText } from "./FormField";
import { Input } from "@/components/ui/Input/Input";
import { Button } from "@/components/ui/Button/Button";

const meta: Meta<typeof FormField> = {
  title: "Foundation/FormField",
  component: FormField,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    required: { control: "boolean" },
    layout: { control: "select", options: ["stacked", "inline"] },
    error: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof FormField>;

// ─── Default ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  render: () => (
    <div className="w-80">
      <FormField>
        <FormLabel>Skill name</FormLabel>
        <FormControl asChild>
          <Input type="text" placeholder="api-explorer" />
        </FormControl>
      </FormField>
    </div>
  ),
};

// ─── Required ─────────────────────────────────────────────────────────────────

export const Required: Story = {
  render: () => (
    <div className="w-80">
      <FormField required>
        <FormLabel>Skill name</FormLabel>
        <FormControl asChild>
          <Input type="text" placeholder="api-explorer" />
        </FormControl>
      </FormField>
    </div>
  ),
};

// ─── WithHelperText ───────────────────────────────────────────────────────────

export const WithHelperText: Story = {
  render: () => (
    <div className="w-80">
      <FormField required>
        <FormLabel>Skill name</FormLabel>
        <FormControl asChild>
          <Input type="text" placeholder="api-explorer" />
        </FormControl>
        <FormHelperText>Lowercase letters and dashes only.</FormHelperText>
      </FormField>
    </div>
  ),
};

// ─── ErrorState ───────────────────────────────────────────────────────────────

export const ErrorState: Story = {
  render: () => (
    <div className="w-80">
      <FormField required error="Please enter a valid email address.">
        <FormLabel>Email</FormLabel>
        <FormControl asChild>
          <Input type="email" defaultValue="not-an-email" />
        </FormControl>
        <FormHelperText>Used for password reset.</FormHelperText>
      </FormField>
    </div>
  ),
};

// ─── InlineLayout ─────────────────────────────────────────────────────────────

export const InlineLayout: Story = {
  render: () => (
    <div className="w-96">
      <FormField layout="inline">
        <FormLabel>Cost limit (USD)</FormLabel>
        <FormControl asChild>
          <Input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="10.00" />
        </FormControl>
        <FormHelperText className="col-start-2">
          USD per task; rounds to nearest cent.
        </FormHelperText>
      </FormField>
    </div>
  ),
};

// ─── Disabled ─────────────────────────────────────────────────────────────────

export const Disabled: Story = {
  render: () => (
    <div className="w-80">
      <FormField>
        <FormLabel>Skill name</FormLabel>
        <FormControl asChild>
          <Input type="text" disabled defaultValue="locked-skill" />
        </FormControl>
        <FormHelperText>This skill is managed by your organization.</FormHelperText>
      </FormField>
    </div>
  ),
};

// ─── ReadOnly ─────────────────────────────────────────────────────────────────

export const ReadOnly: Story = {
  render: () => (
    <div className="w-80">
      <FormField>
        <FormLabel>Session ID</FormLabel>
        <FormControl asChild>
          <Input type="text" readOnly defaultValue="sess_a3f9bc12d4e5" />
        </FormControl>
        <FormHelperText>Auto-generated. Cannot be changed.</FormHelperText>
      </FormField>
    </div>
  ),
};

// ─── MultiFieldForm ───────────────────────────────────────────────────────────

export const MultiFieldForm: Story = {
  name: "MultiFieldForm (unique IDs verification)",
  render: () => {
    const [errors, setErrors] = useState<Record<string, string>>({});

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const next: Record<string, string> = {};
      if (!fd.get("name")) next.name = "Skill name is required.";
      if (!fd.get("email")) next.email = "Email is required.";
      setErrors(next);
    }

    return (
      <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-4">
        <FormField required error={errors.name}>
          <FormLabel>Skill name</FormLabel>
          <FormControl asChild>
            <Input name="name" type="text" placeholder="api-explorer" />
          </FormControl>
          <FormHelperText>Lowercase letters and dashes only.</FormHelperText>
          {errors.name && <FormErrorText>{errors.name}</FormErrorText>}
        </FormField>

        <FormField required error={errors.email}>
          <FormLabel>Email</FormLabel>
          <FormControl asChild>
            <Input name="email" type="email" placeholder="you@example.com" />
          </FormControl>
          {errors.email && <FormErrorText>{errors.email}</FormErrorText>}
        </FormField>

        <Button type="submit" size="sm">
          Submit
        </Button>
      </form>
    );
  },
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "ReducedMotion (A-32 error reveal)",
  decorators: [
    (Story) => (
      <div className="prefers-reduced-motion">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="w-80">
      <FormField error="Please enter a valid email address.">
        <FormLabel>Email</FormLabel>
        <FormControl asChild>
          <Input type="email" />
        </FormControl>
        <FormErrorText>Please enter a valid email address.</FormErrorText>
      </FormField>
    </div>
  ),
};
