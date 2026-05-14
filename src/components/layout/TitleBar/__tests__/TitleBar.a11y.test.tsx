/**
 * TitleBar — structural accessibility tests (Story 2.9 AC #9)
 *
 * Validates:
 *   - role="banner"
 *   - Title text is rendered
 *   - Zero axe violations
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/layout/TitleBar/__tests__/TitleBar.a11y.test.tsx
 */

import axe from "axe-core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TitleBar } from "../TitleBar";

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

describe("TitleBar — structural accessibility (Story 2.9 AC #9)", () => {
  // ── Banner landmark ─────────────────────────────────────────────────────────

  describe("banner landmark", () => {
    it('renders role="banner" (header element)', () => {
      render(<TitleBar />);
      expect(screen.getByRole("banner")).toBeDefined();
    });

    it("renders default title 'ZoePlane'", () => {
      render(<TitleBar />);
      expect(screen.getByText("ZoePlane")).toBeDefined();
    });

    it("renders custom title", () => {
      render(<TitleBar title="My App" />);
      expect(screen.getByText("My App")).toBeDefined();
    });
  });

  // ── Controls ────────────────────────────────────────────────────────────────

  describe("control slots", () => {
    it("renders left controls when provided", () => {
      render(<TitleBar leftControls={<button data-testid="left-btn">Left</button>} />);
      expect(screen.getByTestId("left-btn")).toBeDefined();
    });

    it("renders right controls when provided", () => {
      render(<TitleBar rightControls={<button data-testid="right-btn">Right</button>} />);
      expect(screen.getByTestId("right-btn")).toBeDefined();
    });
  });

  // ── axe-core scans ──────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — default", async () => {
      const { container } = render(<TitleBar />);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — with controls", async () => {
      const { container } = render(
        <TitleBar
          title="ZoePlane"
          leftControls={<button>Menu</button>}
          rightControls={<button>Settings</button>}
        />,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });
  });
});
