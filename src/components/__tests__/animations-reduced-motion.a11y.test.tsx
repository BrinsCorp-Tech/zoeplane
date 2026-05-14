// @vitest-environment node
/**
 * AC #7 close-out — No infinite animations visible under reduced-motion
 *
 * Verifies the CSS contract: every animation class that runs an infinite loop
 * in default mode MUST have a corresponding `.prefers-reduced-motion .X { animation: none }`
 * rule in animations.css (the class-based fallback block). This ensures the
 * Storybook reduced-motion decorator and any JavaScript-side `.prefers-reduced-motion`
 * class toggle stop infinite animations completely.
 *
 * Why source-CSS parse instead of JSDOM computed-style:
 *   JSDOM does not apply external stylesheet rules — getComputedStyle returns
 *   empty strings for class-selector rules. Parsing the CSS source directly
 *   is the correct approach for verifying the stylesheet contract in a
 *   unit-test environment. The invariant is: "infinite animation → must have
 *   an animation: none override in the .prefers-reduced-motion class block."
 *
 * AC #7 exact text:
 *   "WHEN axe-core runs against animation Storybook stories with reduced-motion
 *    enabled, the system shall confirm no infinite/repeating animations remain
 *    visible."
 *
 * Approach:
 *   1. Read animations.css source.
 *   2. Find all animation class declarations that contain `infinite` (default mode).
 *   3. For each such class, assert a `.prefers-reduced-motion .X { animation: none }`
 *      rule exists in the class-based fallback section.
 *   4. Assert the set of infinite classes matches the known catalog exactly
 *      (guards against future additions that forget the reduced-motion override).
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/__tests__/animations-reduced-motion.a11y.test.tsx
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ─── Configuration ────────────────────────────────────────────────────────────

const ANIMATIONS_CSS_PATH = join(__dirname, "..", "..", "styles", "animations.css");

/**
 * Known infinite-loop animation classes in the catalog.
 * This list is intentionally explicit — any new infinite animation must be
 * added here AND must have a .prefers-reduced-motion override in animations.css.
 * If this set drifts from what the CSS file contains, the test below fails and
 * forces the author to add the override.
 */
const KNOWN_INFINITE_CLASSES = new Set([
  "animate-A-01-skeleton-shimmer", // 1.2s infinite shimmer
  "animate-A-02-cursor-blink", // 1.2s infinite opacity blink
  "animate-A-12-approval-pulse", // 1.5s infinite border-color pulse
  "animate-A-38-shield-pulse", // 1.5s × 3 iterations (finite but repeating)
]);

// A-38-shield-pulse uses 3 iterations (not `infinite`), but still repeats
// and must be zeroed under reduced-motion per ux-spec. We include it in the
// known set so the override check covers it.
const REPEATING_CLASSES = new Set([
  "animate-A-38-shield-pulse", // 3 iterations explicit repeat
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract all CSS class names whose default declaration contains `infinite`
 * (marking them as infinite-loop animations).
 *
 * Strategy: scan the CSS source for patterns matching:
 *   .animate-<id> { ... infinite ... }
 * We do this by finding each `.animate-` rule block and checking if it
 * contains the `infinite` keyword within the same rule's animation shorthand.
 */
function findInfiniteAnimationClasses(css: string): Set<string> {
  const found = new Set<string>();

  // Match top-level class rules (outside @media blocks) containing `infinite`.
  // We split on `}` boundaries and look for .animate- class selectors followed
  // by a declaration containing `infinite`.
  //
  // Simple approach: extract class name + rule body pairs via regex, then
  // check each body for `infinite`.
  const classRulePattern = /^\.(animate-[\w-]+)\s*\{([^}]*)\}/gm;
  let match: RegExpExecArray | null;

  // Flatten the CSS to single-pass by removing @keyframes and @media blocks
  // so our top-level class scan doesn't pick up nested rules.
  const strippedCss = stripAtBlocks(css);

  while ((match = classRulePattern.exec(strippedCss)) !== null) {
    const className = match[1];
    const body = match[2];
    if (/\binfinite\b/.test(body)) {
      found.add(className);
    }
  }

  return found;
}

/**
 * Find all classes that have a .prefers-reduced-motion override with
 * `animation: none` or `animation-name: none` or simply `animation: none`.
 */
function findReducedMotionNoneClasses(css: string): Set<string> {
  const found = new Set<string>();

  // Match: .prefers-reduced-motion .animate-<id> { ... animation: none ... }
  // We look for the class-based fallback block specifically.
  const reducedPattern = /\.prefers-reduced-motion\s+\.(animate-[\w-]+)\s*\{([^}]*)\}/gm;
  let match: RegExpExecArray | null;

  while ((match = reducedPattern.exec(css)) !== null) {
    const className = match[1];
    const body = match[2];
    // Check for `animation: none` or `animation-name: none`
    if (/animation\s*:\s*none/.test(body) || /animation-name\s*:\s*none/.test(body)) {
      found.add(className);
    }
  }

  return found;
}

/**
 * Remove @keyframes and @media blocks from CSS so top-level class selectors
 * can be extracted without matching nested content.
 */
function stripAtBlocks(css: string): string {
  // Remove @keyframes blocks (may be nested with {})
  let result = css.replace(/@keyframes[^{]*\{(?:[^{}]*|\{[^{}]*\})*\}/g, "");
  // Remove @media blocks
  result = result.replace(/@media[^{]*\{(?:[^{}]*|\{[^{}]*\})*\}/g, "");
  return result;
}

/**
 * Extract the body of `@media (prefers-reduced-motion: reduce) { ... }` by
 * scanning brace depth from the opening `{` to the matching `}`. This handles
 * the multi-rule block that has multiple nested class `{ ... }` pairs inside.
 *
 * Skips occurrences inside CSS comments (which start with slash-star).
 * Returns null if the actual rule block is not found.
 */
function extractMediaReduceBody(css: string): string | null {
  const marker = "@media (prefers-reduced-motion: reduce)";
  let searchFrom = 0;

  while (searchFrom < css.length) {
    const markerIdx = css.indexOf(marker, searchFrom);
    if (markerIdx === -1) return null;

    // Check if this occurrence is inside a comment block (look back for /*)
    // A simple heuristic: find the last /* before this position and check
    // if there's no */ between that /* and the marker.
    const precedingText = css.slice(0, markerIdx);
    const lastCommentOpen = precedingText.lastIndexOf("/*");
    const lastCommentClose = precedingText.lastIndexOf("*/");

    if (lastCommentOpen !== -1 && lastCommentOpen > lastCommentClose) {
      // We're inside a comment block — skip this occurrence.
      searchFrom = markerIdx + marker.length;
      continue;
    }

    // Find the opening brace of the @media block.
    const openBrace = css.indexOf("{", markerIdx);
    if (openBrace === -1) return null;

    // Walk forward tracking brace depth to find the matching closing brace.
    let depth = 1;
    let i = openBrace + 1;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }

    // Return the content between the outer braces.
    return css.slice(openBrace + 1, i - 1);
  }

  return null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AC #7 — No infinite/repeating animations under reduced-motion", () => {
  const css = readFileSync(ANIMATIONS_CSS_PATH, "utf-8");

  it("animations.css exists and is non-empty", () => {
    expect(css.length).toBeGreaterThan(100);
  });

  it("all classes with `infinite` in animations.css are in the known catalog", () => {
    const infiniteClasses = findInfiniteAnimationClasses(css);

    // Every class with `infinite` must be in KNOWN_INFINITE_CLASSES.
    // If a new infinite animation was added without updating this test, it fails here.
    for (const cls of infiniteClasses) {
      expect(
        KNOWN_INFINITE_CLASSES.has(cls),
        `Class ".${cls}" uses \`infinite\` but is not in KNOWN_INFINITE_CLASSES. ` +
          `Add it to the known set AND add a .prefers-reduced-motion override.`,
      ).toBe(true);
    }
  });

  it("every known infinite-loop class has a .prefers-reduced-motion { animation: none } override", () => {
    const reducedClasses = findReducedMotionNoneClasses(css);

    // Every class in KNOWN_INFINITE_CLASSES must have an explicit `animation: none`
    // override in the .prefers-reduced-motion block.
    for (const cls of KNOWN_INFINITE_CLASSES) {
      // A-38-shield-pulse is a 3-iteration repeat (not `infinite` keyword) but
      // still requires the override. It's in KNOWN_INFINITE_CLASSES for coverage.
      expect(
        reducedClasses.has(cls),
        `Class ".${cls}" is an infinite/repeating animation but has no ` +
          `.prefers-reduced-motion .${cls} { animation: none } override in animations.css. ` +
          `Add it to the class-based fallback block.`,
      ).toBe(true);
    }
  });

  it("known repeating classes (non-infinite keyword) also have reduced-motion overrides", () => {
    const reducedClasses = findReducedMotionNoneClasses(css);

    for (const cls of REPEATING_CLASSES) {
      expect(
        reducedClasses.has(cls),
        `Class ".${cls}" repeats but has no .prefers-reduced-motion override.`,
      ).toBe(true);
    }
  });

  it("A-12 approval pulse has animation: none in @media (prefers-reduced-motion: reduce) block", () => {
    // Belt-and-suspenders check on the @media block specifically for the most
    // critical infinite animation (A-12) which existed before Batch D.
    // We extract the @media body by finding the opening brace and scanning
    // to the matching closing brace (handles multi-rule blocks correctly).
    const mediaBody = extractMediaReduceBody(css);
    expect(
      mediaBody,
      "@media (prefers-reduced-motion: reduce) block not found in animations.css",
    ).not.toBeNull();

    expect(
      /\.animate-A-12-approval-pulse\s*\{[^}]*animation\s*:\s*none/.test(mediaBody!),
      "A-12 approval pulse must have `animation: none` inside @media (prefers-reduced-motion: reduce)",
    ).toBe(true);
  });

  it("A-01 skeleton shimmer has animation: none in @media (prefers-reduced-motion: reduce) block", () => {
    const mediaBody = extractMediaReduceBody(css);
    expect(mediaBody).not.toBeNull();

    expect(
      /\.animate-A-01-skeleton-shimmer\s*\{[^}]*animation\s*:\s*none/.test(mediaBody!),
      "A-01 skeleton shimmer must have `animation: none` inside @media (prefers-reduced-motion: reduce)",
    ).toBe(true);
  });

  it("A-02 cursor blink has animation: none in @media (prefers-reduced-motion: reduce) block", () => {
    const mediaBody = extractMediaReduceBody(css);
    expect(mediaBody).not.toBeNull();

    expect(
      /\.animate-A-02-cursor-blink\s*\{[^}]*animation\s*:\s*none/.test(mediaBody!),
      "A-02 cursor blink must have `animation: none` inside @media (prefers-reduced-motion: reduce)",
    ).toBe(true);
  });

  it("A-38 shield pulse has animation: none in @media (prefers-reduced-motion: reduce) block", () => {
    const mediaBody = extractMediaReduceBody(css);
    expect(mediaBody).not.toBeNull();

    expect(
      /\.animate-A-38-shield-pulse\s*\{[^}]*animation\s*:\s*none/.test(mediaBody!),
      "A-38 shield pulse must have `animation: none` inside @media (prefers-reduced-motion: reduce)",
    ).toBe(true);
  });
});
