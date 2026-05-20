/**
 * skill-nav — sub-navigation state for the Skills section.
 *
 * Controls which view is active within the Skills primary content area:
 *   - library  : SkillLibraryView (default)
 *   - detail   : SkillDetailView (reading a skill)
 *   - editor   : SkillEditorView (editing a skill)
 *
 * Known limitation (Story 6.5 scope): sidebar-switch-while-dirty intercept
 * guard is NOT implemented here. If the user switches sidebar tabs while in
 * editor mode with unsaved changes, the dirty state will be lost silently.
 * That guard is deferred to Story 6.5.
 *
 * Story: 6.4 — Skill Detail + Skill Editor (FR-003, FR-004)
 */

import { create } from "zustand";

export type SkillNavMode = "library" | "detail" | "editor";

export interface SkillNavState {
  /** ID of the currently selected skill, or null when in library mode. */
  selectedSkillId: string | null;
  /** Active sub-navigation mode within the Skills section. */
  mode: SkillNavMode;
  /** Open a skill's detail view by ID. */
  open: (skillId: string) => void;
  /** Transition from detail → editor (no-op if no skill is selected). */
  edit: () => void;
  /**
   * Navigate back one level:
   *   editor → detail (skill stays selected)
   *   detail → library (clears selection)
   */
  back: () => void;
  /** Return to library and clear selection. */
  close: () => void;
  /** Directly set the selected skill ID (used during editor load). */
  setSelected: (id: string | null) => void;
  /** Directly set the navigation mode (used after save completes). */
  setMode: (mode: SkillNavMode) => void;
}

export const useSkillNav = create<SkillNavState>()((set, get) => ({
  selectedSkillId: null,
  mode: "library",

  open: (skillId) => {
    set({ selectedSkillId: skillId, mode: "detail" });
  },

  edit: () => {
    if (get().selectedSkillId !== null) {
      set({ mode: "editor" });
    }
  },

  back: () => {
    const { mode } = get();
    if (mode === "editor") {
      set({ mode: "detail" });
    } else if (mode === "detail") {
      set({ mode: "library", selectedSkillId: null });
    }
  },

  close: () => {
    set({ mode: "library", selectedSkillId: null });
  },

  setSelected: (id) => {
    set({ selectedSkillId: id });
  },

  setMode: (mode) => {
    set({ mode });
  },
}));
