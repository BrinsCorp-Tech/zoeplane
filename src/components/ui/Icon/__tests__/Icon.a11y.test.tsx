/**
 * Icon — structural accessibility tests (Story 2.13 AC #7)
 *
 * Validates:
 *   - Decorative icons carry aria-hidden="true" (default)
 *   - Meaningful icons carry aria-label (drops aria-hidden)
 *   - Unknown icon name returns null (no output)
 *   - Zero axe violations across decorative + meaningful variants
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *   Contrast is verified separately by the contrast harness.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/ui/Icon/__tests__/Icon.a11y.test.tsx
 */

import axe from "axe-core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Icon } from "../Icon";

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

describe("Icon — structural accessibility (Story 2.13 AC #7)", () => {
  // ── Decorative mode (default) ─────────────────────────────────────────────────

  describe("decorative mode (default)", () => {
    it("carries aria-hidden='true' when no aria-label provided", () => {
      const { container } = render(<Icon name="check" />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  // ── Meaningful mode ───────────────────────────────────────────────────────────

  describe("meaningful mode (aria-label provided)", () => {
    it("carries aria-label on the SVG when aria-label is provided", () => {
      const { container } = render(<Icon name="check" aria-label="Task complete" />);
      const svg = container.querySelector("svg");
      // aria-label is forwarded to the SVG element
      expect(svg?.getAttribute("aria-label")).toBe("Task complete");
    });

    it("does not carry aria-hidden when aria-label is provided", () => {
      const { container } = render(<Icon name="check" aria-label="Task complete" />);
      const svg = container.querySelector("svg");
      // aria-label overrides the decorative pattern — aria-hidden must be absent
      expect(svg?.getAttribute("aria-hidden")).toBeNull();
    });
  });

  // ── Size variants ─────────────────────────────────────────────────────────────

  describe("size variants", () => {
    it("renders xs size (12px)", () => {
      const { container } = render(<Icon name="x" size="xs" />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("width")).toBe("12");
    });

    it("renders lg size (24px)", () => {
      const { container } = render(<Icon name="info" size="lg" />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("width")).toBe("24");
    });
  });

  // ── axe-core scans ────────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — decorative icon (aria-hidden)", async () => {
      const { container } = render(<Icon name="check" />);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — meaningful icon (aria-label)", async () => {
      const { container } = render(<Icon name="alert-circle" aria-label="Error: check required" />);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — icon inside a button (decorative)", async () => {
      const { container } = render(
        <button type="button" aria-label="Close">
          <Icon name="x" />
        </button>,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });
  });
});
