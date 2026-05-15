/**
 * Select stories — design contract verification.
 *
 * @see docs/design/components/Select-spec.md
 */
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  SelectRoot,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from "./Select";
import {
  FormField,
  FormLabel,
  FormControl,
  FormHelperText,
  FormErrorText,
} from "../FormField/FormField";

const meta: Meta<typeof SelectTrigger> = {
  title: "Foundation/Select",
  component: SelectTrigger,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof SelectTrigger>;

// ─── Default ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  render: () => (
    <div className="w-64">
      <SelectRoot>
        <SelectTrigger>
          <SelectValue placeholder="Select a model…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="opus">Opus 4.7</SelectItem>
          <SelectItem value="sonnet">Sonnet 4.7</SelectItem>
          <SelectItem value="haiku">Haiku 4.7</SelectItem>
        </SelectContent>
      </SelectRoot>
    </div>
  ),
};

// ─── WithPlaceholder ──────────────────────────────────────────────────────────

export const WithPlaceholder: Story = {
  render: () => (
    <div className="w-64">
      <SelectRoot>
        <SelectTrigger>
          <SelectValue placeholder="Select a project…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="zoeplane">ZoePlane</SelectItem>
          <SelectItem value="plugin-sdk">Plugin SDK</SelectItem>
        </SelectContent>
      </SelectRoot>
    </div>
  ),
};

// ─── Sizes ────────────────────────────────────────────────────────────────────

export const Sizes: Story = {
  name: "Sizes (sm / md / lg)",
  render: () => (
    <div className="flex w-64 flex-col gap-3">
      <SelectRoot>
        <SelectTrigger size="sm" aria-label="Small select">
          <SelectValue placeholder="Small (32px)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
        </SelectContent>
      </SelectRoot>
      <SelectRoot>
        <SelectTrigger size="md" aria-label="Medium select">
          <SelectValue placeholder="Medium — default (36px)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
        </SelectContent>
      </SelectRoot>
      <SelectRoot>
        <SelectTrigger size="lg" aria-label="Large select">
          <SelectValue placeholder="Large (40px)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
        </SelectContent>
      </SelectRoot>
    </div>
  ),
};

// ─── States ───────────────────────────────────────────────────────────────────

export const States: Story = {
  name: "States (default / error / disabled)",
  render: () => (
    <div className="flex w-64 flex-col gap-3">
      <SelectRoot>
        <SelectTrigger aria-label="Default state">
          <SelectValue placeholder="Default state" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
        </SelectContent>
      </SelectRoot>

      <SelectRoot>
        <SelectTrigger aria-label="With selected value">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sonnet">Sonnet 4.7</SelectItem>
        </SelectContent>
      </SelectRoot>

      <SelectRoot>
        <SelectTrigger aria-label="Error state" aria-invalid="true">
          <SelectValue placeholder="Error state" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
        </SelectContent>
      </SelectRoot>

      <SelectRoot>
        <SelectTrigger disabled aria-label="Disabled state">
          <SelectValue placeholder="Disabled state" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
        </SelectContent>
      </SelectRoot>
    </div>
  ),
};

// ─── Grouped ──────────────────────────────────────────────────────────────────

export const Grouped: Story = {
  name: "Grouped (SelectLabel + SelectSeparator)",
  render: () => (
    <div className="w-64">
      <SelectRoot>
        <SelectTrigger>
          <SelectValue placeholder="Select a model…" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Anthropic</SelectLabel>
            <SelectItem value="opus">Opus 4.7</SelectItem>
            <SelectItem value="sonnet">Sonnet 4.7</SelectItem>
            <SelectItem value="haiku">Haiku 4.7</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Other</SelectLabel>
            <SelectItem value="gpt-4">GPT-4o</SelectItem>
            <SelectItem value="gemini" disabled>
              Gemini Pro (unavailable)
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </SelectRoot>
    </div>
  ),
};

// ─── LongList ─────────────────────────────────────────────────────────────────

export const LongList: Story = {
  name: "LongList (12 options — edge of acceptable)",
  render: () => (
    <div className="w-64">
      <SelectRoot>
        <SelectTrigger>
          <SelectValue placeholder="Select a timezone…" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => (
            <SelectItem key={i} value={`tz-${i}`}>
              UTC{i > 5 ? "+" : "-"}
              {Math.abs(i - 5)}:00
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </div>
  ),
};

// ─── WithFormField ────────────────────────────────────────────────────────────

export const WithFormField: Story = {
  name: "WithFormField (required + helper + error)",
  render: () => {
    const [model, setModel] = useState("");
    const [error, setError] = useState<string | undefined>();

    function handleBlur() {
      if (!model) setError("Please select a model.");
      else setError(undefined);
    }

    return (
      <div className="w-72">
        <FormField required error={error}>
          <FormLabel>Default model</FormLabel>
          <FormControl asChild>
            <SelectRoot value={model} onValueChange={setModel}>
              <SelectTrigger onBlur={handleBlur}>
                <SelectValue placeholder="Select a model…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Anthropic</SelectLabel>
                  <SelectItem value="opus">Opus 4.7</SelectItem>
                  <SelectItem value="sonnet">Sonnet 4.7</SelectItem>
                  <SelectItem value="haiku">Haiku 4.7</SelectItem>
                </SelectGroup>
              </SelectContent>
            </SelectRoot>
          </FormControl>
          <FormHelperText>
            Used when a Skill or Agent omits its own model preference.
          </FormHelperText>
          {error && <FormErrorText>{error}</FormErrorText>}
        </FormField>
      </div>
    );
  },
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "ReducedMotion (no chevron rotation, no scale on open)",
  decorators: [
    (Story) => (
      <div className="motion-reduce">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="w-64">
      <SelectRoot>
        <SelectTrigger>
          <SelectValue placeholder="Open me — no animation" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
          <SelectItem value="c">Option C</SelectItem>
        </SelectContent>
      </SelectRoot>
    </div>
  ),
};
