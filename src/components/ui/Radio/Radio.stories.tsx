/**
 * Radio stories — design contract verification.
 *
 * @see docs/design/components/Radio-spec.md
 */
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "./Radio";
import {
  FormField,
  FormLabel,
  FormControl,
  FormHelperText,
  FormErrorText,
} from "../FormField/FormField";

const meta: Meta<typeof RadioGroup> = {
  title: "Foundation/Radio",
  component: RadioGroup,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

// ─── Default (vertical, 3 options) ───────────────────────────────────────────

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("asc");
    return (
      <fieldset className="m-0 border-0 p-0">
        <legend className="text-foreground mb-2 text-sm font-medium">Sort direction</legend>
        <RadioGroup value={value} onValueChange={setValue} aria-label="Sort direction">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="asc" />
            <span className="text-sm">Ascending (default)</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="desc" />
            <span className="text-sm">Descending</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="alpha" />
            <span className="text-sm">Alphabetical</span>
          </label>
        </RadioGroup>
      </fieldset>
    );
  },
};

// ─── Horizontal ───────────────────────────────────────────────────────────────

export const Horizontal: Story = {
  name: "Horizontal (Yes / No — short labels only)",
  render: () => {
    const [value, setValue] = useState<string>();
    return (
      <fieldset className="m-0 border-0 p-0">
        <legend className="text-foreground mb-2 text-sm font-medium">Enable Strict Mode?</legend>
        <RadioGroup
          value={value}
          onValueChange={setValue}
          aria-label="Enable Strict Mode"
          className="flex flex-row gap-6"
        >
          <label className="inline-flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="yes" />
            <span className="text-sm">Yes</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="no" />
            <span className="text-sm">No</span>
          </label>
        </RadioGroup>
      </fieldset>
    );
  },
};

// ─── RichRow ──────────────────────────────────────────────────────────────────

export const RichRow: Story = {
  name: "RichRow (Scope Disambiguation — ux-spec §8.6)",
  render: () => {
    const [scope, setScope] = useState("project");
    return (
      <fieldset className="m-0 w-80 border-0 p-0">
        <legend className="text-foreground mb-3 text-sm font-medium">Scope for this edit</legend>
        <RadioGroup
          value={scope}
          onValueChange={setScope}
          aria-label="Scope for this edit"
          className="gap-4"
        >
          <label className="flex cursor-pointer items-start gap-3">
            <RadioGroupItem value="project" className="mt-0.5" />
            <div>
              <span className="text-sm font-medium">Project (recommended)</span>
              <p className="text-foreground-muted mt-0.5 text-xs">
                Save to <code>./.claude/skills/</code> — applies to this project only.
              </p>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <RadioGroupItem value="global" className="mt-0.5" />
            <div>
              <span className="text-sm font-medium">Global</span>
              <p className="text-foreground-muted mt-0.5 text-xs">
                Save to <code>~/.claude/skills/</code> — applies to all projects.
              </p>
            </div>
          </label>
        </RadioGroup>
      </fieldset>
    );
  },
};

// ─── States ───────────────────────────────────────────────────────────────────

export const States: Story = {
  name: "States (unchecked / checked / error / disabled)",
  render: () => (
    <div className="flex flex-col gap-6">
      {/* Normal selection */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="text-foreground-muted mb-2 text-xs">Default selection</legend>
        <RadioGroup defaultValue="b" aria-label="Default selection example">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="a" />
            <span className="text-sm">Unchecked option</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="b" />
            <span className="text-sm">Checked option</span>
          </label>
        </RadioGroup>
      </fieldset>

      {/* Item-level disabled */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="text-foreground-muted mb-2 text-xs">Item-level disabled</legend>
        <RadioGroup defaultValue="a" aria-label="Item disabled example">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="a" />
            <span className="text-sm">Available</span>
          </label>
          <label className="inline-flex cursor-not-allowed items-center gap-2">
            <RadioGroupItem value="b" disabled />
            <span className="text-foreground-disabled text-sm">Disabled option</span>
          </label>
        </RadioGroup>
      </fieldset>

      {/* Group-level disabled */}
      <fieldset className="m-0 border-0 p-0" disabled>
        <legend className="text-foreground-muted mb-2 text-xs">Group-level disabled</legend>
        <RadioGroup defaultValue="a" aria-label="Group disabled example" disabled>
          <label className="inline-flex cursor-not-allowed items-center gap-2">
            <RadioGroupItem value="a" />
            <span className="text-foreground-disabled text-sm">Option A</span>
          </label>
          <label className="inline-flex cursor-not-allowed items-center gap-2">
            <RadioGroupItem value="b" />
            <span className="text-foreground-disabled text-sm">Option B</span>
          </label>
        </RadioGroup>
      </fieldset>
    </div>
  ),
};

// ─── WithFormField ────────────────────────────────────────────────────────────

export const WithFormField: Story = {
  name: "WithFormField (groupRole=radiogroup — fieldset + legend)",
  render: () => {
    const [direction, setDirection] = useState("");
    const [error, setError] = useState<string | undefined>();

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!direction) setError("Please select a sort direction.");
      else setError(undefined);
    }

    return (
      <form onSubmit={handleSubmit} className="flex w-72 flex-col gap-4">
        <FormField required error={error} groupRole="radiogroup">
          <FormLabel>Sort direction</FormLabel>
          <FormControl asChild>
            <RadioGroup value={direction} onValueChange={setDirection}>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <RadioGroupItem value="asc" />
                <span className="text-sm">Ascending (default)</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <RadioGroupItem value="desc" />
                <span className="text-sm">Descending</span>
              </label>
            </RadioGroup>
          </FormControl>
          <FormHelperText>Controls the order items appear in the Library.</FormHelperText>
          {error && <FormErrorText>{error}</FormErrorText>}
        </FormField>
        <button type="submit" className="text-foreground-muted text-sm underline">
          Submit (shows error if nothing selected)
        </button>
      </form>
    );
  },
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "ReducedMotion (dot transition instant on arrow-key)",
  decorators: [
    (Story) => (
      <div className="motion-reduce">
        <Story />
      </div>
    ),
  ],
  render: () => {
    const [value, setValue] = useState("a");
    return (
      <fieldset className="m-0 border-0 p-0">
        <legend className="text-foreground mb-2 text-sm font-medium">
          Dot transition (should be instant)
        </legend>
        <RadioGroup value={value} onValueChange={setValue} aria-label="Reduced motion demo">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="a" />
            <span className="text-sm">Option A</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="b" />
            <span className="text-sm">Option B</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="c" />
            <span className="text-sm">Option C</span>
          </label>
        </RadioGroup>
      </fieldset>
    );
  },
};
