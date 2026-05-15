/**
 * Sidebar — structural accessibility tests (Story 2.9 AC #9)
 *
 * Validates:
 *   - role="navigation" with aria-label="Primary navigation"
 *   - Toggle button with aria-expanded
 *   - Zero axe violations in default (expanded) state
 *
 * NOTE: localStorage-based collapsed state is NOT tested here —
 * JSDOM requires a `url` option to enable localStorage, which the project's
 * shared vitest.config.ts does not set. Collapse behaviour via localStorage
 * is covered in CollapsiblePane.a11y.test.tsx instead.
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/layout/Sidebar/__tests__/Sidebar.a11y.test.tsx
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { Sidebar } from "../Sidebar";

afterEach(() => {
  cleanup();
});

describe("Sidebar — structural accessibility (Story 2.9 AC #9)", () => {
  // ── Landmark role ───────────────────────────────────────────────────────────

  describe("navigation landmark", () => {
    it('renders role="navigation" with aria-label="Primary navigation"', () => {
      render(<Sidebar />);
      expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeDefined();
    });
  });

  // ── Toggle button ───────────────────────────────────────────────────────────

  describe("collapse toggle", () => {
    it("renders a collapse toggle button with aria-expanded", () => {
      render(<Sidebar />);
      const toggle = screen.getByRole("button", { name: /sidebar/i });
      expect(toggle).toBeDefined();
      // Expanded by default (localStorage not available in this JSDOM config)
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
    });
  });

  // ── Nav items ───────────────────────────────────────────────────────────────

  describe("nav items", () => {
    it("renders default nav groups when no groups prop provided", () => {
      render(<Sidebar />);
      // Default groups render "Libraries" and "Workspace" headings
      expect(screen.getByText("Libraries")).toBeDefined();
    });

    it("renders activeItemId with aria-current=page on the active nav item", () => {
      render(<Sidebar activeItemId="skills" />);
      const activeBtn = screen.getByRole("button", { name: "Skills" });
      expect(activeBtn.getAttribute("aria-current")).toBe("page");
    });
  });

  // ── axe-core scans ──────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — expanded state (default)", async () => {
      const { container } = render(<Sidebar />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — with activeItemId", async () => {
      const { container } = render(<Sidebar activeItemId="skills" />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — custom groups", async () => {
      const { container } = render(
        <Sidebar
          groups={[
            {
              id: "g1",
              label: "Tools",
              items: [
                { id: "i1", label: "Editor" },
                { id: "i2", label: "Terminal" },
              ],
            },
          ]}
        />,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
