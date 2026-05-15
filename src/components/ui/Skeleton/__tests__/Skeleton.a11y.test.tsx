/**
 * Skeleton — structural accessibility tests (Story 2.13 AC #7)
 *
 * Validates:
 *   - Individual Skeleton instances are decorative (aria-hidden="true")
 *   - Wrapping region carries role="status" aria-live="polite" aria-busy="true"
 *   - All four variants (text / avatar / card / custom) render correctly
 *   - Composite (CardSkeleton / RouteSkeleton / StreamSkeleton) render without violations
 *   - Zero axe violations for all variants in a properly wrapped live region
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *   Contrast is verified separately by the contrast harness.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/ui/Skeleton/__tests__/Skeleton.a11y.test.tsx
 */

import axe from "axe-core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Skeleton } from "../Skeleton";
import { CardSkeleton } from "../CardSkeleton";
import { RouteSkeleton } from "../RouteSkeleton";
import { StreamSkeleton } from "../StreamSkeleton";

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

// Correct wrapper: region with role="status" aria-live="polite" aria-busy="true"
// Individual Skeleton elements are aria-hidden (decorative).
function SkeletonRegion({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading">
      {children}
    </div>
  );
}

describe("Skeleton — structural accessibility (Story 2.13 AC #7)", () => {
  // ── Decorative contract ───────────────────────────────────────────────────────

  describe("decorative contract", () => {
    it("Skeleton is aria-hidden by default (decorative)", () => {
      const { container } = render(<Skeleton />);
      const el = container.querySelector("[aria-hidden]");
      expect(el).not.toBeNull();
      expect(el?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  // ── Variants ─────────────────────────────────────────────────────────────────

  describe("variants", () => {
    it("renders text variant", () => {
      const { container } = render(<Skeleton variant="text" />);
      expect(container.firstChild).not.toBeNull();
    });

    it("renders avatar variant", () => {
      const { container } = render(<Skeleton variant="avatar" />);
      expect(container.firstChild).not.toBeNull();
    });

    it("renders card variant", () => {
      const { container } = render(<Skeleton variant="card" />);
      expect(container.firstChild).not.toBeNull();
    });

    it("renders custom variant", () => {
      const { container } = render(<Skeleton variant="custom" className="h-8 w-32 rounded-md" />);
      expect(container.firstChild).not.toBeNull();
    });
  });

  // ── axe-core scans ────────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — text skeleton in loading region", async () => {
      const { container } = render(
        <SkeletonRegion>
          <Skeleton variant="text" />
          <Skeleton variant="text" />
        </SkeletonRegion>,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — avatar skeleton in loading region", async () => {
      const { container } = render(
        <SkeletonRegion>
          <Skeleton variant="avatar" />
        </SkeletonRegion>,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — CardSkeleton composite", async () => {
      const { container } = render(
        <SkeletonRegion>
          <CardSkeleton />
        </SkeletonRegion>,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — RouteSkeleton composite", async () => {
      const { container } = render(
        <SkeletonRegion>
          <RouteSkeleton ariaLabel="Loading route" />
        </SkeletonRegion>,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — StreamSkeleton composite", async () => {
      const { container } = render(
        <SkeletonRegion>
          <StreamSkeleton ariaLabel="Loading stream" />
        </SkeletonRegion>,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });
  });
});
