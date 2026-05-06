// ZoePlane — LibraryShell
//
// Cross-library primitive — the single component consumed by ALL six resource
// library views (Skills, Agents, Commands, Hooks, Teams, Workflows).
//
// Per PRD §1.10 v2.3 (cards-canonical principle) and ux-spec §1 Principle 6:
// every Library uses one unified list/detail layout pattern — the card grid.
// Mixing layouts (cards for skills, rows for hooks) breaks cross-library scanning.
// LibraryShell enforces this constraint architecturally.
//
// SPRINT DELIVERABLE: This file is the Epic 02 Sprint 2 deliverable.
//   - Sprint 1 (this scaffold): file exists with TODO — unblocks Epic 02 Sprint 2 work.
//   - Sprint 2 (Epic 02): implement filter affordance, search, scope tabs, card grid
//     container, empty state, loading skeleton, error state.
//   - Sprint 3+ (Epic 06): SkillCard, AgentCard, CommandCard slot in as children.
//
// TODO (Epic 02 Sprint 2): implement the following per ux-spec §8.2 LibraryShell spec:
//   - Filter chip bar (scope tabs: Global / Project / Local; per ux-spec §6.2)
//   - Search input with debounced filter (ux-spec §7.5 search affordance)
//   - Card grid container: `display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))`
//     (240px is the canonical card width per ux-spec §1 Principle 6 and §7.5)
//   - Loading skeleton: skeleton card grid matching final layout (prevents CLS — ux-spec §3.1 C2)
//   - Empty state: "No {resourceName} found" with icon + CTA per ux-spec empty-state pattern
//   - Error state: error message + retry CTA
//   - List-toggle (Cards | List view-mode): DEFERRED to v1.x per architect Phase 3 review,
//     2026-05-06 PM. Cards-only in v1. Pattern specced in ux-spec §7.8.7 v1.4.
//
// See ux-spec §8.9 Sprint 2 deliverables for the full acceptance criteria.

import React from "react";

interface LibraryShellProps {
  /** The resource noun (singular) for empty state copy — e.g., "skill", "hook" */
  resourceName: string;
  children?: React.ReactNode;
}

/**
 * LibraryShell — cross-library card grid container.
 *
 * TODO (Epic 02 Sprint 2): full implementation per ux-spec §8.2.
 * Current stub renders children in a basic flex container.
 */
export function LibraryShell({ resourceName, children }: LibraryShellProps): React.ReactElement {
  return (
    <div
      role="region"
      aria-label={`${resourceName} library`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        // TODO (Sprint 2): replace with grid once filter bar + card grid implemented
      }}
    >
      {/* TODO (Sprint 2): <FilterChipBar /> + <SearchInput /> */}
      {/* TODO (Sprint 2): <CardGrid> wrapping {children} </CardGrid> */}
      {children ?? (
        <div
          role="status"
          style={{ color: "var(--color-foreground-subtle)", fontSize: "var(--text-sm)" }}
        >
          {/* TODO (Sprint 2): replace with proper EmptyState component */}
          No {resourceName}s yet.
        </div>
      )}
    </div>
  );
}

export default LibraryShell;
