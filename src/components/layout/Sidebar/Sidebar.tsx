/**
 * Sidebar — primary navigation pane (Story 2.9, Layout tier P0)
 *
 * - role="navigation" with aria-label="Primary navigation"
 * - Collapsible; collapse state persisted to localStorage key
 *   "zoeplane:sidebar:collapsed"
 * - Supports nav groups with collapsible sub-items (placeholder for Sprint 3
 *   when real nav items are wired from Epic 03)
 * - Active-state styling via activeItemId prop
 * - Reduced-motion: handled by CollapsiblePane (transition-duration: 0ms)
 *
 * Nav item taxonomy is deferred to consumer epics (Epic 03+). The Sidebar
 * accepts a `groups` prop with a static placeholder fallback for Storybook.
 *
 * @see src/components/layout/CollapsiblePane/CollapsiblePane.tsx
 * @see docs/design/ux-spec.md §8.2 Layout tier
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { CollapsiblePane } from "../CollapsiblePane/CollapsiblePane";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** A single navigation item within a group. */
export interface NavItem {
  id: string;
  label: string;
  /** Optional icon name — Epic 03 wires real icons; placeholder uses initials. */
  icon?: string;
}

/** A collapsible group of nav items. */
export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  /** Default expanded state for this group. @default true */
  defaultExpanded?: boolean;
}

export interface SidebarProps {
  /**
   * Nav groups to render. When omitted, a static placeholder set is rendered
   * for Storybook / development purposes.
   */
  groups?: NavGroup[];

  /** ID of the currently active nav item. Controls active-state styling. */
  activeItemId?: string;

  /** Called when a nav item is selected. */
  onItemSelect?: (itemId: string) => void;

  /** Optional className for the outer wrapper. */
  className?: string;
}

// ─── Default placeholder nav groups (Storybook / dev) ─────────────────────────

const DEFAULT_GROUPS: NavGroup[] = [
  {
    id: "libraries",
    label: "Libraries",
    items: [
      { id: "skills", label: "Skills" },
      { id: "agents", label: "Agents" },
      { id: "commands", label: "Commands" },
      { id: "hooks", label: "Hooks" },
      { id: "teams", label: "Teams" },
      { id: "workflows", label: "Workflows" },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "tasks", label: "Active Tasks" },
      { id: "history", label: "History" },
      { id: "settings", label: "Settings" },
    ],
  },
];

// ─── NavGroupPanel — collapsible group of nav items ──────────────────────────

interface NavGroupPanelProps {
  group: NavGroup;
  activeItemId?: string;
  onItemSelect?: (itemId: string) => void;
}

function NavGroupPanel({ group, activeItemId, onItemSelect }: NavGroupPanelProps) {
  const [expanded, setExpanded] = React.useState(group.defaultExpanded !== false);

  return (
    <div style={{ marginBottom: "var(--space-2)" }}>
      {/* Group header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "var(--space-1) var(--space-3)",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "var(--text-xs)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--color-foreground-muted)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          textAlign: "left",
        }}
      >
        <span>{group.label}</span>
        <span aria-hidden="true" style={{ fontSize: "10px" }}>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {/* Group items */}
      {expanded && (
        <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {group.items.map((item) => {
            const isActive = item.id === activeItemId;
            return (
              <li key={item.id} role="listitem">
                <button
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onItemSelect?.(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    width: "100%",
                    padding: "var(--space-2) var(--space-3)",
                    background: isActive ? "var(--color-surface-muted)" : "none",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    fontSize: "var(--text-sm)",
                    color: isActive ? "var(--color-foreground)" : "var(--color-foreground-muted)",
                    fontWeight: isActive ? "var(--weight-medium)" : "var(--weight-regular)",
                    textAlign: "left",
                  }}
                >
                  {/* Icon placeholder — Epic 03 wires real Icon component */}
                  <span
                    aria-hidden="true"
                    style={{
                      width: "16px",
                      height: "16px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      background: "var(--color-surface-muted)",
                      borderRadius: "2px",
                      flexShrink: 0,
                    }}
                  >
                    {item.label[0]}
                  </span>
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

/**
 * Sidebar — primary navigation pane with collapsible groups.
 *
 * Collapse state persisted to localStorage key "zoeplane:sidebar:collapsed".
 */
export function Sidebar({
  groups = DEFAULT_GROUPS,
  activeItemId,
  onItemSelect,
  className,
}: SidebarProps): React.ReactElement {
  return (
    <div
      className={cn("sidebar-root", className)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        height: "100%",
      }}
    >
      <CollapsiblePane
        storageKey="zoeplane:sidebar:collapsed"
        defaultCollapsed={false}
        direction="horizontal"
        expandedSize="240px"
        role="navigation"
        aria-label="Primary navigation"
        contentClassName="sidebar-content"
        renderToggle={({ collapsed, toggle }) => (
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={toggle}
            style={{
              width: "24px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderLeft: "none",
              cursor: "pointer",
              flexShrink: 0,
              alignSelf: "center",
              borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
              color: "var(--color-foreground-muted)",
              fontSize: "10px",
            }}
          >
            <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
          </button>
        )}
      >
        <div
          style={{
            height: "100%",
            background: "var(--color-surface)",
            borderRight: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            paddingTop: "var(--space-3)",
            paddingBottom: "var(--space-3)",
          }}
        >
          {groups.map((group) => (
            <NavGroupPanel
              key={group.id}
              group={group}
              activeItemId={activeItemId}
              onItemSelect={onItemSelect}
            />
          ))}
        </div>
      </CollapsiblePane>
    </div>
  );
}
