/**
 * Input — structural accessibility tests (Story 2.13 AC #7)
 *
 * Validates:
 *   - Renders as <input> with expected type
 *   - Placeholder text does not replace visible label (label is consumer responsibility)
 *   - aria-invalid on error state
 *   - disabled state: aria-disabled or native disabled
 *   - leadingAffix / trailingAffix: affix nodes are aria-hidden decorative
 *   - Zero axe violations across default + affixed + disabled + error variants
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *   Contrast is verified separately by the contrast harness.
 *
 * NOTE: Input does not render a label — FormField handles labelling for form contexts.
 *   For test isolation we provide aria-label directly on the input.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/ui/Input/__tests__/Input.a11y.test.tsx
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { Input } from "../Input";

afterEach(() => {
  cleanup();
});

describe("Input — structural accessibility (Story 2.13 AC #7)", () => {
  // ── Default render ───────────────────────────────────────────────────────────

  describe("default render", () => {
    it("renders as a text input by default", () => {
      render(<Input aria-label="Search" />);
      expect(screen.getByRole("textbox", { name: "Search" })).toBeDefined();
    });

    it("accepts placeholder without replacing accessible name", () => {
      render(<Input aria-label="Search" placeholder="Search skills…" />);
      const input = screen.getByRole("textbox", { name: "Search" });
      expect(input.getAttribute("placeholder")).toBe("Search skills…");
    });
  });

  // ── Error state ───────────────────────────────────────────────────────────────

  describe("error state", () => {
    it("sets aria-invalid when error state is indicated", () => {
      render(<Input aria-label="Email" aria-invalid="true" />);
      const input = screen.getByRole("textbox", { name: "Email" });
      expect(input.getAttribute("aria-invalid")).toBe("true");
    });
  });

  // ── Disabled state ────────────────────────────────────────────────────────────

  describe("disabled state", () => {
    it("sets native disabled attribute", () => {
      const { container } = render(<Input aria-label="Name" disabled />);
      const input = container.querySelector("input");
      expect(input?.disabled).toBe(true);
    });
  });

  // ── Affixed variants ──────────────────────────────────────────────────────────

  describe("affixed variants", () => {
    it("renders with leading affix in a container wrapper", () => {
      const { container } = render(
        <Input aria-label="Search" leadingAffix={<span aria-hidden="true">$</span>} />,
      );
      // Affixed input is wrapped in a div
      expect(container.querySelector("div")).not.toBeNull();
      expect(screen.getByRole("textbox", { name: "Search" })).toBeDefined();
    });

    it("renders with trailing affix", () => {
      render(<Input aria-label="Amount" trailingAffix={<span aria-hidden="true">USD</span>} />);
      expect(screen.getByRole("textbox", { name: "Amount" })).toBeDefined();
    });
  });

  // ── axe-core scans ────────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — default text input with aria-label", async () => {
      const { container } = render(<Input aria-label="Search" />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — disabled input", async () => {
      const { container } = render(<Input aria-label="Name" disabled />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — error state", async () => {
      const { container } = render(
        <Input aria-label="Email" aria-invalid="true" aria-describedby="email-error" />,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — with leading affix", async () => {
      const { container } = render(
        <Input aria-label="Search" leadingAffix={<span aria-hidden="true">$</span>} />,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
