// ZoePlane — app-level Zustand store
//
// Story 1.1: provides the root Zustand store required by AC #2.
// Story 2.9: adds projectRoot slice (architect contract 2026-05-14)
//            and TabStrip slice.
// Domain slices (theme, agent state, etc.) are added in later epics.

import { create } from "zustand";

// ─── Tab descriptor ────────────────────────────────────────────────────────────
//
// Defined here in Sprint 2; Epic 03 will likely refactor into a dedicated
// slice or feature module once real tab content is wired.

/** Minimal descriptor for an open editor/view tab. */
export interface TabDescriptor {
  id: string;
  title: string;
}

// ─── App state ─────────────────────────────────────────────────────────────────

interface AppState {
  // ── Shell readiness ─────────────────────────────────────────────────────────

  /** Whether the app shell has fully initialised. */
  ready: boolean;
  setReady: (ready: boolean) => void;

  // ── Project context (Sprint 2 — Story 2.9) ──────────────────────────────────
  //
  // Read via useProject() hook — returns ProjectContext | null.
  // _setProjectRoot is intentionally private (underscore prefix convention):
  // Sprint 2 has no runtime mutator. Epic 03 owns the project:open event
  // handler that will call this setter when a project is opened/closed.

  /** Absolute path of the currently open project. Null when no project is open. */
  projectRoot: string | null;

  /**
   * Private setter — intentionally not exposed through useProject().
   * Epic 03 runtime event handler will call this via the store directly.
   * @private
   */
  _setProjectRoot: (projectRoot: string | null) => void;

  // ── Tab strip (Sprint 2 — Story 2.9) ────────────────────────────────────────

  /** Currently open tabs. */
  tabs: TabDescriptor[];

  /** ID of the currently active tab. Null when no tabs are open. */
  activeTabId: string | null;

  /** Open a new tab. Does nothing if a tab with this id already exists. */
  addTab: (tab: TabDescriptor) => void;

  /** Close a tab by id. Adjusts activeTabId if the closed tab was active. */
  removeTab: (id: string) => void;

  /** Set the active tab by id. */
  selectTab: (id: string) => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  // ── Shell readiness ─────────────────────────────────────────────────────────

  ready: false,
  setReady: (ready) => set({ ready }),

  // ── Project context ─────────────────────────────────────────────────────────

  projectRoot: null,
  _setProjectRoot: (projectRoot) => set({ projectRoot }),

  // ── Tab strip ───────────────────────────────────────────────────────────────

  tabs: [],
  activeTabId: null,

  addTab: (tab) => {
    const { tabs } = get();
    if (tabs.find((t) => t.id === tab.id)) return;
    set({ tabs: [...tabs, tab], activeTabId: tab.id });
  },

  removeTab: (id) => {
    const { tabs, activeTabId } = get();
    const remaining = tabs.filter((t) => t.id !== id);
    let nextActive = activeTabId;

    if (activeTabId === id) {
      // Select the tab to the left, or the first remaining tab, or null.
      const idx = tabs.findIndex((t) => t.id === id);
      if (remaining.length === 0) {
        nextActive = null;
      } else {
        nextActive = remaining[Math.max(0, idx - 1)].id;
      }
    }

    set({ tabs: remaining, activeTabId: nextActive });
  },

  selectTab: (id) => {
    set({ activeTabId: id });
  },
}));
