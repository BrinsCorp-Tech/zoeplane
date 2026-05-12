/**
 * ThemeProvider — ZoePlane theme management
 *
 * Responsibilities:
 *   1. Reads the user's stored preference from localStorage ("zoeplane:theme").
 *   2. Falls back to matchMedia("(prefers-color-scheme: dark)") when preference
 *      is "system" or absent.
 *   3. Writes `data-theme="light"|"dark"` on <html> to activate the correct
 *      token layer. Uses requestAnimationFrame to batch the DOM write and
 *      prevent forced-layout thrashing.
 *   4. Subscribes to OS theme changes via MediaQueryList.addEventListener
 *      so "system" preference updates live when the OS mode changes.
 *   5. Exposes useTheme() for any component that needs to read or toggle the theme.
 *
 * No theme branching in components:
 *   Components must NEVER read `theme` and return different JSX based on
 *   "light"/"dark". All theming is done via CSS custom properties and the
 *   [data-theme="dark"] attribute selector on <html>. useTheme() is only for
 *   UI controls that let the user explicitly change the preference (e.g., a
 *   toggle button in settings).
 *
 * FOUC prevention:
 *   An inline script in index.html runs synchronously before React mounts and
 *   sets data-theme based on localStorage + matchMedia. This provider then
 *   synchronises React state with that already-applied value on mount.
 *   useLayoutEffect applies the theme synchronously after DOM mutations but
 *   before the browser paints — covering mid-session changes and re-mounts.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ResolvedTheme, ThemePreference } from "@zoeplane/shared-types";

// ─── localStorage key ────────────────────────────────────────────────────────

const STORAGE_KEY = "zoeplane:theme";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read the stored preference; returns "system" if absent or invalid. */
function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage unavailable (sandboxed context)
  }
  return "system";
}

/** Resolve a preference to a concrete rendered theme. */
function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return preference;
}

/**
 * Apply data-theme to <html> inside a requestAnimationFrame to batch DOM writes
 * within a single frame and avoid forced-layout thrashing.
 *
 * The attribute is written immediately (before rAF resolves) by the inline
 * script in index.html on initial load. This function covers mid-session
 * changes, which can afford a single-frame delay without visible flicker.
 */
function applyThemeAttribute(theme: ResolvedTheme): void {
  requestAnimationFrame(() => {
    document.documentElement.setAttribute("data-theme", theme);
  });
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  /** The user's stored preference (may be "system"). */
  preference: ThemePreference;
  /** The currently rendered theme ("light" or "dark" — never "system"). */
  resolvedTheme: ResolvedTheme;
  /** Set the user preference and immediately apply the resolved theme. */
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.ReactElement {
  // Initialise synchronously from localStorage so state is consistent with
  // the inline script that already ran in index.html on initial load.
  const [preference, setPreferenceState] = useState<ThemePreference>(
    readStoredPreference,
  );

  // Counter bumped when the OS theme changes while preference is "system".
  // This forces a re-render so resolvedTheme recomputes from fresh matchMedia.
  const [osChangeCount, setOsChangeCount] = useState(0);

  // resolveTheme reads matchMedia live — recomputes whenever preference or
  // osChangeCount changes. osChangeCount is consumed via void below to force
  // re-renders without using it in the expression directly.
  const resolvedTheme = resolveTheme(preference);

  // Track the MediaQueryList + handler so we can clean up correctly.
  const mqlRef = useRef<MediaQueryList | null>(null);
  const mqlHandlerRef = useRef<((e: MediaQueryListEvent) => void) | null>(null);

  // useLayoutEffect: runs synchronously after DOM mutations, before the browser
  // paints. This is the authoritative application path for mid-session changes.
  useLayoutEffect(() => {
    applyThemeAttribute(resolvedTheme);
  }, [resolvedTheme]);

  // Subscribe to OS theme changes when preference is "system".
  // The cleanup correctly removes the listener on preference change or unmount.
  useEffect(() => {
    // Remove any existing listener before (re-)subscribing.
    if (mqlRef.current && mqlHandlerRef.current) {
      mqlRef.current.removeEventListener("change", mqlHandlerRef.current);
      mqlRef.current = null;
      mqlHandlerRef.current = null;
    }

    if (preference !== "system") {
      return;
    }

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (_e: MediaQueryListEvent): void => {
      // Bump the counter to force a re-render so resolvedTheme recomputes.
      // (setPreferenceState("system") won't trigger re-render — same state value.)
      setOsChangeCount((n) => n + 1);
    };

    mql.addEventListener("change", handler);
    mqlRef.current = mql;
    mqlHandlerRef.current = handler;

    return () => {
      mql.removeEventListener("change", handler);
    };
  }, [preference]);

  // Suppress unused variable warning for osChangeCount — it is read only to
  // ensure re-renders happen; the actual value is not used directly.
  void osChangeCount;

  const setPreference = useCallback((next: ThemePreference): void => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (sandboxed context)
    }
    setPreferenceState(next);
  }, []);

  const value: ThemeContextValue = {
    preference,
    resolvedTheme,
    setPreference,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useTheme() — access the current theme preference and resolved theme.
 *
 * Use this ONLY in UI controls that let the user explicitly change the theme
 * (e.g., a settings toggle). Do NOT use it to branch component JSX or styles
 * based on light/dark mode — use CSS custom properties and [data-theme="dark"]
 * selectors in CSS instead.
 *
 * Throws if called outside a ThemeProvider tree.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error("useTheme() must be called within a <ThemeProvider>.");
  }
  return ctx;
}
