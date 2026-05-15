/**
 * contrast-harness.a11y.test.ts
 *
 * WCAG 2.2 AA contrast verification harness — Story 2.13 AC #1, #2, #3.
 *
 * Engine decision (AC #8 — recorded here per architect Decision 1):
 * ──────────────────────────────────────────────────────────────────────────────
 * Engine: `culori` v4 — `wcagContrast(fg, bg)`.
 *
 * Rationale:
 *   1. ZoePlane's design token cascade uses OKLCH (three-tier architecture,
 *      see ADR-004 and dark-mode-architecture.md v1.1). JSDOM cannot compute
 *      CSS custom properties at runtime, so axe-core's color-contrast rule
 *      cannot resolve OKLCH tokens from the rendered DOM.
 *
 *   2. `culori` is OKLCH-native: `parse("oklch(0.985 0.002 250)")` returns a
 *      typed color object; `wcagContrast(fg, bg)` computes WCAG relative
 *      luminance via an accurate OKLCH→XYZ→sRGB chain without any intermediate
 *      format conversion.
 *
 *   3. `color-contrast-checker` (the alternative from the story NOTE finding)
 *      operates on hex/rgb only — it would require a lossy OKLCH→sRGB conversion
 *      that culori makes unnecessary.
 *
 *   ADR-004 is referenced for the three-tier cascade and OKLCH adoption decision;
 *   no separate ADR amendment is needed for the engine selection — it follows
 *   directly from ADR-004 constraints.
 *
 * Test structure (AC #1–#3):
 * ──────────────────────────────────────────────────────────────────────────────
 *   - Iterates every pair in LIGHT_PAIRS (light theme) and DARK_PAIRS (dark theme).
 *   - AC #1: asserts ratio ≥ 4.5 for body text, ≥ 3.0 for large text and non-text UI.
 *   - AC #2: if AAA goal is declared and ratio ≥ 7.0 → logged; if < 7.0 in one theme
 *     but achieved in the other → gap logged but suite does NOT fail.
 *   - AC #3: if any pair fails AA → test fails with the token pair name and theme.
 *
 * `bun run test:contrast` alias runs this file only (see package.json scripts).
 */

// @vitest-environment node
// JSDOM not needed — this harness does pure math on OKLCH literals, no DOM rendering.

import { wcagContrast } from "culori";
import { afterAll, describe, expect, it } from "vitest";
import {
  AAA_RATIO,
  DARK_PAIRS,
  LIGHT_PAIRS,
  THRESHOLD_RATIOS,
  type TokenPair,
} from "@/test/fixtures/semantic-token-pairs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a ratio to two decimal places for failure messages.
 */
function fmt(r: number): string {
  return r.toFixed(2);
}

// ─── Per-theme test factory ───────────────────────────────────────────────────

function testTheme(
  theme: "light" | "dark",
  pairs: TokenPair[],
  aaaResults: { name: string; lightRatio: number | null; darkRatio: number | null }[],
): void {
  describe(`${theme} theme — AA contrast (AC #1)`, () => {
    for (const pair of pairs) {
      it(`[${theme}] ${pair.name} ≥ ${THRESHOLD_RATIOS[pair.threshold]}:1 (${pair.threshold})`, () => {
        const ratio = wcagContrast(pair.fg, pair.bg);
        const required = THRESHOLD_RATIOS[pair.threshold];

        // AC #3: fail with actionable message if AA not met
        expect(
          ratio,
          [
            `WCAG 2.2 AA FAIL — ${theme} theme`,
            `Token pair: "${pair.name}"`,
            `Scope: ${pair.scope}`,
            `Threshold: ${required}:1 (${pair.threshold})`,
            `Actual ratio: ${fmt(ratio)}:1`,
            `fg=${pair.fg}  bg=${pair.bg}`,
          ].join("\n  "),
        ).toBeGreaterThanOrEqual(required);

        // AC #2: log AAA achievement if goal is declared (no assert — never fails)
        if (pair.aaaGoal) {
          const aaaMet = ratio >= AAA_RATIO;
          const existing = aaaResults.find((r) => r.name === pair.name);
          if (existing) {
            if (theme === "light") existing.lightRatio = ratio;
            else existing.darkRatio = ratio;
          } else {
            aaaResults.push({
              name: pair.name,
              lightRatio: theme === "light" ? ratio : null,
              darkRatio: theme === "dark" ? ratio : null,
            });
          }
          if (aaaMet) {
            console.log(`[AAA] ${theme} | "${pair.name}" — ${fmt(ratio)}:1 ✓`);
          } else {
            console.log(`[AAA gap] ${theme} | "${pair.name}" — ${fmt(ratio)}:1 (need 7:1)`);
          }
        }
      });
    }
  });
}

// ─── Test suites ──────────────────────────────────────────────────────────────

describe("WCAG 2.2 AA contrast harness — semantic token pairs", () => {
  // ─── AAA achievement tracking (AC #2) ──────────────────────────────────────
  // Accumulated across both theme loops; afterAll prints cross-theme summary.
  const aaaResults: {
    name: string;
    lightRatio: number | null;
    darkRatio: number | null;
  }[] = [];

  testTheme("light", LIGHT_PAIRS, aaaResults);
  testTheme("dark", DARK_PAIRS, aaaResults);

  // AC #2: summary of AAA gaps (runs after all individual pair tests)
  afterAll(() => {
    // After all pair tests have run, print a cross-theme summary.
    // Purely informational per AC #2 — no assertions.
    for (const r of aaaResults) {
      const lightOk = r.lightRatio !== null && r.lightRatio >= AAA_RATIO;
      const darkOk = r.darkRatio !== null && r.darkRatio >= AAA_RATIO;

      if (lightOk && darkOk) {
        console.log(`[AAA] BOTH themes | "${r.name}" — AAA achieved`);
      } else if (lightOk && !darkOk) {
        console.log(
          `[AAA gap] "${r.name}" — AAA in LIGHT (${fmt(r.lightRatio!)}:1) but NOT in DARK (${fmt(r.darkRatio ?? 0)}:1)`,
        );
      } else if (!lightOk && darkOk) {
        console.log(
          `[AAA gap] "${r.name}" — AAA in DARK (${fmt(r.darkRatio!)}:1) but NOT in LIGHT (${fmt(r.lightRatio ?? 0)}:1)`,
        );
      } else {
        console.log(
          `[AAA gap] "${r.name}" — AAA in NEITHER theme (light=${fmt(r.lightRatio ?? 0)}:1, dark=${fmt(r.darkRatio ?? 0)}:1)`,
        );
      }
    }
  });
});
