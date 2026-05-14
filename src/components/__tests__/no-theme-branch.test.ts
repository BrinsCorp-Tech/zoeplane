// @vitest-environment node
/**
 * AC6 — No theme branching in component JSX
 *
 * ZoePlane components must NEVER branch their JSX or className logic on the
 * resolved theme value ("light" / "dark"). All theming is done via CSS custom
 * properties referenced by Tailwind utilities and the [data-theme="dark"]
 * attribute selector on <html>.
 *
 * Rationale: if a component branches on theme in JSX, it creates a coupling
 * between component logic and the design token layer. The ThemeProvider +
 * tokens.css system is designed so components never need to know which theme
 * is active — the correct token values are automatically in scope.
 *
 * This test scans all .tsx files under src/components/ for patterns that
 * indicate theme-based conditional rendering or class selection. It ignores
 * the ThemeProvider itself (which legitimately references "light"/"dark" as
 * values it manages, not as branch conditions in JSX).
 *
 * Patterns detected:
 *   - theme === 'dark' or theme === "dark"  (explicit dark-mode branch)
 *   - theme === 'light' or theme === "light" (explicit light-mode branch)
 *   - isDark or isLight  (boolean theme-branch variable patterns)
 *   - data-theme.*dark   (inline data-theme attribute set on a child element)
 *
 * The ThemeProvider.tsx is excluded — it sets data-theme on <html> at the
 * root and is the canonical owner of that responsibility.
 *
 * If this test fails:
 *   1. Locate the flagged file and offending line.
 *   2. Remove the theme branch.
 *   3. Achieve the visual difference via CSS custom properties + [data-theme="dark"]
 *      in a .css module or tokens.css semantic token.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// ─── Configuration ────────────────────────────────────────────────────────────

const COMPONENTS_DIR = join(__dirname, "..");

/** Files that are exempt from the theme-branch rule. */
const EXCLUDED_FILES = new Set([
  // ThemeProvider legitimately references light/dark as managed values.
  join(COMPONENTS_DIR, "theme", "ThemeProvider.tsx"),
  // Toast.tsx reads data-theme ONCE to pass Sonner's `theme` prop (third-party
  // library interop). This is not a JSX theme branch — it does not produce
  // conditional rendering or classNames. The third-party Sonner library has no
  // knowledge of ZoePlane's data-theme attribute, so the prop must be explicit.
  join(COMPONENTS_DIR, "ui", "Toast", "Toast.tsx"),
  // Skeleton.stories.tsx uses data-theme="dark" and data-theme="light" as static
  // attributes on wrapper <div>s in the ThemeContrast story to create a
  // side-by-side visual-regression / theme-contrast panel in Storybook. This is a
  // story-level visualization concern (not component-level theme branching). The
  // test's intent is to prevent COMPONENT files from branching on theme; story
  // files used for visual contrast verification are explicitly permitted.
  join(COMPONENTS_DIR, "ui", "Skeleton", "Skeleton.stories.tsx"),
  // Story 2.11 skeleton variant + LibraryShell stories — same exemption rationale
  // as Skeleton.stories.tsx: ThemeContrast stories use static data-theme wrappers
  // as Storybook side-by-side visual contrast panels (not runtime JSX branching).
  join(COMPONENTS_DIR, "ui", "Skeleton", "CardSkeleton.stories.tsx"),
  join(COMPONENTS_DIR, "ui", "Skeleton", "RouteSkeleton.stories.tsx"),
  join(COMPONENTS_DIR, "ui", "Skeleton", "StreamSkeleton.stories.tsx"),
  join(COMPONENTS_DIR, "library-shell", "LibraryShell.stories.tsx"),
  // Sprint 2 Wave 2 layout-tier stories — same exemption rationale as the
  // Skeleton family + LibraryShell: ThemeContrast / dark-theme variants are
  // Storybook visual-regression panels using static `data-theme` wrappers
  // (not runtime JSX branching in production components). Stories 2.8 + 2.9 +
  // 2.10 ship light + dark snapshot pairs for Chromatic per AC #8 / #10 / #10.
  join(COMPONENTS_DIR, "layout", "CollapsiblePane", "CollapsiblePane.stories.tsx"),
  join(COMPONENTS_DIR, "layout", "Sidebar", "Sidebar.stories.tsx"),
  join(COMPONENTS_DIR, "layout", "Inspector", "Inspector.stories.tsx"),
  join(COMPONENTS_DIR, "layout", "TitleBar", "TitleBar.stories.tsx"),
  join(COMPONENTS_DIR, "layout", "StatusBar", "StatusBar.stories.tsx"),
  join(COMPONENTS_DIR, "layout", "TabStrip", "TabStrip.stories.tsx"),
  join(COMPONENTS_DIR, "layout", "PrimaryWorkArea", "PrimaryWorkArea.stories.tsx"),
  join(COMPONENTS_DIR, "layout", "HostShell", "HostShell.stories.tsx"),
  join(COMPONENTS_DIR, "layout", "CommandPalette", "CommandPalette.stories.tsx"),
  join(COMPONENTS_DIR, "layout", "NotificationsCenter", "NotificationsCenter.stories.tsx"),
]);

/** Directories that are excluded from scanning (test files may reference these patterns). */
const EXCLUDED_DIR_SEGMENTS = ["__tests__"];

/** Patterns that indicate a theme branch in component JSX. */
const THEME_BRANCH_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /theme\s*===\s*['"]dark['"]/g, label: 'theme === "dark"' },
  { re: /theme\s*===\s*['"]light['"]/g, label: 'theme === "light"' },
  { re: /isDark\b/g, label: "isDark variable" },
  { re: /isLight\b/g, label: "isLight variable" },
  { re: /data-theme.*dark/g, label: 'inline data-theme="dark" on child element' },
  {
    re: /\bdark:/g,
    label: "Tailwind dark: variant in component className (use semantic token instead)",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively collect .tsx files from a directory, skipping __tests__ subdirectories. */
function collectTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      // Skip test directories — test files may reference theme patterns in
      // assertions (e.g., asserting that data-theme="dark" is NOT present in
      // production components). Those references are not production JSX.
      if (EXCLUDED_DIR_SEGMENTS.includes(entry)) continue;
      results.push(...collectTsxFiles(fullPath));
    } else if (entry.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Test ─────────────────────────────────────────────────────────────────────

describe("No theme branching in component JSX (AC6)", () => {
  it("should contain no theme-conditional JSX patterns in src/components/**/*.tsx", () => {
    const allFiles = collectTsxFiles(COMPONENTS_DIR);
    const violations: string[] = [];

    for (const filePath of allFiles) {
      if (EXCLUDED_FILES.has(filePath)) continue;

      const source = readFileSync(filePath, "utf-8");
      const lines = source.split("\n");

      for (const { re, label } of THEME_BRANCH_PATTERNS) {
        for (let i = 0; i < lines.length; i++) {
          if (re.test(lines[i])) {
            violations.push(
              `${filePath}:${i + 1} — detected "${label}" — remove theme branch, use CSS custom properties instead`,
            );
          }
          // Reset lastIndex for global regexes between lines
          re.lastIndex = 0;
        }
      }
    }

    if (violations.length > 0) {
      const message = [
        `Found ${violations.length} theme-branching violation(s) in components:`,
        ...violations.map((v) => `  - ${v}`),
        "",
        "Fix: use CSS custom properties + [data-theme='dark'] selectors instead of JSX conditionals.",
      ].join("\n");
      expect.fail(message);
    }
  });
});
