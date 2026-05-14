/**
 * useCommandPalette — read-only convenience hook for the command palette store.
 *
 * Provides access to the command action registry and palette open state.
 * Components use this hook to register actions on mount (via register())
 * and clean up on unmount (via the returned unregister function).
 *
 * Usage — registering a command:
 *   const { register } = useCommandPalette();
 *   useEffect(() => {
 *     const unregister = register({
 *       id: "open-settings",
 *       label: "Open Settings",
 *       keywords: ["preferences", "config"],
 *       shortcut: "⌘,",
 *       perform: () => navigate("/settings"),
 *     });
 *     return unregister;
 *   }, [register]);
 *
 * Usage — controlling open state:
 *   const { open, toggle } = useCommandPalette();
 *
 * @see src/stores/commandPalette.ts
 * @see src/components/layout/CommandPalette/CommandPalette.tsx
 */

import { useCommandPaletteStore } from "../stores/commandPalette";

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useCommandPalette — convenience accessor over useCommandPaletteStore.
 *
 * All fields are directly from the store; this hook exists so consumers
 * have a single, stable import rather than importing the store directly.
 */
export function useCommandPalette() {
  const store = useCommandPaletteStore();

  return {
    // ── Registry ──────────────────────────────────────────────────────────────

    /**
     * All currently registered command actions.
     * Rendered by CommandPalette — do not mutate directly.
     */
    actions: store.actions,

    /**
     * Register a command action.
     * Returns a cleanup function; call it from useEffect's return.
     */
    register: store.register,

    /**
     * Deregister a command action by id.
     * Prefer the cleanup function returned by register().
     */
    unregister: store.unregister,

    // ── Open state ────────────────────────────────────────────────────────────

    /** Whether the CommandPalette overlay is currently open. */
    open: store.open,

    /**
     * Set the open state explicitly.
     * Prefer toggle() for keyboard-shortcut triggers.
     */
    setOpen: store.setOpen,

    /** Toggle the CommandPalette open/closed. */
    toggle: store.toggle,
  };
}
