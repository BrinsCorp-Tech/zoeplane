// ZoePlane — command palette Zustand store (Story 2.10)
//
// Maintains the registry of available command actions and the open/closed
// state of the CommandPalette overlay. Components and features register
// actions on mount and deregister on unmount via the returned cleanup fn.
//
// React.ReactNode is used for icon typing (import from react, not react-dom).

import type * as React from "react";
import { create } from "zustand";

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * A single command action registered in the command palette.
 *
 * Actions are rendered as list rows; label + optional icon + optional shortcut
 * hint. Fuzzy matching runs against label and keywords.
 */
export interface CommandAction {
  /** Unique identifier for this action — used for deregistration. */
  id: string;
  /** Human-readable label displayed in the palette row. */
  label: string;
  /**
   * Additional keywords for fuzzy matching.
   * The label is always matched; keywords extend the searchable surface.
   */
  keywords?: string[];
  /** Optional Lucide or custom icon rendered at the start of the row. */
  icon?: React.ReactNode;
  /** Optional keyboard shortcut hint displayed at the end of the row (e.g. "⌘K"). */
  shortcut?: string;
  /** Called when the user selects this action via Enter or pointer. */
  perform: () => void;
}

// ─── Store interface ────────────────────────────────────────────────────────────

interface CommandPaletteState {
  // ── State ───────────────────────────────────────────────────────────────────

  /** All currently registered command actions. */
  actions: CommandAction[];

  /** Whether the CommandPalette overlay is currently open. */
  open: boolean;

  // ── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Register a command action.
   *
   * If an action with the same id already exists, the existing entry is
   * replaced (idempotent for hot-reload scenarios).
   *
   * Returns an unregister function — call it on component unmount.
   *
   * @param action  The command action descriptor to register
   * @returns       Cleanup function that removes this action from the registry
   */
  register: (action: CommandAction) => () => void;

  /**
   * Deregister a command action by id.
   * No-op if the action does not exist.
   */
  unregister: (id: string) => void;

  /**
   * Set the open state of the CommandPalette explicitly.
   * Prefer toggle() for keyboard-shortcut triggers.
   */
  setOpen: (open: boolean) => void;

  /** Toggle the CommandPalette open/closed. */
  toggle: () => void;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useCommandPaletteStore = create<CommandPaletteState>()((set, get) => ({
  // ── Initial state ───────────────────────────────────────────────────────────

  actions: [],
  open: false,

  // ── Actions ─────────────────────────────────────────────────────────────────

  register: (action) => {
    set((state) => {
      // Replace existing entry if id already registered (hot-reload safety)
      const filtered = state.actions.filter((a) => a.id !== action.id);
      return { actions: [...filtered, action] };
    });
    // Return the cleanup function
    return () => get().unregister(action.id);
  },

  unregister: (id) => {
    set((state) => ({
      actions: state.actions.filter((a) => a.id !== id),
    }));
  },

  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}));
