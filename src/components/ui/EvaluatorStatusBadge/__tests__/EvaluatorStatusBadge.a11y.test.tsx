/**
 * EvaluatorStatusBadge — structural accessibility tests (AC#6)
 *
 * Validates `role="status"` + `aria-label` contract using axe-core via JSDOM.
 * This is the AC#6 satisfaction path because @storybook/addon-a11y is not wired
 * in this Sprint 2 Storybook setup.
 *
 * JSDOM limitation — OKLCH contrast values:
 *   JSDOM cannot compute OKLCH colour values; getComputedStyle returns empty
 *   strings for CSS custom properties that reference OKLCH tokens. Therefore:
 *   - axe-core's color-contrast rule is DISABLED in this harness.
 *   - This harness validates STRUCTURAL accessibility only:
 *       • `role="status"` present and valid
 *       • `aria-label` carries the expected "<ResourceType>: <State>" string
 *       • Icon is aria-hidden (decorative — not announced by screen readers)
 *       • No axe structural violations across representative state samples
 *   - Colour contrast verification (WCAG 1.4.3 AA) is deferred to Story 2.13
 *     which requires a real browser with CSS rendering.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/ui/EvaluatorStatusBadge/__tests__/EvaluatorStatusBadge.a11y.test.tsx
 */

import axe from "axe-core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EvaluatorStatusBadge } from "../EvaluatorStatusBadge";

// Unmount React trees between tests so DOM elements don't accumulate across
// test cases, preventing "found multiple elements" errors from getByRole queries.
afterEach(() => {
  cleanup();
});

// ─── axe helper ──────────────────────────────────────────────────────────────

async function runAxe(container: HTMLElement): Promise<axe.AxeResults> {
  return new Promise((resolve, reject) => {
    axe.run(
      container,
      {
        rules: {
          // Disabled: JSDOM cannot compute OKLCH CSS custom property values.
          // Contrast verification deferred to Story 2.13 in-browser test.
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("EvaluatorStatusBadge — structural accessibility (AC#6)", () => {
  // ── role="status" contract ──────────────────────────────────────────────────

  describe("role and aria-label", () => {
    it('renders role="status" on the root element', () => {
      const { container } = render(
        <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="approved" />,
      );
      const badge = container.querySelector('[role="status"]');
      expect(badge).not.toBeNull();
    });

    it("carries aria-label in '<ResourceType>: <Label>' format — Hook Approved", () => {
      render(<EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="approved" />);
      expect(screen.getByRole("status", { name: "Hook: Approved" })).toBeDefined();
    });

    it("carries aria-label — Skill Pending review", () => {
      render(
        <EvaluatorStatusBadge
          mode="evaluator-status"
          resourceType="skill"
          state="pending review"
        />,
      );
      expect(screen.getByRole("status", { name: "Skill: Pending review" })).toBeDefined();
    });

    it("carries aria-label — Agent Declined", () => {
      render(
        <EvaluatorStatusBadge mode="evaluator-status" resourceType="agent" state="declined" />,
      );
      expect(screen.getByRole("status", { name: "Agent: Declined" })).toBeDefined();
    });

    it("carries aria-label — Hook Quarantined", () => {
      render(
        <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="quarantined" />,
      );
      expect(screen.getByRole("status", { name: "Hook: Quarantined" })).toBeDefined();
    });

    it("carries aria-label — Hook Disabled by you", () => {
      render(
        <EvaluatorStatusBadge
          mode="evaluator-status"
          resourceType="hook"
          state="disabled by you"
        />,
      );
      expect(screen.getByRole("status", { name: "Hook: Disabled by you" })).toBeDefined();
    });

    it("carries aria-label — Hook External pending review (em-dash label)", () => {
      render(
        <EvaluatorStatusBadge
          mode="evaluator-status"
          resourceType="hook"
          state="external — pending review"
        />,
      );
      expect(screen.getByRole("status", { name: "Hook: External — pending review" })).toBeDefined();
    });

    it("carries aria-label — Hook Needs re-evaluation", () => {
      render(
        <EvaluatorStatusBadge
          mode="evaluator-status"
          resourceType="hook"
          state="needs re-evaluation"
        />,
      );
      expect(screen.getByRole("status", { name: "Hook: Needs re-evaluation" })).toBeDefined();
    });

    it("carries aria-label — Command Invalid (validity-only mode)", () => {
      render(<EvaluatorStatusBadge mode="validity-only" resourceType="command" state="invalid" />);
      expect(screen.getByRole("status", { name: "Command: Invalid" })).toBeDefined();
    });

    it("carries aria-label — Team Warnings (validity-only mode)", () => {
      render(<EvaluatorStatusBadge mode="validity-only" resourceType="team" state="warnings" />);
      expect(screen.getByRole("status", { name: "Team: Warnings" })).toBeDefined();
    });

    it("carries aria-label — Workflow Valid (validity-only mode)", () => {
      render(<EvaluatorStatusBadge mode="validity-only" resourceType="workflow" state="valid" />);
      expect(screen.getByRole("status", { name: "Workflow: Valid" })).toBeDefined();
    });

    it("carries aria-label — Command Pending (validity-only mode)", () => {
      render(<EvaluatorStatusBadge mode="validity-only" resourceType="command" state="pending" />);
      expect(screen.getByRole("status", { name: "Command: Pending" })).toBeDefined();
    });
  });

  // ── Icon is decorative (aria-hidden) ────────────────────────────────────────

  describe("icon is decorative", () => {
    it("icon svg carries aria-hidden=true (not announced by screen readers)", () => {
      const { container } = render(
        <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="approved" />,
      );
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  // ── id passthrough ───────────────────────────────────────────────────────────

  describe("id passthrough (aria-describedby integration)", () => {
    it("passes id to root span so parent card can bind aria-describedby", () => {
      const { container } = render(
        <EvaluatorStatusBadge
          mode="evaluator-status"
          resourceType="hook"
          state="quarantined"
          id="hook-card-test-state"
        />,
      );
      const badge = container.querySelector("#hook-card-test-state");
      expect(badge).not.toBeNull();
      expect(badge?.getAttribute("role")).toBe("status");
    });
  });

  // ── axe-core structural scans ────────────────────────────────────────────────

  describe("axe-core structural violations", () => {
    it("has zero axe violations — Hook Approved", async () => {
      const { container } = render(
        <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="approved" />,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — Hook Quarantined", async () => {
      const { container } = render(
        <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="quarantined" />,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — Hook Disabled by you (fallback token state)", async () => {
      const { container } = render(
        <EvaluatorStatusBadge
          mode="evaluator-status"
          resourceType="hook"
          state="disabled by you"
        />,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — Command Invalid (validity-only)", async () => {
      const { container } = render(
        <EvaluatorStatusBadge mode="validity-only" resourceType="command" state="invalid" />,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — full Hook state suite rendered simultaneously", async () => {
      const { container } = render(
        <div>
          <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="approved" />
          <EvaluatorStatusBadge
            mode="evaluator-status"
            resourceType="hook"
            state="pending review"
          />
          <EvaluatorStatusBadge
            mode="evaluator-status"
            resourceType="hook"
            state="external — pending review"
          />
          <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="quarantined" />
          <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="declined" />
          <EvaluatorStatusBadge
            mode="evaluator-status"
            resourceType="hook"
            state="needs re-evaluation"
          />
          <EvaluatorStatusBadge
            mode="evaluator-status"
            resourceType="hook"
            state="disabled by you"
          />
        </div>,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });
  });

  // ── Not focusable ────────────────────────────────────────────────────────────

  describe("not focusable", () => {
    it("root span has no tabIndex (badge is a passive indicator, not interactive)", () => {
      const { container } = render(
        <EvaluatorStatusBadge mode="evaluator-status" resourceType="hook" state="approved" />,
      );
      const badge = container.querySelector('[role="status"]');
      expect(badge?.getAttribute("tabindex")).toBeNull();
    });
  });
});
