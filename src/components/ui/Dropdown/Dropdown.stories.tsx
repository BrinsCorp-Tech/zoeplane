import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "./Dropdown";
import { Button } from "@/components/ui/Button/Button";
import { Icon } from "@/components/ui/Icon/Icon";

const meta: Meta = {
  title: "Foundation/Dropdown",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj;

// ─── Default ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Default (kebab actions)",
  render: () => (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Skill actions">
          <Icon name="more-horizontal" size="sm" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem>
          <Icon name="folder-open" size="sm" aria-hidden="true" />
          Reveal in Finder
          <DropdownMenuShortcut>⌘⇧R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Icon name="copy" size="sm" aria-hidden="true" />
          Duplicate skill
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger focus:bg-danger-muted focus:text-danger">
          <Icon name="trash" size="sm" aria-hidden="true" />
          Delete skill…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  ),
};

// ─── Checkbox ─────────────────────────────────────────────────────────────────

export const Checkbox: Story = {
  name: "Checkbox (filter facets)",
  render: () => {
    const [showWarnings, setShowWarnings] = useState(true);
    const [showDisabled, setShowDisabled] = useState(false);

    return (
      <DropdownMenuRoot>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">
            <Icon name="filter" size="sm" aria-hidden="true" />
            Filters
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Show</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={showWarnings} onCheckedChange={setShowWarnings}>
            Validation warnings
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={showDisabled} onCheckedChange={setShowDisabled}>
            Disabled hooks
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenuRoot>
    );
  },
};

// ─── Radio ────────────────────────────────────────────────────────────────────

export const Radio: Story = {
  name: "Radio (sort-by switcher)",
  render: () => {
    const [sortBy, setSortBy] = useState("recent");

    return (
      <DropdownMenuRoot>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Sort: {sortBy}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
            <DropdownMenuRadioItem value="recent">Most recent</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="alphabetical">Alphabetical</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="size">By size</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenuRoot>
    );
  },
};

// ─── Mixed ────────────────────────────────────────────────────────────────────

export const Mixed: Story = {
  name: "Mixed (label + radios + separator + destructive)",
  render: () => {
    const [view, setView] = useState("cards");

    return (
      <DropdownMenuRoot>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Options</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>View</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={view} onValueChange={setView}>
            <DropdownMenuRadioItem value="cards">Cards</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem>
            <Icon name="refresh-cw" size="sm" aria-hidden="true" />
            Refresh
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-danger focus:bg-danger-muted focus:text-danger">
            <Icon name="trash" size="sm" aria-hidden="true" />
            Delete all…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuRoot>
    );
  },
};

// ─── DisabledItems ────────────────────────────────────────────────────────────

export const DisabledItems: Story = {
  render: () => (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Skill actions</DropdownMenuLabel>
        <DropdownMenuItem>
          <Icon name="copy" size="sm" aria-hidden="true" />
          Duplicate skill
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Icon name="save" size="sm" aria-hidden="true" />
          Export (sign in first)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger focus:bg-danger-muted focus:text-danger">
          <Icon name="trash" size="sm" aria-hidden="true" />
          Delete skill…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  ),
};

// ─── LongList ─────────────────────────────────────────────────────────────────

export const LongList: Story = {
  name: "LongList (12 items — max acceptable count)",
  render: () => (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">12 items</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        {Array.from({ length: 12 }, (_, i) => (
          <DropdownMenuItem key={i}>Action {i + 1}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  ),
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "ReducedMotion (A-11 — no scale)",
  decorators: [
    (Story) => (
      <div className="prefers-reduced-motion">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">Open menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem>Duplicate skill</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger focus:bg-danger-muted focus:text-danger">
          Delete skill…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  ),
};
