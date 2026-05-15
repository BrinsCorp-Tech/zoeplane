/**
 * Spinner — structural accessibility tests (Story 2.13 AC #7)
 *
 * Validates:
 *   - Decorative mode (default): aria-hidden="true"
 *   - Standalone mode: role="status" + aria-label
 *   - Size variants all render correctly
 *   - Zero axe violations across decorative + standalone + in-button states
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *   Contrast is verified separately by the contrast harness.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/ui/Spinner/__tests__/Spinner.a11y.test.tsx
 */

import axe from "axe-core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Spinner } from "../Spinner";

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

describe("Spinner — structural accessibility (Story 2.13 AC #7)", () => {
  // ── Decorative mode (default) ─────────────────────────────────────────────────

  describe("decorative mode (default)", () => {
    it("carries aria-hidden='true' by default", () => {
      const { container } = render(<Spinner />);
      const span = container.querySelector("span");
      expect(span?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  // ── Standalone mode ───────────────────────────────────────────────────────────

  describe("standalone mode (role='status')", () => {
    it("renders role='status' when role is set", () => {
      render(<Spinner role="status" aria-label="Loading skills" />);
      expect(screen.getByRole("status", { name: "Loading skills" })).toBeDefined();
    });

    it("does not carry aria-hidden in standalone mode", () => {
      const { container } = render(<Spinner role="status" aria-label="Loading" />);
      const span = container.querySelector("span");
      expect(span?.getAttribute("aria-hidden")).toBeNull();
    });
  });

  // ── Size variants ─────────────────────────────────────────────────────────────

  describe("size variants", () => {
    it("renders xs size", () => {
      const { container } = render(<Spinner size="xs" />);
      expect(container.querySelector("span")).not.toBeNull();
    });

    it("renders md size", () => {
      const { container } = render(<Spinner size="md" />);
      expect(container.querySelector("span")).not.toBeNull();
    });

    it("renders xl size", () => {
      const { container } = render(<Spinner size="xl" />);
      expect(container.querySelector("span")).not.toBeNull();
    });
  });

  // ── Button context ────────────────────────────────────────────────────────────

  describe("in button context (decorative)", () => {
    it("button with loading Spinner does not expose aria-hidden span to AT (covered by button)", () => {
      const { container } = render(
        <button type="button" aria-busy="true" aria-disabled="true">
          <Spinner size="xs" aria-hidden="true" />
          Saving
        </button>,
      );
      const span = container.querySelector("span");
      expect(span?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  // ── axe-core scans ────────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — decorative spinner", async () => {
      const { container } = render(<Spinner />);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — standalone spinner with label", async () => {
      const { container } = render(<Spinner role="status" aria-label="Loading skills" />);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — spinner inside loading button", async () => {
      const { container } = render(
        <button type="button" aria-busy="true" aria-disabled="true">
          <Spinner size="xs" aria-hidden="true" />
          Saving
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
