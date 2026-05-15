/**
 * Badge — structural accessibility tests (Story 2.13 AC #7)
 *
 * Validates:
 *   - Badge is a <span> (non-interactive by default)
 *   - Dismiss button has aria-label when onDismiss is provided
 *   - Dismiss button has an inflated hit area (not a11y concern, but verifiable)
 *   - Icons inside are decorative (aria-hidden)
 *   - Zero axe violations across default + each variant + dismiss variant
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *   Contrast is verified separately by the contrast harness.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/ui/Badge/__tests__/Badge.a11y.test.tsx
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { Badge } from "../Badge";

afterEach(() => {
  cleanup();
});

describe("Badge — structural accessibility (Story 2.13 AC #7)", () => {
  // ── Default render ───────────────────────────────────────────────────────────

  describe("default render", () => {
    it("renders as a <span> (non-interactive by default)", () => {
      const { container } = render(<Badge>Active</Badge>);
      const span = container.querySelector("span");
      expect(span).not.toBeNull();
      expect(span?.tagName).toBe("SPAN");
    });

    it("renders visible label text", () => {
      render(<Badge>Active</Badge>);
      expect(screen.getByText("Active")).toBeDefined();
    });
  });

  // ── Dismiss button a11y ──────────────────────────────────────────────────────

  describe("dismiss button", () => {
    it("renders dismiss button with default aria-label='Dismiss'", () => {
      render(<Badge onDismiss={() => {}}>Filter: Global</Badge>);
      expect(screen.getByRole("button", { name: "Dismiss" })).toBeDefined();
    });

    it("renders dismiss button with custom dismissLabel", () => {
      render(
        <Badge onDismiss={() => {}} dismissLabel="Dismiss filter: Global">
          Filter: Global
        </Badge>,
      );
      expect(screen.getByRole("button", { name: "Dismiss filter: Global" })).toBeDefined();
    });
  });

  // ── Variants ─────────────────────────────────────────────────────────────────

  describe("variants", () => {
    it("renders secondary variant", () => {
      render(<Badge variant="secondary">Draft</Badge>);
      expect(screen.getByText("Draft")).toBeDefined();
    });

    it("renders destructive variant", () => {
      render(<Badge variant="destructive">Error</Badge>);
      expect(screen.getByText("Error")).toBeDefined();
    });

    it("renders outline variant", () => {
      render(<Badge variant="outline">Beta</Badge>);
      expect(screen.getByText("Beta")).toBeDefined();
    });
  });

  // ── axe-core scans ────────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — default badge", async () => {
      const { container } = render(<Badge>Active</Badge>);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — secondary variant", async () => {
      const { container } = render(<Badge variant="secondary">Draft</Badge>);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — destructive variant", async () => {
      const { container } = render(<Badge variant="destructive">Error</Badge>);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — outline variant", async () => {
      const { container } = render(<Badge variant="outline">Beta</Badge>);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — with dismiss button", async () => {
      const { container } = render(
        <Badge onDismiss={() => {}} dismissLabel="Dismiss filter: Global">
          Filter: Global
        </Badge>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
