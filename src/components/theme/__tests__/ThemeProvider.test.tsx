/**
 * AC8 — ThemeProvider structural accessibility (axe-core harness)
 *
 * Mounts ThemeProvider under both themes via JSDOM + @testing-library/react
 * and asserts zero structural a11y violations with axe-core.
 *
 * JSDOM limitation — OKLCH contrast values:
 *   JSDOM cannot compute OKLCH colour values; getComputedStyle returns empty
 *   strings for CSS custom properties that reference OKLCH tokens. Therefore:
 *   - axe-core's color-contrast rule will NOT reliably fire for our token pairs.
 *   - This harness validates STRUCTURAL accessibility only:
 *       • ARIA roles and attributes are valid
 *       • Interactive elements have accessible names
 *       • Document structure is sound
 *   - Token-pair contrast ratio verification (WCAG 1.4.3 AA) is a Story 2.13
 *     deliverable that requires a real browser with CSS rendering.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/theme/__tests__/ThemeProvider.test.tsx
 */

import axe from "axe-core";
import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "../ThemeProvider";

// ─── Mocks ────────────────────────────────────────────────────────────────────

/**
 * Vitest's JSDOM environment replaces window.localStorage with a minimal stub
 * that omits .clear() and .removeItem() (Vitest ≥2.x with --localstorage-file).
 * We stub the entire global with a Map-backed implementation to control state.
 */
function makeLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => [...store.keys()][i] ?? null,
  };
}

let localStorageStub: Storage;

beforeEach(() => {
  // Provide a full localStorage implementation — Vitest's JSDOM stub is incomplete.
  localStorageStub = makeLocalStorageMock();
  vi.stubGlobal("localStorage", localStorageStub);

  // Mock matchMedia — JSDOM does not implement it.
  // Default: OS preference is light (matches: false for dark query).
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? false : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock requestAnimationFrame — JSDOM provides a stub but we want synchronous
  // execution in tests so DOM mutations are observable immediately after render.
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(
    (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // Clean up any data-theme attribute left on <html> from the test.
  document.documentElement.removeAttribute("data-theme");
});

// ─── Helper component ─────────────────────────────────────────────────────────

/** A minimal consumer that uses useTheme() — exercises the context path. */
function ThemeConsumer(): React.ReactElement {
  const { preference, resolvedTheme } = useTheme();
  return (
    <div
      role="status"
      aria-label="Theme indicator"
      data-preference={preference}
      data-resolved={resolvedTheme}
    >
      Theme: {resolvedTheme}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Run axe-core against the rendered container.
 * Disables color-contrast rule because JSDOM cannot compute OKLCH values.
 * See the module-level JSDoc for the full rationale.
 */
async function runAxe(container: HTMLElement): Promise<axe.AxeResults> {
  return new Promise((resolve, reject) => {
    axe.run(
      container,
      {
        rules: {
          // Disabled: JSDOM cannot compute OKLCH CSS custom property values,
          // so colour contrast results would be false positives.
          // Verified in-browser as Story 2.13 deliverable.
          "color-contrast": { enabled: false },
        },
      },
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      },
    );
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ThemeProvider — structural accessibility (AC8)", () => {
  it("has zero axe violations when rendered in light mode", async () => {
    localStorage.setItem("zoeplane:theme", "light");

    let container!: HTMLElement;
    await act(async () => {
      const result = render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>,
      );
      container = result.container;
    });

    const results = await runAxe(container);
    expect(
      results.violations,
      `Light mode: ${results.violations.map((v) => `${v.id}: ${v.description}`).join("; ")}`,
    ).toHaveLength(0);
  });

  it("has zero axe violations when rendered in dark mode", async () => {
    localStorage.setItem("zoeplane:theme", "dark");

    // Update matchMedia mock to report dark OS preference.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)" ? true : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    let container!: HTMLElement;
    await act(async () => {
      const result = render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>,
      );
      container = result.container;
    });

    const results = await runAxe(container);
    expect(
      results.violations,
      `Dark mode: ${results.violations.map((v) => `${v.id}: ${v.description}`).join("; ")}`,
    ).toHaveLength(0);
  });

  it("sets data-theme on <html> based on stored preference", async () => {
    localStorage.setItem("zoeplane:theme", "dark");

    await act(async () => {
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>,
      );
    });

    // useLayoutEffect + mocked synchronous rAF → data-theme should be applied.
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("throws when useTheme() is called outside ThemeProvider", () => {
    // Suppress React's error boundary console output for this test.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      render(<ThemeConsumer />),
    ).toThrow("useTheme() must be called within a <ThemeProvider>.");

    consoleError.mockRestore();
  });
});
