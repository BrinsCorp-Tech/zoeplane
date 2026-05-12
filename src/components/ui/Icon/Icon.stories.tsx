import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "./Icon";
import type { IconName } from "@zoeplane/shared-types";

const meta: Meta<typeof Icon> = {
  title: "Foundation/Icon",
  component: Icon,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof Icon>;

// ─── SizingScale ─────────────────────────────────────────────────────────────

export const SizingScale: Story = {
  name: "Sizing scale (xs → xl)",
  render: () => (
    <div className="flex items-end gap-4">
      <div className="flex flex-col items-center gap-1">
        <Icon name="check" size="xs" />
        <span className="text-xs text-muted-foreground">xs 12</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Icon name="check" size="sm" />
        <span className="text-xs text-muted-foreground">sm 16</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Icon name="check" size="md" />
        <span className="text-xs text-muted-foreground">md 20</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Icon name="check" size="lg" />
        <span className="text-xs text-muted-foreground">lg 24</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Icon name="check" size="xl" />
        <span className="text-xs text-muted-foreground">xl 32</span>
      </div>
    </div>
  ),
};

// ─── ColorInheritance ────────────────────────────────────────────────────────

export const ColorInheritance: Story = {
  name: "Color inheritance (currentColor)",
  render: () => (
    <div className="flex items-center gap-4">
      <span className="text-foreground flex items-center gap-1">
        <Icon name="check-circle" size="md" />
        Default
      </span>
      <span className="text-success flex items-center gap-1">
        <Icon name="check-circle" size="md" />
        Success
      </span>
      <span className="text-danger flex items-center gap-1">
        <Icon name="alert-circle" size="md" />
        Danger
      </span>
      <span className="text-warning flex items-center gap-1">
        <Icon name="alert-triangle" size="md" />
        Warning
      </span>
      <span className="text-info flex items-center gap-1">
        <Icon name="info" size="md" />
        Info
      </span>
      <span className="text-accent flex items-center gap-1">
        <Icon name="check" size="md" />
        Accent
      </span>
    </div>
  ),
};

// ─── Allowlist ───────────────────────────────────────────────────────────────

const ALLOWLIST: Array<{ family: string; icons: IconName[] }> = [
  {
    family: "Action",
    icons: ["check", "x", "plus", "edit", "trash", "copy", "save", "refresh-cw", "search", "filter"],
  },
  {
    family: "Navigation",
    icons: [
      "chevron-up", "chevron-down", "chevron-left", "chevron-right",
      "arrow-up", "arrow-down", "arrow-left", "arrow-right",
      "menu", "home", "external-link",
    ],
  },
  {
    family: "File / Data",
    icons: ["file", "folder", "folder-open", "file-code", "database", "list", "grid"],
  },
  {
    family: "Status",
    icons: ["check-circle", "alert-circle", "alert-triangle", "info", "loader-2", "shield", "play", "pause", "circle-dot"],
  },
  {
    family: "Domain",
    icons: ["terminal", "git-branch", "network", "lock", "unlock"],
  },
];

export const Allowlist: Story = {
  name: "Allowlist (visual catalog)",
  render: () => (
    <div className="space-y-6 p-4">
      {ALLOWLIST.map(({ family, icons }) => (
        <div key={family}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {family}
          </p>
          <div className="flex flex-wrap gap-4">
            {icons.map((name) => (
              <div key={name} className="flex flex-col items-center gap-1">
                <Icon name={name} size="md" />
                <span className="text-xs text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};

// ─── AccessibilityModes ───────────────────────────────────────────────────────

export const AccessibilityModes: Story = {
  name: "Accessibility: decorative vs meaningful",
  render: () => (
    <div className="space-y-4 p-4">
      <div>
        <p className="mb-2 text-sm font-medium">Decorative (aria-hidden=true, default)</p>
        <span className="inline-flex items-center gap-1 text-success">
          <Icon name="check" size="sm" />
          Valid
        </span>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Meaningful (aria-label provided)</p>
        <Icon
          name="circle-dot"
          size="sm"
          aria-label="Running"
          className="text-success"
        />
      </div>
    </div>
  ),
};
