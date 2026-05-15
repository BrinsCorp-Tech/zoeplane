import axe from "axe-core";

/**
 * Default disabled rules for OKLCH+JSDOM compatibility.
 * `color-contrast` cannot be evaluated by axe in JSDOM when tokens use OKLCH;
 * contrast is verified separately by the contrast harness (Story 2.13).
 */
const DEFAULT_RULES: Record<string, { enabled: boolean }> = {
  "color-contrast": { enabled: false },
};

/**
 * Run axe-core against a container element.
 * @param container - the rendered DOM element to scan
 * @param extraDisabled - optional additional axe rules to disable for this call
 *   (e.g. Modal needs `region: { enabled: false }` because Radix portals
 *    content outside the landmark structure)
 */
export function runAxe(
  container: HTMLElement,
  extraDisabled: Record<string, { enabled: boolean }> = {},
): Promise<axe.AxeResults> {
  return new Promise((resolve, reject) => {
    axe.run(container, { rules: { ...DEFAULT_RULES, ...extraDisabled } }, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

/**
 * Convenience wrapper for scanning the entire document body.
 * Useful when content is portaled outside the render container
 * (e.g. Radix Modal/Dropdown/Tooltip).
 */
export function runAxeBody(
  extraDisabled: Record<string, { enabled: boolean }> = {},
): Promise<axe.AxeResults> {
  return runAxe(document.body, extraDisabled);
}

/**
 * Format axe violations into a single-line string suitable for test failure messages.
 */
export function formatViolations(results: axe.AxeResults): string {
  return results.violations.map((v) => `${v.id}: ${v.description}`).join("; ");
}
