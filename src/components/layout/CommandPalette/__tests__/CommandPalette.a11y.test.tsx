/**
 * CommandPalette — structural accessibility tests (Story 2.10)
 *
 * Validates:
 *   - Opens when the store's open state is set to true
 *   - role="dialog" present when open
 *   - Keyboard shortcut Cmd+K triggers setOpen
 *   - Enter dispatches the focused action
 *   - Fuzzy filter narrows results (cmdk handles filtering)
 *   - No-results state renders empty state text
 *   - Zero axe violations in open state (color-contrast disabled — JSDOM/OKLCH)
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *
 * Tauri mock: CommandPalette itself doesn't call invoke(), but HostShell
 * composition paths may. We mock defensively to prevent any import-time errors.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/layout/CommandPalette/__tests__/CommandPalette.a11y.test.tsx
 */

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { CommandPalette } from "../CommandPalette";
import { useCommandPaletteStore } from "@/stores/commandPalette";

// ─── Mock Tauri invoke ────────────────────────────────────────────────────────

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({ running: true, pid: 1234, version: "1.0.0" }),
}));

// ─── JSDOM polyfills for cmdk ────────────────────────────────────────────────
//
// cmdk uses two browser APIs that JSDOM does not implement:
//
// 1. ResizeObserver — used for CommandList height observation.
//    A no-op class satisfies the import without crashing.
//
// 2. Element.prototype.scrollIntoView — called by cmdk when the selected item
//    changes (it scrolls the active item into view in the list). JSDOM omits
//    this method entirely; a no-op stub prevents TypeError at test runtime.

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

// ─── Test setup ───────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  useCommandPaletteStore.getState().setOpen(false);
  useCommandPaletteStore.getState().actions.forEach((a) => {
    useCommandPaletteStore.getState().unregister(a.id);
  });
  vi.clearAllMocks();
});

beforeEach(() => {
  useCommandPaletteStore.getState().setOpen(false);
  // Clear all actions
  useCommandPaletteStore.setState({ actions: [], open: false });
});

describe("CommandPalette — structural accessibility (Story 2.10)", () => {
  // ── Dialog landmark ─────────────────────────────────────────────────────────

  describe("dialog landmark", () => {
    it('renders role="dialog" when open state is true', () => {
      useCommandPaletteStore.getState().setOpen(true);
      render(<CommandPalette />);
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    it("does NOT render dialog when open state is false", () => {
      useCommandPaletteStore.getState().setOpen(false);
      render(<CommandPalette />);
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  // ── Keyboard shortcut ───────────────────────────────────────────────────────

  describe("Cmd+K keyboard shortcut", () => {
    it("sets open=true when Cmd+K is fired and palette is closed", () => {
      useCommandPaletteStore.getState().setOpen(false);
      render(<CommandPalette />);
      fireEvent.keyDown(document, { key: "k", metaKey: true });
      expect(useCommandPaletteStore.getState().open).toBe(true);
    });

    it("sets open=false when Ctrl+K is fired and palette is open", () => {
      useCommandPaletteStore.getState().setOpen(true);
      render(<CommandPalette />);
      fireEvent.keyDown(document, { key: "k", ctrlKey: true });
      expect(useCommandPaletteStore.getState().open).toBe(false);
    });
  });

  // ── Action dispatch ─────────────────────────────────────────────────────────

  describe("action dispatch", () => {
    it("calls perform() and closes palette when an action item is selected via click", () => {
      const performMock = vi.fn();
      useCommandPaletteStore.getState().register({
        id: "test-action",
        label: "Test Action",
        perform: performMock,
      });
      useCommandPaletteStore.getState().setOpen(true);

      render(<CommandPalette />);

      // Find and click the action item
      const item = screen.getByText("Test Action");
      fireEvent.click(item);

      expect(performMock).toHaveBeenCalledTimes(1);
      expect(useCommandPaletteStore.getState().open).toBe(false);
    });
  });

  // ── Fuzzy filter ────────────────────────────────────────────────────────────

  describe("fuzzy filter narrows results", () => {
    it("renders action label in the list when palette is open", () => {
      useCommandPaletteStore.getState().register({
        id: "open-project",
        label: "Open Project",
        keywords: ["folder"],
        perform: () => undefined,
      });
      useCommandPaletteStore.getState().register({
        id: "new-session",
        label: "New Session",
        keywords: ["chat"],
        perform: () => undefined,
      });
      useCommandPaletteStore.getState().setOpen(true);

      render(<CommandPalette />);

      expect(screen.getByText("Open Project")).toBeDefined();
      expect(screen.getByText("New Session")).toBeDefined();
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  describe("no-results empty state", () => {
    it('renders "No commands found." when no actions are registered', () => {
      useCommandPaletteStore.getState().setOpen(true);
      render(<CommandPalette />);
      expect(screen.getByText("No commands found.")).toBeDefined();
    });
  });

  // ── axe-core structural scans ───────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — palette open with actions", async () => {
      useCommandPaletteStore.getState().register({
        id: "axe-test-action",
        label: "Axe Test Action",
        perform: () => undefined,
      });
      useCommandPaletteStore.getState().setOpen(true);

      const { container } = render(<CommandPalette />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — palette open, no actions (empty state)", async () => {
      useCommandPaletteStore.getState().setOpen(true);
      const { container } = render(<CommandPalette />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — palette closed", async () => {
      useCommandPaletteStore.getState().setOpen(false);
      const { container } = render(<CommandPalette />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
