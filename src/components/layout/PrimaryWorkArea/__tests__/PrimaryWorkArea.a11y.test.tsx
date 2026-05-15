/**
 * PrimaryWorkArea — structural accessibility tests (Story 2.9 AC #9)
 *
 * Validates:
 *   - role="main" (via <main> element)
 *   - aria-label on the main region
 *   - Zero axe violations with and without children
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/layout/PrimaryWorkArea/__tests__/PrimaryWorkArea.a11y.test.tsx
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { PrimaryWorkArea } from "../PrimaryWorkArea";

afterEach(() => {
  cleanup();
});

describe("PrimaryWorkArea — structural accessibility (Story 2.9 AC #9)", () => {
  // ── main landmark ───────────────────────────────────────────────────────────

  describe("main landmark", () => {
    it('renders role="main" (via <main> element)', () => {
      render(<PrimaryWorkArea />);
      expect(screen.getByRole("main")).toBeDefined();
    });

    it('has default aria-label="Main content"', () => {
      render(<PrimaryWorkArea />);
      expect(screen.getByRole("main", { name: "Main content" })).toBeDefined();
    });

    it("accepts custom aria-label", () => {
      render(<PrimaryWorkArea aria-label="Skills view" />);
      expect(screen.getByRole("main", { name: "Skills view" })).toBeDefined();
    });
  });

  // ── Children ────────────────────────────────────────────────────────────────

  describe("children rendering", () => {
    it("renders children when provided", () => {
      render(
        <PrimaryWorkArea>
          <div data-testid="child">Content</div>
        </PrimaryWorkArea>,
      );
      expect(screen.getByTestId("child")).toBeDefined();
    });

    it("renders placeholder when no children", () => {
      const { container } = render(<PrimaryWorkArea />);
      // Placeholder text is rendered
      expect(container.textContent).toContain("Epic 03");
    });
  });

  // ── axe-core scans ──────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — no children (placeholder)", async () => {
      const { container } = render(<PrimaryWorkArea />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — with children", async () => {
      const { container } = render(
        <PrimaryWorkArea>
          <h1>Page Title</h1>
          <p>Content paragraph</p>
        </PrimaryWorkArea>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
