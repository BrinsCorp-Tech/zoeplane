/**
 * NotificationsCenter — structural accessibility tests (Story 2.10)
 *
 * Validates:
 *   - Panel opens when store centerOpen = true (role="dialog" present)
 *   - Cmd+Shift+N keyboard shortcut toggles center open state
 *   - Mark-read button updates entry read state
 *   - Clear-all empties entries
 *   - Filter chip toggles category filter (aria-pressed)
 *   - role/aria-label assertions
 *   - Zero axe violations (color-contrast disabled — JSDOM/OKLCH)
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *
 * Tauri mock: NotificationsCenter doesn't call invoke() directly. We mock
 * defensively for HostShell composition paths.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/layout/NotificationsCenter/__tests__/NotificationsCenter.a11y.test.tsx
 */

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { NotificationsCenter } from "../NotificationsCenter";
import { useNotificationsStore } from "@/stores/notifications";

// ─── Mock Tauri invoke ────────────────────────────────────────────────────────

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({ running: true, pid: 1234, version: "1.0.0" }),
}));

// ─── Test setup ───────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  useNotificationsStore.getState().clearAll();
  useNotificationsStore.getState().closeCenter();
  vi.clearAllMocks();
});

beforeEach(() => {
  useNotificationsStore.getState().clearAll();
  useNotificationsStore.getState().closeCenter();
});

describe("NotificationsCenter — structural accessibility (Story 2.10)", () => {
  // ── Dialog landmark ─────────────────────────────────────────────────────────

  describe("dialog landmark", () => {
    it('renders role="dialog" when open (labeled by ModalTitle)', () => {
      useNotificationsStore.getState().openCenter();
      render(<NotificationsCenter />);
      // Dialog is labeled by ModalTitle (aria-labelledby); accessible name = "Notifications"
      expect(screen.getByRole("dialog")).toBeDefined();
      // Verify aria-label is also present on the element
      const dialog = screen.getByRole("dialog");
      expect(dialog.getAttribute("aria-label")).toBe("Notifications panel");
    });

    it("does NOT render dialog when centerOpen is false", () => {
      useNotificationsStore.getState().closeCenter();
      render(<NotificationsCenter />);
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  // ── Keyboard shortcut ───────────────────────────────────────────────────────

  describe("Cmd+Shift+N keyboard shortcut", () => {
    it("opens the center when Cmd+Shift+N is fired and center is closed", () => {
      useNotificationsStore.getState().closeCenter();
      render(<NotificationsCenter />);
      fireEvent.keyDown(document, { key: "n", metaKey: true, shiftKey: true });
      expect(useNotificationsStore.getState().centerOpen).toBe(true);
    });

    it("closes the center when Ctrl+Shift+N is fired and center is open", () => {
      useNotificationsStore.getState().openCenter();
      render(<NotificationsCenter />);
      fireEvent.keyDown(document, { key: "n", ctrlKey: true, shiftKey: true });
      expect(useNotificationsStore.getState().centerOpen).toBe(false);
    });
  });

  // ── Mark read ───────────────────────────────────────────────────────────────

  describe("mark-read interaction", () => {
    it("marks an entry as read when the mark-read button is clicked", () => {
      useNotificationsStore.getState().addEntry("info", "Test notification");
      const entryId = useNotificationsStore.getState().entries[0].id;
      expect(useNotificationsStore.getState().entries[0].read).toBe(false);

      useNotificationsStore.getState().openCenter();
      render(<NotificationsCenter />);

      const markReadBtn = screen.getByRole("button", {
        name: /Mark "Test notification" as read/,
      });
      fireEvent.click(markReadBtn);

      expect(useNotificationsStore.getState().entries.find((e) => e.id === entryId)?.read).toBe(
        true,
      );
    });

    it("decrements unreadCount when an entry is marked read", () => {
      useNotificationsStore.getState().addEntry("warning", "Warning notification");
      expect(useNotificationsStore.getState().unreadCount).toBe(1);

      useNotificationsStore.getState().openCenter();
      render(<NotificationsCenter />);

      fireEvent.click(screen.getByRole("button", { name: /Mark "Warning notification" as read/ }));

      expect(useNotificationsStore.getState().unreadCount).toBe(0);
    });
  });

  // ── Clear all ───────────────────────────────────────────────────────────────

  describe("clear all interaction", () => {
    it("removes all entries when clear-all is clicked", () => {
      useNotificationsStore.getState().addEntry("info", "Notification 1");
      useNotificationsStore.getState().addEntry("error", "Notification 2");
      expect(useNotificationsStore.getState().entries).toHaveLength(2);

      useNotificationsStore.getState().openCenter();
      render(<NotificationsCenter />);

      fireEvent.click(screen.getByRole("button", { name: "Clear all notifications" }));

      expect(useNotificationsStore.getState().entries).toHaveLength(0);
      expect(useNotificationsStore.getState().unreadCount).toBe(0);
    });
  });

  // ── Filter chip ─────────────────────────────────────────────────────────────

  describe("category filter chips", () => {
    it("renders All filter chip with aria-pressed=true initially", () => {
      useNotificationsStore.getState().openCenter();
      render(<NotificationsCenter />);
      const allChip = screen.getByRole("button", { name: "Filter: all" });
      expect(allChip.getAttribute("aria-pressed")).toBe("true");
    });

    it("sets Info filter chip to aria-pressed=true when clicked", () => {
      useNotificationsStore.getState().addEntry("info", "Info entry");
      useNotificationsStore.getState().openCenter();
      render(<NotificationsCenter />);

      const infoChip = screen.getByRole("button", { name: "Filter: info" });
      fireEvent.click(infoChip);
      expect(infoChip.getAttribute("aria-pressed")).toBe("true");

      // All chip should now be false
      const allChip = screen.getByRole("button", { name: "Filter: all" });
      expect(allChip.getAttribute("aria-pressed")).toBe("false");
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  describe("empty state", () => {
    it('renders "No notifications yet." when no entries exist', () => {
      useNotificationsStore.getState().openCenter();
      render(<NotificationsCenter />);
      expect(screen.getByText("No notifications yet.")).toBeDefined();
    });
  });

  // ── axe-core structural scans ───────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — open with entries", async () => {
      useNotificationsStore.getState().addEntry("info", "Test info");
      useNotificationsStore.getState().addEntry("error", "Test error", {
        description: "Something went wrong.",
      });
      useNotificationsStore.getState().openCenter();

      const { container } = render(<NotificationsCenter />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — open, no entries (empty state)", async () => {
      useNotificationsStore.getState().openCenter();
      const { container } = render(<NotificationsCenter />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — closed state", async () => {
      useNotificationsStore.getState().closeCenter();
      const { container } = render(<NotificationsCenter />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
