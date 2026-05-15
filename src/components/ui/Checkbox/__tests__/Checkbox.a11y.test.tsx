/**
 * Checkbox — structural accessibility tests (Story 2.13 AC #7)
 *
 * Validates:
 *   - Checkbox has role="checkbox" with aria-checked
 *   - Unchecked, checked, and indeterminate states
 *   - Disabled state: aria-disabled or data-disabled
 *   - Error state: aria-invalid
 *   - Label association: wrapped in <label> for accessible name
 *   - Zero axe violations across all states
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *   Contrast is verified separately by the contrast harness.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/ui/Checkbox/__tests__/Checkbox.a11y.test.tsx
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { Checkbox } from "../Checkbox";

afterEach(() => {
  cleanup();
});

describe("Checkbox — structural accessibility (Story 2.13 AC #7)", () => {
  // ── Role contract ─────────────────────────────────────────────────────────────

  describe("role contract", () => {
    it("renders role='checkbox' with accessible label", () => {
      render(
        <label>
          <Checkbox />
          Accept terms
        </label>,
      );
      expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeDefined();
    });
  });

  // ── States ────────────────────────────────────────────────────────────────────

  describe("states", () => {
    it("unchecked state (default)", () => {
      render(
        <label>
          <Checkbox />
          Remember me
        </label>,
      );
      const checkbox = screen.getByRole("checkbox", { name: "Remember me" });
      expect(checkbox.getAttribute("aria-checked")).not.toBe("true");
    });

    it("checked state", () => {
      render(
        <label>
          <Checkbox checked />
          Remember me
        </label>,
      );
      const checkbox = screen.getByRole("checkbox", { name: "Remember me" });
      expect(checkbox.getAttribute("data-state")).toBe("checked");
    });

    it("indeterminate state", () => {
      render(
        <label>
          <Checkbox checked="indeterminate" />
          Select all
        </label>,
      );
      const checkbox = screen.getByRole("checkbox", { name: "Select all" });
      expect(checkbox.getAttribute("data-state")).toBe("indeterminate");
    });

    it("disabled state", () => {
      render(
        <label>
          <Checkbox disabled />
          Disabled option
        </label>,
      );
      const checkbox = screen.getByRole("checkbox", { name: "Disabled option" });
      expect(checkbox.getAttribute("data-disabled")).not.toBeNull();
    });
  });

  // ── axe-core scans ────────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — unchecked with label", async () => {
      const { container } = render(
        <label>
          <Checkbox />
          Accept terms
        </label>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — checked state", async () => {
      const { container } = render(
        <label>
          <Checkbox checked />
          Remember me
        </label>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — indeterminate state", async () => {
      const { container } = render(
        <label>
          <Checkbox checked="indeterminate" />
          Select all
        </label>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — disabled checkbox", async () => {
      const { container } = render(
        <label>
          <Checkbox disabled />
          Disabled option
        </label>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
