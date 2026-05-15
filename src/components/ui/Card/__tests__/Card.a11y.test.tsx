/**
 * Card — structural accessibility tests (Story 2.13 AC #7)
 *
 * Validates:
 *   - Static card: no interactive semantics, not focusable by default
 *   - Interactive card: tabIndex=0, hover/focus affordances
 *   - Sub-parts (CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
 *     compose without a11y violations
 *   - Zero axe violations across default + raised + muted + interactive variants
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *   Contrast is verified separately by the contrast harness.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/ui/Card/__tests__/Card.a11y.test.tsx
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../Card";

afterEach(() => {
  cleanup();
});

describe("Card — structural accessibility (Story 2.13 AC #7)", () => {
  // ── Static card ───────────────────────────────────────────────────────────────

  describe("static card (default)", () => {
    it("renders as a <div> with no tabIndex by default", () => {
      const { container } = render(<Card>Content</Card>);
      const div = container.querySelector("div");
      expect(div).not.toBeNull();
      expect(div?.getAttribute("tabindex")).toBeNull();
    });
  });

  // ── Interactive card ──────────────────────────────────────────────────────────

  describe("interactive card", () => {
    it("is focusable with tabIndex=0 when interactive=true", () => {
      const { container } = render(<Card interactive>Click me</Card>);
      const div = container.querySelector("div");
      expect(div?.getAttribute("tabindex")).toBe("0");
    });
  });

  // ── Sub-parts composition ─────────────────────────────────────────────────────

  describe("full composition with sub-parts", () => {
    it("renders all sub-parts without a11y structure issues", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Skill Name</CardTitle>
            <CardDescription>Description of the skill</CardDescription>
          </CardHeader>
          <CardContent>Body content here</CardContent>
          <CardFooter>
            <span>Footer</span>
          </CardFooter>
        </Card>,
      );
      expect(screen.getByText("Skill Name")).toBeDefined();
      expect(screen.getByText("Description of the skill")).toBeDefined();
    });
  });

  // ── axe-core scans ────────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — default static card", async () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
          </CardHeader>
          <CardContent>Body</CardContent>
        </Card>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — raised variant", async () => {
      const { container } = render(<Card variant="raised">Raised</Card>);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — muted variant", async () => {
      const { container } = render(<Card variant="muted">Muted</Card>);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — interactive card with role=button", async () => {
      const { container } = render(
        <Card interactive role="button" aria-label="Open skill details">
          Card content
        </Card>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — full composition", async () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Skill Name</CardTitle>
            <CardDescription>What this skill does</CardDescription>
          </CardHeader>
          <CardContent>Details about the skill</CardContent>
          <CardFooter>
            <span>v1.0</span>
          </CardFooter>
        </Card>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
