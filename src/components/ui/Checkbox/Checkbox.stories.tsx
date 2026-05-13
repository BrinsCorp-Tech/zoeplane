/**
 * Checkbox stories — design contract verification.
 *
 * @see docs/design/components/Checkbox-spec.md
 */
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Checkbox } from "./Checkbox";
import {
  FormField,
  FormLabel,
  FormControl,
  FormHelperText,
  FormErrorText,
} from "../FormField/FormField";

const meta: Meta<typeof Checkbox> = {
  title: "Foundation/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

// ─── Default (unchecked) ──────────────────────────────────────────────────────

export const Default: Story = {
  render: () => (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <Checkbox />
      <span>Include hidden files</span>
    </label>
  ),
};

// ─── Checked ──────────────────────────────────────────────────────────────────

export const Checked: Story = {
  render: () => (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <Checkbox checked={true} onCheckedChange={() => {}} />
      <span>Include hidden files</span>
    </label>
  ),
};

// ─── Indeterminate ────────────────────────────────────────────────────────────

export const Indeterminate: Story = {
  name: "Indeterminate (minus glyph — programmatic only, Space transitions to checked)",
  render: () => (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <Checkbox checked="indeterminate" onCheckedChange={() => {}} />
      <span className="text-sm">Select all skills</span>
    </label>
  ),
};

// ─── States ───────────────────────────────────────────────────────────────────

export const States: Story = {
  name: "States (unchecked / checked / indeterminate / error / disabled)",
  render: () => (
    <div className="flex flex-col gap-4">
      <label className="inline-flex cursor-pointer items-center gap-2">
        <Checkbox />
        <span className="text-sm">Unchecked</span>
      </label>
      <label className="inline-flex cursor-pointer items-center gap-2">
        <Checkbox checked={true} onCheckedChange={() => {}} />
        <span className="text-sm">Checked</span>
      </label>
      <label className="inline-flex cursor-pointer items-center gap-2">
        <Checkbox checked="indeterminate" onCheckedChange={() => {}} />
        <span className="text-sm">Indeterminate</span>
      </label>
      <label className="inline-flex cursor-pointer items-center gap-2">
        <Checkbox aria-invalid="true" />
        <span className="text-sm">Error (unchecked)</span>
      </label>
      <label className="inline-flex cursor-not-allowed items-center gap-2">
        <Checkbox disabled />
        <span className="text-foreground-disabled text-sm">Disabled</span>
      </label>
      <label className="inline-flex cursor-not-allowed items-center gap-2">
        <Checkbox disabled checked={true} onCheckedChange={() => {}} />
        <span className="text-foreground-disabled text-sm">Disabled + checked</span>
      </label>
    </div>
  ),
};

// ─── WithFormField ────────────────────────────────────────────────────────────

export const WithFormField: Story = {
  name: "WithFormField (required + helper + error)",
  render: () => {
    const [checked, setChecked] = useState<boolean | "indeterminate">(false);
    const [error, setError] = useState<string | undefined>();

    function handleCheckedChange(val: boolean | "indeterminate") {
      setChecked(val);
      if (val === true) setError(undefined);
    }

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!checked) setError("You must accept the terms to continue.");
    }

    return (
      <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-4">
        <FormField required error={error}>
          <FormLabel>I agree to the Plugin Marketplace terms.</FormLabel>
          <FormControl asChild>
            <Checkbox checked={checked} onCheckedChange={handleCheckedChange} />
          </FormControl>
          <FormHelperText>Required to install plugins from the marketplace.</FormHelperText>
          {error && <FormErrorText>{error}</FormErrorText>}
        </FormField>
        <button type="submit" className="text-foreground-muted text-sm underline">
          Submit (shows error if unchecked)
        </button>
      </form>
    );
  },
};

// ─── WithInlineLabel ──────────────────────────────────────────────────────────

export const WithInlineLabel: Story = {
  name: "WithInlineLabel (wrapping <label> pattern)",
  render: () => {
    const [checked, setChecked] = useState(false);
    return (
      <label className="inline-flex cursor-pointer items-center gap-2 select-none">
        <Checkbox checked={checked} onCheckedChange={(val) => setChecked(val === true)} />
        <span className="text-sm">Show hidden files in the Library tree</span>
      </label>
    );
  },
};

// ─── BulkSelectHeader ─────────────────────────────────────────────────────────

export const BulkSelectHeader: Story = {
  name: "BulkSelectHeader (indeterminate driven by row state)",
  render: () => {
    const [rows, setRows] = useState([false, false, false]);

    const allSelected = rows.every(Boolean);
    const someSelected = rows.some(Boolean) && !allSelected;
    const headerState: boolean | "indeterminate" = allSelected
      ? true
      : someSelected
        ? "indeterminate"
        : false;

    function toggleAll(val: boolean | "indeterminate") {
      setRows(rows.map(() => val === true));
    }

    function toggleRow(i: number) {
      const next = [...rows];
      next[i] = !next[i];
      setRows(next);
    }

    return (
      <div className="flex w-64 flex-col gap-2">
        <div className="border-border flex items-center gap-2 border-b pb-2">
          <Checkbox
            checked={headerState}
            onCheckedChange={toggleAll}
            aria-label="Select all skills"
          />
          <span className="text-sm font-medium">Select all skills</span>
        </div>
        {rows.map((checked, i) => (
          <label key={i} className="inline-flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={checked}
              onCheckedChange={() => toggleRow(i)}
              aria-label={`Select skill ${i + 1}`}
            />
            <span className="text-sm">Skill {i + 1}</span>
          </label>
        ))}
      </div>
    );
  },
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "ReducedMotion (instant fill, no glyph fade)",
  decorators: [
    (Story) => (
      <div className="motion-reduce">
        <Story />
      </div>
    ),
  ],
  render: () => {
    const [checked, setChecked] = useState(false);
    return (
      <label className="inline-flex cursor-pointer items-center gap-2">
        <Checkbox checked={checked} onCheckedChange={(val) => setChecked(val === true)} />
        <span className="text-sm">Toggle me — state change should be instant</span>
      </label>
    );
  },
};
