/**
 * TabStrip — structural accessibility tests (Story 2.9)
 *
 * Validates:
 *   - role="tablist" with aria-label (populated state)
 *   - Empty state: no tablist (plain div — axe aria-required-children compliant)
 *   - role="tab" with aria-selected on each tab (direct children of tablist)
 *   - Zero axe violations across 0/1/many tab states
 *
 * A11y design notes:
 *   - Empty state omits role="tablist" — ARIA requires tablist to own role="tab"
 *   - Close mark is aria-hidden (not a nested button) — no nested-interactive
 *   - Keyboard close: Delete/Backspace on focused tab (tested separately)
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/layout/TabStrip/__tests__/TabStrip.a11y.test.tsx
 */

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { TabStrip } from "../TabStrip";
import { useAppStore } from "@/stores/app";

afterEach(() => {
  cleanup();
  useAppStore.setState({ tabs: [], activeTabId: null });
});

beforeEach(() => {
  useAppStore.setState({ tabs: [], activeTabId: null });
});

describe("TabStrip — structural accessibility (Story 2.9)", () => {
  // ── tablist role (populated state) ──────────────────────────────────────────

  describe("tablist role — populated state", () => {
    it('renders role="tablist" with aria-label="Open tabs" when tabs present', () => {
      render(<TabStrip tabs={[{ id: "t1", title: "skills" }]} />);
      expect(screen.getByRole("tablist", { name: "Open tabs" })).toBeDefined();
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  describe("0 tabs (empty state)", () => {
    it("renders empty state message when no tabs", () => {
      render(<TabStrip tabs={[]} />);
      expect(screen.getByText("No open tabs")).toBeDefined();
    });

    it("does NOT render role=tablist when empty (axe aria-required-children compliance)", () => {
      render(<TabStrip tabs={[]} />);
      // tablist without tab children would fail axe — we use a plain div instead
      expect(screen.queryByRole("tablist")).toBeNull();
    });
  });

  // ── Populated state ─────────────────────────────────────────────────────────

  describe("with tabs (prop mode)", () => {
    const tabs = [
      { id: "t1", title: "skills" },
      { id: "t2", title: "agents" },
      { id: "t3", title: "commands" },
    ];

    it("renders correct number of tab elements", () => {
      render(<TabStrip tabs={tabs} />);
      expect(screen.getAllByRole("tab")).toHaveLength(3);
    });

    it("tab elements are direct children of tablist", () => {
      const { container } = render(<TabStrip tabs={tabs} />);
      const tablist = container.querySelector('[role="tablist"]');
      const directTabChildren = Array.from(tablist?.children ?? []).filter(
        (el) => el.getAttribute("role") === "tab",
      );
      expect(directTabChildren.length).toBe(3);
    });

    it("tab buttons have aria-selected attribute", () => {
      render(<TabStrip tabs={tabs} />);
      const tabEls = screen.getAllByRole("tab");
      tabEls.forEach((el) => {
        expect(el.hasAttribute("aria-selected")).toBe(true);
      });
    });
  });

  // ── Store integration ───────────────────────────────────────────────────────

  describe("store integration", () => {
    it("reads tabs from store when no prop provided", () => {
      useAppStore.setState({
        tabs: [{ id: "s1", title: "store-tab" }],
        activeTabId: "s1",
      });
      render(<TabStrip />);
      expect(screen.getByRole("tab", { name: /store-tab/i })).toBeDefined();
    });

    it("selectTab fires on tab click (store mode)", () => {
      useAppStore.setState({
        tabs: [
          { id: "t1", title: "first" },
          { id: "t2", title: "second" },
        ],
        activeTabId: "t1",
      });
      render(<TabStrip />);

      // Click second tab
      fireEvent.click(screen.getByRole("tab", { name: /second/i }));
      expect(useAppStore.getState().activeTabId).toBe("t2");
    });

    it("keyboard Delete closes the focused tab", () => {
      useAppStore.setState({
        tabs: [
          { id: "t1", title: "first" },
          { id: "t2", title: "second" },
        ],
        activeTabId: "t1",
      });
      render(<TabStrip />);

      const firstTab = screen.getByRole("tab", { name: /first/i });
      fireEvent.keyDown(firstTab, { key: "Delete" });

      // first tab should be removed
      expect(useAppStore.getState().tabs.map((t) => t.id)).not.toContain("t1");
    });
  });

  // ── axe-core scans ──────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — 0 tabs (empty state, no tablist)", async () => {
      const { container } = render(<TabStrip tabs={[]} />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — 1 tab", async () => {
      const { container } = render(<TabStrip tabs={[{ id: "t1", title: "skills" }]} />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — 3 tabs", async () => {
      const { container } = render(
        <TabStrip
          tabs={[
            { id: "t1", title: "skills" },
            { id: "t2", title: "agents" },
            { id: "t3", title: "commands" },
          ]}
        />,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — many tabs (overflow scenario)", async () => {
      const { container } = render(
        <TabStrip
          tabs={Array.from({ length: 10 }, (_, i) => ({
            id: `tab-${i}`,
            title: `Tab ${i + 1}`,
          }))}
        />,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
