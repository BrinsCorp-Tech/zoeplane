/**
 * Tabs stories — design contract verification.
 *
 * @see docs/design/components/Tabs-spec.md
 */
import type { Meta, StoryObj } from "@storybook/react";
import { TabsRoot, TabsList, Tab, TabPanel } from "./Tabs";
import { Icon } from "@/components/ui/Icon/Icon";

const meta: Meta<typeof TabsList> = {
  title: "Foundation/Tabs",
  component: TabsList,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof TabsList>;

// ─── Default (underline, 4 tabs) ─────────────────────────────────────────────

export const Default: Story = {
  render: () => (
    <div className="w-[500px]">
      <TabsRoot defaultValue="library">
        <TabsList aria-label="Main navigation">
          <Tab value="library" variant="underline">
            Library
          </Tab>
          <Tab value="workflows" variant="underline">
            Workflows
          </Tab>
          <Tab value="console" variant="underline">
            Task Console
          </Tab>
          <Tab value="settings" variant="underline">
            Settings
          </Tab>
        </TabsList>
        <TabPanel value="library">
          <div className="text-foreground-muted p-4 text-sm">Library view contents</div>
        </TabPanel>
        <TabPanel value="workflows">
          <div className="text-foreground-muted p-4 text-sm">Workflows view contents</div>
        </TabPanel>
        <TabPanel value="console">
          <div className="text-foreground-muted p-4 text-sm">Task Console view contents</div>
        </TabPanel>
        <TabPanel value="settings">
          <div className="text-foreground-muted p-4 text-sm">Settings view contents</div>
        </TabPanel>
      </TabsRoot>
    </div>
  ),
};

// ─── PillVariant ──────────────────────────────────────────────────────────────

export const PillVariant: Story = {
  name: "PillVariant (Library filter scope)",
  render: () => (
    <div className="w-80">
      <TabsRoot defaultValue="all">
        <TabsList aria-label="Filter scope" variant="pill">
          <Tab value="all" variant="pill">
            All
          </Tab>
          <Tab value="mine" variant="pill">
            Mine
          </Tab>
          <Tab value="recent" variant="pill">
            Recent
          </Tab>
        </TabsList>
        <TabPanel value="all">
          <div className="text-foreground-muted p-4 text-sm">All skills</div>
        </TabPanel>
        <TabPanel value="mine">
          <div className="text-foreground-muted p-4 text-sm">My skills</div>
        </TabPanel>
        <TabPanel value="recent">
          <div className="text-foreground-muted p-4 text-sm">Recent skills</div>
        </TabPanel>
      </TabsRoot>
    </div>
  ),
};

// ─── Sizes ────────────────────────────────────────────────────────────────────

export const Sizes: Story = {
  name: "Sizes (sm / md / lg)",
  render: () => (
    <div className="flex w-[400px] flex-col gap-8">
      {(["sm", "md", "lg"] as const).map((size) => (
        <TabsRoot key={size} defaultValue="a">
          <TabsList aria-label={`${size} tabs`}>
            <Tab value="a" variant="underline" size={size}>
              Tab A
            </Tab>
            <Tab value="b" variant="underline" size={size}>
              Tab B
            </Tab>
            <Tab value="c" variant="underline" size={size}>
              Tab C
            </Tab>
          </TabsList>
          <TabPanel value="a">
            <div className="text-foreground-muted p-2 text-xs">Size: {size}</div>
          </TabPanel>
          <TabPanel value="b">
            <div className="text-foreground-muted p-2 text-xs">Size: {size}</div>
          </TabPanel>
          <TabPanel value="c">
            <div className="text-foreground-muted p-2 text-xs">Size: {size}</div>
          </TabPanel>
        </TabsRoot>
      ))}
    </div>
  ),
};

// ─── States ───────────────────────────────────────────────────────────────────

export const States: Story = {
  name: "States (default / hover / focus / active / disabled)",
  render: () => (
    <div className="w-[400px]">
      <TabsRoot defaultValue="b">
        <TabsList aria-label="States demo">
          <Tab value="a" variant="underline">
            Inactive
          </Tab>
          <Tab value="b" variant="underline">
            Active (selected)
          </Tab>
          <Tab value="c" variant="underline" disabled>
            Disabled
          </Tab>
        </TabsList>
        <TabPanel value="a">
          <div className="text-foreground-muted p-4 text-sm">Inactive tab content</div>
        </TabPanel>
        <TabPanel value="b">
          <div className="text-foreground-muted p-4 text-sm">Active tab content</div>
        </TabPanel>
        <TabPanel value="c">
          <div className="text-foreground-muted p-4 text-sm">Disabled tab content</div>
        </TabPanel>
      </TabsRoot>
    </div>
  ),
};

// ─── WithIcons ────────────────────────────────────────────────────────────────

export const WithIcons: Story = {
  name: "WithIcons (leading icon pattern)",
  render: () => (
    <div className="w-[420px]">
      <TabsRoot defaultValue="metadata">
        <TabsList aria-label="Skill detail views">
          <Tab value="metadata" variant="underline">
            <Icon name="info" size="sm" aria-hidden="true" />
            Metadata
          </Tab>
          <Tab value="front-matter" variant="underline">
            <Icon name="file-code" size="sm" aria-hidden="true" />
            Front-matter
          </Tab>
          <Tab value="validation" variant="underline" disabled aria-describedby="val-disabled">
            <Icon name="check-circle" size="sm" aria-hidden="true" />
            Validation
          </Tab>
        </TabsList>
        <p id="val-disabled" className="sr-only">
          Validation pending — run the Evaluator first.
        </p>
        <TabPanel value="metadata">
          <div className="text-foreground-muted p-4 text-sm">Metadata panel</div>
        </TabPanel>
        <TabPanel value="front-matter">
          <div className="text-foreground-muted p-4 text-sm">Front-matter panel</div>
        </TabPanel>
        <TabPanel value="validation">
          <div className="text-foreground-muted p-4 text-sm">Validation panel</div>
        </TabPanel>
      </TabsRoot>
    </div>
  ),
};

// ─── LongLabels ───────────────────────────────────────────────────────────────

export const LongLabels: Story = {
  name: "LongLabels (near 16-char limit per spec §6)",
  render: () => (
    <div className="w-[520px]">
      <TabsRoot defaultValue="a">
        <TabsList aria-label="Long label tabs">
          <Tab value="a" variant="underline">
            Configuration
          </Tab>
          <Tab value="b" variant="underline">
            Integrations
          </Tab>
          <Tab value="c" variant="underline">
            Notifications
          </Tab>
          <Tab value="d" variant="underline">
            Security
          </Tab>
        </TabsList>
        <TabPanel value="a">
          <div className="text-foreground-muted p-4 text-sm">Configuration</div>
        </TabPanel>
        <TabPanel value="b">
          <div className="text-foreground-muted p-4 text-sm">Integrations</div>
        </TabPanel>
        <TabPanel value="c">
          <div className="text-foreground-muted p-4 text-sm">Notifications</div>
        </TabPanel>
        <TabPanel value="d">
          <div className="text-foreground-muted p-4 text-sm">Security</div>
        </TabPanel>
      </TabsRoot>
    </div>
  ),
};

// ─── ManualActivation ─────────────────────────────────────────────────────────

export const ManualActivation: Story = {
  name: "ManualActivation (arrow moves focus, Enter activates)",
  render: () => (
    <div className="w-[400px]">
      <TabsRoot defaultValue="dashboard" activationMode="manual">
        <TabsList aria-label="Analytics views (manual activation)">
          <Tab value="dashboard" variant="underline">
            Dashboard
          </Tab>
          <Tab value="audit-log" variant="underline">
            Audit log
          </Tab>
          <Tab value="cost-report" variant="underline">
            Cost report
          </Tab>
        </TabsList>
        <TabPanel value="dashboard">
          <div className="text-foreground-muted p-4 text-sm">
            Dashboard panel — arrow keys move focus only; Enter/Space activates.
          </div>
        </TabPanel>
        <TabPanel value="audit-log">
          <div className="text-foreground-muted p-4 text-sm">Audit log panel</div>
        </TabPanel>
        <TabPanel value="cost-report">
          <div className="text-foreground-muted p-4 text-sm">Cost report panel</div>
        </TabPanel>
      </TabsRoot>
    </div>
  ),
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "ReducedMotion (no panel fade, indicator jumps)",
  decorators: [
    (Story) => (
      <div className="motion-reduce">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="w-[400px]">
      <TabsRoot defaultValue="a">
        <TabsList aria-label="Reduced motion demo">
          <Tab value="a" variant="underline">
            Tab A
          </Tab>
          <Tab value="b" variant="underline">
            Tab B
          </Tab>
          <Tab value="c" variant="underline">
            Tab C
          </Tab>
        </TabsList>
        <TabPanel value="a">
          <div className="text-foreground-muted p-4 text-sm">
            Panel A — switching should be instant, no fade.
          </div>
        </TabPanel>
        <TabPanel value="b">
          <div className="text-foreground-muted p-4 text-sm">Panel B</div>
        </TabPanel>
        <TabPanel value="c">
          <div className="text-foreground-muted p-4 text-sm">Panel C</div>
        </TabPanel>
      </TabsRoot>
    </div>
  ),
};

// ─── WithAriaLabel ────────────────────────────────────────────────────────────

export const WithAriaLabel: Story = {
  name: "WithAriaLabel (visible proof of TabsList labeling requirement)",
  render: () => (
    <div className="flex w-[420px] flex-col gap-6">
      <div>
        <p className="text-foreground-muted mb-2 text-xs">
          ✓ Has aria-label — AT announces "Main navigation, tab list, 3 tabs"
        </p>
        <TabsRoot defaultValue="a">
          <TabsList aria-label="Main navigation">
            <Tab value="a" variant="underline">
              Library
            </Tab>
            <Tab value="b" variant="underline">
              Workflows
            </Tab>
            <Tab value="c" variant="underline">
              Settings
            </Tab>
          </TabsList>
          <TabPanel value="a">
            <div className="text-foreground-muted p-4 text-sm">Library</div>
          </TabPanel>
          <TabPanel value="b">
            <div className="text-foreground-muted p-4 text-sm">Workflows</div>
          </TabPanel>
          <TabPanel value="c">
            <div className="text-foreground-muted p-4 text-sm">Settings</div>
          </TabPanel>
        </TabsRoot>
      </div>
    </div>
  ),
};
