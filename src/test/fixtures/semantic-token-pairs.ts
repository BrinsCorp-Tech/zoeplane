/**
 * semantic-token-pairs.ts
 *
 * Single source of truth for WCAG 2.2 contrast verification pairs.
 *
 * Architecture note (references ADR-004):
 *   All colors are expressed as OKLCH literals — the same colorspace used by
 *   ZoePlane's design token cascade (three-tier architecture; see ADR-004 and
 *   docs/design/dark-mode-architecture.md v1.1).
 *
 *   These values are resolved by hand from src/styles/tokens.css:
 *     - Layer 1 (primitives): oklch(...) literals defined in :root
 *     - Layer 2 (semantic): var() references resolved to their primitive values
 *     - Layer 3 (component): not listed here — all component tokens alias semantic tokens
 *
 *   The harness (contrast-harness.a11y.test.ts) reads these pairs and calls
 *   culori's `wcagContrast()` — OKLCH-native, no conversion step required.
 *
 *   Threshold values per WCAG 2.2 SC 1.4.3 / 1.4.11:
 *     - 4.5 : body text (< 18 pt normal, < 14 pt bold) — AA minimum
 *     - 3.0 : large text (≥ 18 pt normal, ≥ 14 pt bold) and non-text UI
 *     - 7.0 : AAA body text
 *
 * Usage:
 *   import { LIGHT_PAIRS, DARK_PAIRS } from "@/test/fixtures/semantic-token-pairs";
 */

export type Threshold = "body-text" | "large-or-ui";
export type AaaGoal = "7:1";

export interface TokenPair {
  /** Human-readable name for this pair — used in test failure messages. */
  name: string;
  /** Foreground OKLCH literal (resolved from the semantic token). */
  fg: string;
  /** Background OKLCH literal (resolved from the semantic token). */
  bg: string;
  /**
   * WCAG 2.2 AA threshold class:
   *   "body-text"     → 4.5:1 minimum
   *   "large-or-ui"   → 3.0:1 minimum (large text and non-text UI controls)
   */
  threshold: Threshold;
  /**
   * Optional: if present, the harness will also test for AAA (7:1).
   * Failures here log but never fail the suite (per AC #2).
   */
  aaaGoal?: AaaGoal;
  /** Scope note for documentation — not used in assertions. */
  scope: string;
}

// ─── Primitive OKLCH literals (Layer 1 resolved values) ──────────────────────
// These map 1:1 to the definitions in src/styles/tokens.css @layer tokens.base.
// Named for readability — used only in this file's pair definitions below.

const P = {
  // Neutrals
  gray50: "oklch(0.985 0.002 250)",
  gray100: "oklch(0.965 0.003 250)",
  gray200: "oklch(0.920 0.005 250)",
  gray300: "oklch(0.860 0.007 250)",
  gray400: "oklch(0.730 0.010 250)",
  gray500: "oklch(0.580 0.012 250)",
  gray600: "oklch(0.460 0.012 250)",
  gray700: "oklch(0.340 0.012 250)",
  gray800: "oklch(0.230 0.010 250)",
  gray850: "oklch(0.180 0.010 250)",
  gray900: "oklch(0.140 0.008 250)",
  gray950: "oklch(0.090 0.005 250)",
  gray975: "oklch(0.060 0.003 250)",

  // Brand accent (hue 260)
  accent100: "oklch(0.940 0.040 260)",
  accent200: "oklch(0.890 0.080 260)",
  accent400: "oklch(0.720 0.150 260)",
  accent500: "oklch(0.640 0.180 260)",
  accent600: "oklch(0.560 0.200 260)",
  accent700: "oklch(0.480 0.180 260)",
  accent800: "oklch(0.400 0.150 260)",

  // Status
  success400: "oklch(0.760 0.150 150)",
  success500: "oklch(0.660 0.170 150)",
  success600: "oklch(0.540 0.170 150)",
  warn400: "oklch(0.800 0.150 75)",
  warn500: "oklch(0.720 0.170 75)",
  warn600: "oklch(0.620 0.170 75)",
  danger400: "oklch(0.700 0.180 25)",
  danger500: "oklch(0.620 0.220 25)",
  danger600: "oklch(0.540 0.220 25)",
  info400: "oklch(0.720 0.130 220)",
  info500: "oklch(0.620 0.150 220)",
  info600: "oklch(0.540 0.150 220)",
  quarantine400: "oklch(0.700 0.150 320)",
  quarantine500: "oklch(0.580 0.170 320)",
  quarantine600: "oklch(0.480 0.170 320)",

  // Whites
  white: "oklch(1 0 0)",
} as const;

// ─── LIGHT THEME PAIRS ────────────────────────────────────────────────────────
// Resolved from :root / :root[data-theme="light"] in src/styles/tokens.css

export const LIGHT_PAIRS: TokenPair[] = [
  // ── Body text on main surfaces ────────────────────────────────────────────
  {
    name: "foreground on background (body text)",
    fg: P.gray900, // --color-foreground → --gray-900
    bg: P.gray50, // --color-background → --gray-50
    threshold: "body-text",
    aaaGoal: "7:1",
    scope: "light / all body text",
  },
  {
    name: "foreground on surface (body text)",
    fg: P.gray900, // --color-foreground
    bg: P.white, // --color-surface → white
    threshold: "body-text",
    aaaGoal: "7:1",
    scope: "light / card and panel body text",
  },
  {
    name: "foreground-muted on background",
    fg: P.gray600, // --color-foreground-muted → --gray-600
    bg: P.gray50, // --color-background
    threshold: "body-text",
    scope: "light / supporting / helper text",
  },
  {
    name: "foreground-muted on surface",
    fg: P.gray600, // --color-foreground-muted
    bg: P.white, // --color-surface
    threshold: "body-text",
    scope: "light / card description / muted text",
  },
  {
    name: "foreground-subtle on background (large-or-ui)",
    fg: P.gray500, // --color-foreground-subtle → --gray-500
    bg: P.gray50, // --color-background
    threshold: "large-or-ui",
    scope: "light / placeholder and decorative copy — large text only",
  },

  // ── Accent / interactive ───────────────────────────────────────────────────
  {
    name: "accent-foreground on accent (primary button text)",
    fg: P.white, // --color-accent-foreground → white
    bg: P.accent600, // --color-accent → --accent-600
    threshold: "body-text",
    scope: "light / Button primary label",
  },
  {
    name: "accent-foreground on accent-hover (button hover text)",
    fg: P.white, // --color-accent-foreground
    bg: P.accent700, // --color-accent-hover
    threshold: "body-text",
    scope: "light / Button primary hover label",
  },

  // ── Status: success ───────────────────────────────────────────────────────
  {
    name: "success-foreground on success (badge/pill text)",
    fg: P.white, // --color-success-foreground → white
    bg: P.success600, // --color-success → --success-600
    threshold: "body-text",
    scope: "light / EvaluatorStatusBadge success / Badge success",
  },

  // ── Status: warning (white foreground known to fail — gray-900 is correct) ──
  {
    name: "warning-foreground on warning (badge text)",
    fg: P.gray900, // --color-warning-foreground → --gray-900 (both themes)
    bg: P.warn600, // --color-warning → --warn-600
    threshold: "body-text",
    scope: "light / warning badge — foreground is dark (yellow + white fails)",
  },

  // ── Status: danger ────────────────────────────────────────────────────────
  {
    name: "danger-foreground on danger (badge/button text)",
    fg: P.white, // --color-danger-foreground → white
    bg: P.danger600, // --color-danger → --danger-600
    threshold: "body-text",
    scope: "light / destructive button label / danger badge",
  },

  // ── Status: info ──────────────────────────────────────────────────────────
  {
    name: "info-foreground on info",
    fg: P.white, // --color-info-foreground → white
    bg: P.info600, // --color-info → --info-600
    threshold: "body-text",
    scope: "light / info badge (Soft Notification pending review)",
  },

  // ── Status: quarantine ────────────────────────────────────────────────────
  {
    name: "quarantine-foreground on quarantine",
    fg: P.white, // --color-quarantine-foreground → white
    bg: P.quarantine600, // --color-quarantine → --quarantine-600
    threshold: "body-text",
    scope: "light / EvaluatorStatusBadge quarantined",
  },

  // ── Code / mono ───────────────────────────────────────────────────────────
  {
    name: "code-foreground on code-background",
    fg: P.gray900, // --color-code-foreground → --gray-900
    bg: P.gray100, // --color-code-background → --gray-100
    threshold: "body-text",
    scope: "light / inline code and mono output",
  },
];

// ─── DARK THEME PAIRS ─────────────────────────────────────────────────────────
// Resolved from :root[data-theme="dark"] in src/styles/tokens.css

export const DARK_PAIRS: TokenPair[] = [
  // ── Body text on main surfaces ────────────────────────────────────────────
  {
    name: "foreground on background (body text)",
    fg: P.gray50, // --color-foreground → --gray-50
    bg: P.gray950, // --color-background → --gray-950
    threshold: "body-text",
    aaaGoal: "7:1",
    scope: "dark / all body text",
  },
  {
    name: "foreground on surface (body text)",
    fg: P.gray50, // --color-foreground
    bg: P.gray900, // --color-surface → --gray-900
    threshold: "body-text",
    aaaGoal: "7:1",
    scope: "dark / card and panel body text",
  },
  {
    name: "foreground-muted on background",
    fg: P.gray400, // --color-foreground-muted → --gray-400
    bg: P.gray950, // --color-background
    threshold: "body-text",
    scope: "dark / supporting / helper text",
  },
  {
    name: "foreground-muted on surface",
    fg: P.gray400, // --color-foreground-muted
    bg: P.gray900, // --color-surface
    threshold: "body-text",
    scope: "dark / card description / muted text",
  },
  {
    name: "foreground-subtle on background (large-or-ui)",
    fg: P.gray500, // --color-foreground-subtle → --gray-500
    bg: P.gray950, // --color-background
    threshold: "large-or-ui",
    scope: "dark / placeholder and decorative copy — large text only",
  },

  // ── Accent / interactive ───────────────────────────────────────────────────
  {
    name: "accent-foreground on accent (primary button text)",
    fg: P.gray950, // --color-accent-foreground → --gray-950 (inverted in dark)
    bg: P.accent400, // --color-accent → --accent-400
    threshold: "body-text",
    scope: "dark / Button primary label",
  },
  {
    name: "accent-foreground on accent-hover (button hover text)",
    fg: P.gray950, // --color-accent-foreground
    bg: P.accent200, // --color-accent-hover → --accent-200 (brighter in dark)
    threshold: "body-text",
    scope: "dark / Button primary hover label",
  },

  // ── Status: success ───────────────────────────────────────────────────────
  {
    name: "success-foreground on success (badge/pill text)",
    fg: P.gray950, // --color-success-foreground → --gray-950 (inverted in dark)
    bg: P.success400, // --color-success → --success-400
    threshold: "body-text",
    scope: "dark / EvaluatorStatusBadge success / Badge success",
  },

  // ── Status: warning ───────────────────────────────────────────────────────
  {
    name: "warning-foreground on warning (badge text)",
    fg: P.gray950, // --color-warning-foreground → --gray-950 (both themes dark)
    bg: P.warn400, // --color-warning → --warn-400
    threshold: "body-text",
    scope: "dark / warning badge — foreground stays dark",
  },

  // ── Status: danger ────────────────────────────────────────────────────────
  {
    name: "danger-foreground on danger (badge/button text)",
    fg: P.gray950, // --color-danger-foreground → --gray-950
    bg: P.danger400, // --color-danger → --danger-400
    threshold: "body-text",
    scope: "dark / destructive button label / danger badge",
  },

  // ── Status: info ──────────────────────────────────────────────────────────
  {
    name: "info-foreground on info",
    fg: P.gray950, // --color-info-foreground → --gray-950
    bg: P.info400, // --color-info → --info-400
    threshold: "body-text",
    scope: "dark / info badge",
  },

  // ── Status: quarantine ────────────────────────────────────────────────────
  {
    name: "quarantine-foreground on quarantine",
    fg: P.gray950, // --color-quarantine-foreground → --gray-950
    bg: P.quarantine400, // --color-quarantine → --quarantine-400
    threshold: "body-text",
    scope: "dark / EvaluatorStatusBadge quarantined",
  },

  // ── Code / mono ───────────────────────────────────────────────────────────
  {
    name: "code-foreground on code-background",
    fg: P.gray100, // --color-code-foreground → --gray-100
    bg: P.gray975, // --color-code-background → --gray-975
    threshold: "body-text",
    scope: "dark / inline code and mono output",
  },
];

// ─── Threshold ratios ─────────────────────────────────────────────────────────

export const THRESHOLD_RATIOS: Record<Threshold, number> = {
  "body-text": 4.5,
  "large-or-ui": 3.0,
};

export const AAA_RATIO = 7.0;
