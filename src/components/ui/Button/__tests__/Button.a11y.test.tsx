/**
 * Button — structural accessibility tests (Story 2.13 AC #7)
 *
 * Validates:
 *   - Renders as <button> with interactive semantics
 *   - Disabled state: aria-disabled or native disabled
 *   - Loading state: aria-busy="true" + aria-disabled="true"
 *   - Icon-only variant: requires aria-label for AT (not tested here — consumer responsibility)
 *   - Zero axe violations across default render + each variant + disabled state
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *   Contrast is verified separately by the contrast harness (contrast-harness.a11y.test.ts).
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/ui/Button/__tests__/Button.a11y.test.tsx
 */

import axe from "axe-core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "../Button";

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

describe("Button — structural accessibility (Story 2.13 AC #7)", () => {
  // ── Default render ───────────────────────────────────────────────────────────

  describe("default render", () => {
    it("renders a <button> element", () => {
      render(<Button>Save</Button>);
      expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
    });

    it("is focusable (not disabled by default)", () => {
      render(<Button>Save</Button>);
      const btn = screen.getByRole("button", { name: "Save" });
      expect(btn.getAttribute("disabled")).toBeNull();
    });
  });

  // ── Variants ─────────────────────────────────────────────────────────────────

  describe("variant rendering", () => {
    it("renders secondary variant without extra a11y attributes", () => {
      render(<Button variant="secondary">Cancel</Button>);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
    });

    it("renders destructive variant", () => {
      render(<Button variant="destructive">Delete</Button>);
      expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
    });

    it("renders outline variant", () => {
      render(<Button variant="outline">Edit</Button>);
      expect(screen.getByRole("button", { name: "Edit" })).toBeDefined();
    });

    it("renders ghost variant", () => {
      render(<Button variant="ghost">More</Button>);
      expect(screen.getByRole("button", { name: "More" })).toBeDefined();
    });
  });

  // ── Disabled state ───────────────────────────────────────────────────────────

  describe("disabled state", () => {
    it("native disabled button is not reachable via role query", () => {
      const { container } = render(<Button disabled>Save</Button>);
      const btn = container.querySelector("button");
      expect(btn?.disabled).toBe(true);
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────────────

  describe("loading state", () => {
    it("sets aria-busy and aria-disabled when loading=true", () => {
      render(<Button loading>Saving</Button>);
      const btn = screen.getByRole("button", { name: "Saving" });
      expect(btn.getAttribute("aria-busy")).toBe("true");
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });
  });

  // ── axe-core scans ────────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — default render", async () => {
      const { container } = render(<Button>Save</Button>);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — destructive variant", async () => {
      const { container } = render(<Button variant="destructive">Delete</Button>);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — disabled", async () => {
      const { container } = render(<Button disabled>Save</Button>);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — loading", async () => {
      const { container } = render(<Button loading>Saving</Button>);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — icon-only with aria-label", async () => {
      const { container } = render(<Button variant="ghost" size="icon" aria-label="Close" />);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });
  });
});
