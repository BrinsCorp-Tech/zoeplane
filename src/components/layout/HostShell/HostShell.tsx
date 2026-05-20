/**
 * HostShell — top-level application layout compositor (Story 2.8, Layout tier P0)
 *
 * Composes the six ux-spec §6.1 layout regions into a full-screen CSS Grid:
 *
 *   "title    title    title"     — TitleBar (role="banner")
 *   "sidebar  content  inspector" — Sidebar (role="navigation") | content column | Inspector (role="complementary")
 *   "status   status   status"    — StatusBar (role="contentinfo")
 *
 * Content column stacks TabStrip (top) and PrimaryWorkArea (flex: 1).
 *
 * Empty-state behaviour:
 *   When useProject() === null, PrimaryWorkArea receives a centered placeholder
 *   ("No project open" / "Open a project to get started"). When a project IS
 *   open, an Epic 03 placeholder is rendered — route wiring is Epic 03 scope.
 *
 * Story 2.10 additions:
 *   - CommandPalette and NotificationsCenter mounted as portal siblings outside
 *     the CSS Grid. They render via Modal portals and don't affect layout flow.
 *   - Inspector receives expandedWidth="296px" (MED carryover from Story 2.8):
 *     the HostShell grid column is 320px; the 24px toggle button sits outside
 *     the pane, so the pane gets 296px to fill the cell flush.
 *
 * @see docs/design/ux-spec.md §6.1 — canonical layout regions
 * @see src/components/layout/TitleBar/TitleBar.tsx
 * @see src/components/layout/Sidebar/Sidebar.tsx
 * @see src/components/layout/Inspector/Inspector.tsx
 * @see src/components/layout/TabStrip/TabStrip.tsx
 * @see src/components/layout/PrimaryWorkArea/PrimaryWorkArea.tsx
 * @see src/components/layout/StatusBar/StatusBar.tsx
 * @see src/components/layout/CommandPalette/CommandPalette.tsx
 * @see src/components/layout/NotificationsCenter/NotificationsCenter.tsx
 * @see src/hooks/useProject.ts
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { TitleBar } from "../TitleBar/TitleBar";
import { Sidebar } from "../Sidebar/Sidebar";
import { Inspector } from "../Inspector/Inspector";
import { TabStrip } from "../TabStrip/TabStrip";
import { PrimaryWorkArea } from "../PrimaryWorkArea/PrimaryWorkArea";
import { StatusBar } from "../StatusBar/StatusBar";
import { CommandPalette } from "../CommandPalette/CommandPalette";
import { NotificationsCenter } from "../NotificationsCenter/NotificationsCenter";
import { useProject } from "@/hooks/useProject";
import { useActiveNav } from "@/stores/active-nav";
import { AgentLibraryView } from "@/views/agent-library/AgentLibraryView";
import { SkillLibraryView } from "@/views/skill-library/SkillLibraryView";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface HostShellProps {
  /**
   * Optional content injected into PrimaryWorkArea.
   * When provided (e.g. Storybook stories), bypasses the empty-state / project
   * branches and renders this content directly.
   * When omitted, the component reads useProject() and renders:
   *   - null project → empty-state placeholder
   *   - project open → Epic 03 placeholder (route rendering wires in Epic 03)
   */
  children?: React.ReactNode;

  /** Optional className applied to the root grid container. */
  className?: string;
}

// ─── HostShell ─────────────────────────────────────────────────────────────────

/**
 * HostShell — CSS Grid compositor for the six ux-spec §6.1 layout regions.
 *
 * Named export; no default export (matches LibraryShell + Story 2.9 convention).
 */
export function HostShell({ children, className }: HostShellProps): React.ReactElement {
  const project = useProject();
  const { activeItemId, setActiveItem } = useActiveNav();

  // ── Content area: what goes inside PrimaryWorkArea ──────────────────────────

  // If children are explicitly supplied (Storybook / testing), use them directly.
  // Otherwise derive from project state + active nav item.
  const primaryContent: React.ReactNode = React.useMemo(() => {
    if (children !== undefined) return children;

    if (project === null) {
      // AC #5 / Risk note: no functional picker exists in Sprint 2.
      // Render a centered placeholder only — Epic 03 wires the actual picker.
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "var(--space-2)",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--color-foreground)",
              margin: 0,
            }}
          >
            No project open
          </p>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-foreground-muted)",
              margin: 0,
            }}
          >
            Open a project to get started
          </p>
        </div>
      );
    }

    // Project is open — render the active library view if a nav item is selected.
    // Stories 6.2/6.3: Agents and Skills library views are wired here (Sprint 5).
    // Other nav item IDs fall through to the Epic 03 placeholder until those
    // views are shipped.
    if (activeItemId === "agents") {
      return <AgentLibraryView />;
    }

    if (activeItemId === "skills") {
      return <SkillLibraryView />;
    }

    // Fallback: Epic 03 placeholder — unmapped nav item or no item selected.
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--color-foreground-muted)",
          fontSize: "var(--text-sm)",
        }}
      >
        Project open — Epic 03 wires route rendering here.
      </div>
    );
  }, [children, project, activeItemId]);

  // ── Layout ────────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn("host-shell", className)}
      style={{
        display: "grid",
        gridTemplateAreas: `
          "title    title    title"
          "sidebar  content  inspector"
          "status   status   status"
        `,
        gridTemplateColumns: "240px 1fr 320px",
        gridTemplateRows: "auto 1fr 28px",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        background: "var(--color-background)",
      }}
    >
      {/* Title area */}
      <div style={{ gridArea: "title" }}>
        <TitleBar />
      </div>

      {/* Sidebar area */}
      <div
        style={{
          gridArea: "sidebar",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <Sidebar activeItemId={activeItemId ?? undefined} onItemSelect={setActiveItem} />
      </div>

      {/* Content column: TabStrip + PrimaryWorkArea */}
      <div
        style={{
          gridArea: "content",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <TabStrip />
        <PrimaryWorkArea>{primaryContent}</PrimaryWorkArea>
      </div>

      {/* Inspector area */}
      <div
        style={{
          gridArea: "inspector",
          overflow: "hidden",
          display: "flex",
        }}
      >
        {/* Story 2.8 MED carryover: 320px grid column - 24px toggle button = 296px pane */}
        <Inspector expandedWidth="296px" />
      </div>

      {/* Status area */}
      <div style={{ gridArea: "status" }}>
        <StatusBar pollIntervalMs={5000} />
      </div>

      {/* Portal overlays — render outside the grid so they don't affect layout flow.
          CommandPalette and NotificationsCenter portal via Radix Dialog and
          appear above all grid content. */}
      <CommandPalette />
      <NotificationsCenter />
    </div>
  );
}
