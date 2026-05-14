/**
 * Inspector — structural accessibility tests (Story 2.9 AC #9)
 *
 * Validates:
 *   - role="complementary" with aria-label="Inspector"
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
 *   bun run test --reporter=verbose src/components/layout/Inspector/__tests__/Inspector.a11y.test.tsx
 */

import axe from "axe-core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Inspector } from "../Inspector";

afterEach(() => {
  cleanup();
});

async function runAxe(container: HTMLElement): Promise<axe.AxeResults> {
  return new Promise((resolve, reject) => {
    axe.run(
      container,
      {
        rules: {
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

describe("Inspector — structural accessibility (Story 2.9 AC #9)", () => {
  // ── Landmark role ───────────────────────────────────────────────────────────

  describe("complementary landmark", () => {
    it('renders role="complementary" with aria-label="Inspector"', () => {
      render(<Inspector />);
      expect(screen.getByRole("complementary", { name: "Inspector" })).toBeDefined();
    });

    it("accepts custom aria-label", () => {
      render(<Inspector aria-label="Context panel" />);
      expect(screen.getByRole("complementary", { name: "Context panel" })).toBeDefined();
    });
  });

  // ── Toggle button ───────────────────────────────────────────────────────────

  describe("collapse toggle", () => {
    it("renders toggle button with aria-expanded=true when expanded (default)", () => {
      render(<Inspector />);
      const toggle = screen.getByRole("button", { name: /inspector/i });
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
    });
  });

  // ── Children ────────────────────────────────────────────────────────────────

  describe("children", () => {
    it("renders children slot when provided", () => {
      render(
        <Inspector>
          <p data-testid="inspector-content">Detail panel</p>
        </Inspector>,
      );
      expect(screen.getByTestId("inspector-content")).toBeDefined();
    });

    it("renders placeholder text when no children", () => {
      const { container } = render(<Inspector />);
      expect(container.textContent).toContain("No selection");
    });
  });

  // ── axe-core scans ──────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — expanded state (default)", async () => {
      const { container } = render(<Inspector />);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — with children", async () => {
      const { container } = render(
        <Inspector>
          <p>Selected item details</p>
        </Inspector>,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — custom aria-label", async () => {
      const { container } = render(<Inspector aria-label="Context panel" />);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });
  });
});
