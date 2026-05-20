// ZoePlane — active navigation Zustand store (Sprint 5, Epic 06 wiring)
//
// Minimal slice for tracking the currently selected Sidebar nav item.
// Consumed by HostShell to route the PrimaryWorkArea to the correct library view.
//
// Pattern mirrors commandPalette.ts (Zustand 5.x double-call curried form).

import { create } from "zustand";

// ─── Types ─────────────────────────────────────────────────────────────────────

type NavItemId = string;

interface ActiveNavState {
  // ── State ───────────────────────────────────────────────────────────────────

  /** ID of the currently active sidebar nav item. Null when nothing is selected. */
  activeItemId: NavItemId | null;

  // ── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Set the active nav item by id.
   * Pass null to deselect all items (return to project-context placeholder).
   */
  setActiveItem: (id: NavItemId | null) => void;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useActiveNav = create<ActiveNavState>()((set) => ({
  // ── Initial state ───────────────────────────────────────────────────────────

  activeItemId: null,

  // ── Actions ─────────────────────────────────────────────────────────────────

  setActiveItem: (id) => set({ activeItemId: id }),
}));
