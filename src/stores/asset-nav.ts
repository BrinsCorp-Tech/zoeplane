/**
 * asset-nav — sub-navigation state for the Skills and Agents sections.
 *
 * Controls which view is active within the asset primary content area:
 *   - library  : SkillLibraryView / AgentLibraryView (default)
 *   - detail   : AssetDetailView (reading an asset)
 *   - editor   : AssetEditorView (editing an asset)
 *
 * Dirty-state is tracked per-kind per-path so that switching between an open
 * skill and an open agent does not collide their dirty-state flags (AC #4).
 * Key shape: `${AssetKind}:${canonicalPath}` (e.g. `skill:/Users/...`)
 *
 * Known limitation (Story 6.5 scope): sidebar-switch-while-dirty intercept
 * guard is NOT implemented here. If the user switches sidebar tabs while in
 * editor mode with unsaved changes, the dirty state will be lost silently.
 * That guard is deferred to Story 6.5.
 *
 * Story: 6.16 — Asset Detail+Editor Kind-Parameterized Refactor (FR-003, FR-004)
 */

import { create } from "zustand";

export type AssetKind = "skill" | "agent" | "command";
export type AssetNavMode = "library" | "detail" | "editor";

/** Dirty-state key shape: `${kind}:${canonicalPath}` */
type DirtyKey = `${AssetKind}:${string}`;

export interface AssetNavState {
  /** Kind of the currently selected asset. */
  kind: AssetKind;
  /** ID of the currently selected asset, or null when in library mode. */
  selectedAssetId: string | null;
  /** Active sub-navigation mode within the asset section. */
  mode: AssetNavMode;
  /**
   * Dirty-state flags, keyed by `${kind}:${canonicalPath}`.
   * Isolates dirty state per-asset so switching between a skill and an agent
   * does not reset or collide their independent dirty flags.
   */
  dirtyByKey: Partial<Record<DirtyKey, boolean>>;

  /** Open an asset's detail view. */
  open: (kind: AssetKind, assetId: string) => void;
  /** Transition from detail → editor (no-op if no asset is selected). */
  edit: () => void;
  /**
   * Navigate back one level:
   *   editor → detail (asset stays selected)
   *   detail → library (clears selection)
   */
  back: () => void;
  /** Return to library and clear selection. */
  close: () => void;
  /** Directly set the selected asset ID (used during editor load). */
  setSelected: (id: string | null) => void;
  /** Directly set the navigation mode (used after save completes). */
  setMode: (mode: AssetNavMode) => void;
  /** Update the dirty flag for a specific asset key. */
  setDirty: (key: DirtyKey, dirty: boolean) => void;
  /** Clear the dirty flag for a specific asset key. */
  clearDirty: (key: DirtyKey) => void;
}

export const useAssetNav = create<AssetNavState>()((set, get) => ({
  kind: "skill",
  selectedAssetId: null,
  mode: "library",
  dirtyByKey: {},

  open: (kind, assetId) => {
    set({ kind, selectedAssetId: assetId, mode: "detail" });
  },

  edit: () => {
    if (get().selectedAssetId !== null) {
      set({ mode: "editor" });
    }
  },

  back: () => {
    const { mode } = get();
    if (mode === "editor") {
      set({ mode: "detail" });
    } else if (mode === "detail") {
      set({ mode: "library", selectedAssetId: null });
    }
  },

  close: () => {
    set({ mode: "library", selectedAssetId: null });
  },

  setSelected: (id) => {
    set({ selectedAssetId: id });
  },

  setMode: (mode) => {
    set({ mode });
  },

  setDirty: (key, dirty) => {
    set((state) => ({
      dirtyByKey: { ...state.dirtyByKey, [key]: dirty },
    }));
  },

  clearDirty: (key) => {
    set((state) => {
      const next = { ...state.dirtyByKey };
      delete next[key];
      return { dirtyByKey: next };
    });
  },
}));
