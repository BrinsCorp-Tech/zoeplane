/**
 * StatusBar — structural accessibility tests (Story 2.9 AC #9)
 *
 * Validates:
 *   - role="contentinfo" with aria-label="Status bar"
 *   - Zero axe violations across project-open and no-project states
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *
 * Tauri invoke() is mocked — StatusBar calls invoke("sidecar_status") on mount.
 * Without a mock, JSDOM throws "Cannot read properties of undefined (reading 'invoke')".
 *
 * useAppStore._setProjectRoot is used to seed project state for the
 * "project open" variant.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/layout/StatusBar/__tests__/StatusBar.a11y.test.tsx
 */

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { StatusBar } from "../StatusBar";
import { useAppStore } from "@/stores/app";
import { useNotificationsStore } from "@/stores/notifications";

// ─── Mock Tauri invoke ────────────────────────────────────────────────────────
//
// @tauri-apps/api/core is not available in JSDOM. We mock the module so
// StatusBar can mount without crashing.

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({ running: true, pid: 1234, version: "1.0.0" }),
}));

// ─── Test setup ───────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  // Reset store to null project
  useAppStore.getState()._setProjectRoot(null);
  // Reset notifications store
  useNotificationsStore.getState().clearAll();
  useNotificationsStore.getState().closeCenter();
  vi.clearAllMocks();
});

beforeEach(() => {
  useAppStore.getState()._setProjectRoot(null);
  useNotificationsStore.getState().clearAll();
  useNotificationsStore.getState().closeCenter();
});

describe("StatusBar — structural accessibility (Story 2.9 AC #9)", () => {
  // ── contentinfo landmark ────────────────────────────────────────────────────

  describe("contentinfo landmark", () => {
    it('renders role="contentinfo" with aria-label="Status bar"', () => {
      render(<StatusBar pollIntervalMs={Infinity} />);
      expect(screen.getByRole("contentinfo", { name: "Status bar" })).toBeDefined();
    });
  });

  // ── No project open state ───────────────────────────────────────────────────

  describe("no project open (projectRoot === null)", () => {
    it("renders 'No project open' when no project is in store", () => {
      render(<StatusBar pollIntervalMs={Infinity} />);
      expect(screen.getByText("No project open")).toBeDefined();
    });

    it("renders cost placeholder '$0.00'", () => {
      render(<StatusBar pollIntervalMs={Infinity} />);
      expect(screen.getByText("$0.00")).toBeDefined();
    });

    it("renders task count placeholder '0 active tasks'", () => {
      render(<StatusBar pollIntervalMs={Infinity} />);
      expect(screen.getByText("0 active tasks")).toBeDefined();
    });
  });

  // ── Project open state ──────────────────────────────────────────────────────

  describe("project open (projectRoot set in store)", () => {
    it("renders project path when projectRoot is set", () => {
      useAppStore.getState()._setProjectRoot("/Users/zeke/Projects/MyApp");
      render(<StatusBar pollIntervalMs={Infinity} />);
      // Path is ≤ 50 chars, no truncation needed
      expect(screen.getByText("/Users/zeke/Projects/MyApp")).toBeDefined();
    });

    it("truncates long project paths with middle-ellipsis", () => {
      useAppStore
        .getState()
        ._setProjectRoot(
          "/Users/zeke/Documents/VeryLong/Path/That/Exceeds/FiftyCharacters/ProjectName",
        );
      render(<StatusBar pollIntervalMs={Infinity} />);
      // Should NOT show full path; should contain ellipsis
      const statusBar = screen.getByRole("contentinfo");
      expect(statusBar.textContent).toContain("…");
    });
  });

  // ── Bell button (Story 2.10) ────────────────────────────────────────────────

  describe("bell button — notifications toggle (Story 2.10 AC #5)", () => {
    it('renders bell button with aria-label="Toggle notifications"', () => {
      render(<StatusBar pollIntervalMs={Infinity} />);
      expect(screen.getByRole("button", { name: "Toggle notifications" })).toBeDefined();
    });

    it("bell button has aria-pressed=false when center is closed", () => {
      useNotificationsStore.getState().closeCenter();
      render(<StatusBar pollIntervalMs={Infinity} />);
      const bell = screen.getByRole("button", { name: "Toggle notifications" });
      expect(bell.getAttribute("aria-pressed")).toBe("false");
    });

    it("bell button has aria-pressed=true when center is open", () => {
      useNotificationsStore.getState().openCenter();
      render(<StatusBar pollIntervalMs={Infinity} />);
      const bell = screen.getByRole("button", { name: "Toggle notifications" });
      expect(bell.getAttribute("aria-pressed")).toBe("true");
    });

    it("does NOT render unread badge when unreadCount is 0", () => {
      render(<StatusBar pollIntervalMs={Infinity} />);
      // Badge spans have aria-label="N unread notifications" — none should exist
      expect(screen.queryByRole("generic", { name: /unread notifications/ })).toBeNull();
    });

    it("renders unread badge with count when notifications are unread", () => {
      useNotificationsStore.getState().addEntry("info", "Test notification");
      useNotificationsStore.getState().addEntry("error", "Error notification");
      render(<StatusBar pollIntervalMs={Infinity} />);
      expect(screen.getByLabelText("2 unread notifications")).toBeDefined();
    });

    it("calls toggleCenter when bell button is clicked", () => {
      useNotificationsStore.getState().closeCenter();
      render(<StatusBar pollIntervalMs={Infinity} />);
      fireEvent.click(screen.getByRole("button", { name: "Toggle notifications" }));
      expect(useNotificationsStore.getState().centerOpen).toBe(true);
    });
  });

  // ── axe-core structural scans ───────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — no project open", async () => {
      const { container } = render(<StatusBar pollIntervalMs={Infinity} />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — project open", async () => {
      useAppStore.getState()._setProjectRoot("/Users/zeke/Projects/App");
      const { container } = render(<StatusBar pollIntervalMs={Infinity} />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
