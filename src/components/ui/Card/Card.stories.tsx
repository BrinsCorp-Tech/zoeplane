import type { Meta, StoryObj } from "@storybook/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./Card";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";

const meta: Meta<typeof Card> = {
  title: "Foundation/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "raised", "muted"],
    },
    interactive: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Card>;

// ─── Default ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Default (anatomy showcase)",
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Run Summary</CardTitle>
        <CardDescription>Last run completed 3 minutes ago.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">42 events emitted, 0 errors.</p>
      </CardContent>
    </Card>
  ),
};

// ─── Variants ────────────────────────────────────────────────────────────────

export const Variants: Story = {
  name: "All variants",
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs text-muted-foreground">default</p>
        <Card variant="default">
          <CardContent className="pt-6">Default card</CardContent>
        </Card>
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">raised</p>
        <Card variant="raised">
          <CardContent className="pt-6">Raised card</CardContent>
        </Card>
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">muted</p>
        <Card variant="muted">
          <CardContent className="pt-6">Muted card</CardContent>
        </Card>
      </div>
    </div>
  ),
};

// ─── Interactive ─────────────────────────────────────────────────────────────

export const Interactive: Story = {
  name: "Interactive (hover + focus)",
  render: () => (
    <Card interactive onClick={() => alert("Card clicked")}>
      <CardHeader>
        <CardTitle>api-explorer</CardTitle>
        <CardDescription>
          Inspects an OpenAPI spec and stubs example requests.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <Badge variant="default">Global</Badge>
        <Badge variant="secondary">Bash</Badge>
      </CardContent>
    </Card>
  ),
};

// ─── WithFooter ──────────────────────────────────────────────────────────────

export const WithFooter: Story = {
  name: "With footer",
  render: () => (
    <Card variant="raised">
      <CardHeader>
        <CardTitle>Confirm delete</CardTitle>
        <CardDescription>
          This will move the skill to the trash. You can restore it later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Skill: api-explorer</p>
      </CardContent>
      <CardFooter className="justify-end">
        <Button variant="secondary">Cancel</Button>
        <Button variant="destructive">Delete skill</Button>
      </CardFooter>
    </Card>
  ),
};

// ─── AllParts ────────────────────────────────────────────────────────────────

export const AllParts: Story = {
  name: "All sub-components",
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>A brief description of the card content.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Body content — accepts any children.</p>
      </CardContent>
      <CardFooter>
        <Button variant="secondary" size="sm">
          Cancel
        </Button>
        <Button size="sm">Save</Button>
      </CardFooter>
    </Card>
  ),
};
