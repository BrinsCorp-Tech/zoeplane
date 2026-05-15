/**
 * CollapsiblePane — structural accessibility tests (Story 2.9)
 *
 * Validates:
 *   - aria-expanded on toggle button reflects collapsed state
 *   - aria-hidden on content when collapsed
 *   - Zero axe violations in expanded and collapsed states
 *
 * JSDOM limitation — OKLCH contrast:
 *   JSDOM cannot compute OKLCH colour values; getComputedStyle returns empty
 *   strings for CSS custom properties that reference OKLCH tokens. Therefore:
 *   - axe-core's color-contrast rule is DISABLED in this harness.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/layout/CollapsiblePane/__tests__/CollapsiblePane.a11y.test.tsx
 */

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { CollapsiblePane } from "../CollapsiblePane";

afterEach(() => {
  cleanup();
});

describe("CollapsiblePane — structural accessibility (Story 2.9)", () => {
  // ── Expanded state ──────────────────────────────────────────────────────────

  describe("expanded state", () => {
    it("renders children when defaultCollapsed=false", () => {
      render(
        <CollapsiblePane defaultCollapsed={false}>
          <div data-testid="pane-content">Content</div>
        </CollapsiblePane>,
      );
      expect(screen.getByTestId("pane-content")).toBeDefined();
    });

    it("content container is NOT aria-hidden when expanded", () => {
      const { container } = render(
        <CollapsiblePane defaultCollapsed={false}>
          <div>Content</div>
        </CollapsiblePane>,
      );
      const content = container.querySelector(".collapsible-pane-content");
      expect(content?.getAttribute("aria-hidden")).toBe("false");
    });

    it("toggle button has aria-expanded=true when expanded", () => {
      render(
        <CollapsiblePane
          defaultCollapsed={false}
          renderToggle={({ collapsed, toggle }) => (
            <button aria-expanded={!collapsed} onClick={toggle}>
              Toggle
            </button>
          )}
        >
          <div>Content</div>
        </CollapsiblePane>,
      );
      expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("true");
    });
  });

  // ── Collapsed state ─────────────────────────────────────────────────────────

  describe("collapsed state", () => {
    it("content container is aria-hidden when collapsed", () => {
      const { container } = render(
        <CollapsiblePane defaultCollapsed={true}>
          <div>Content</div>
        </CollapsiblePane>,
      );
      const content = container.querySelector(".collapsible-pane-content");
      expect(content?.getAttribute("aria-hidden")).toBe("true");
    });

    it("toggle button has aria-expanded=false when collapsed", () => {
      render(
        <CollapsiblePane
          defaultCollapsed={true}
          renderToggle={({ collapsed, toggle }) => (
            <button aria-expanded={!collapsed} onClick={toggle}>
              Toggle
            </button>
          )}
        >
          <div>Content</div>
        </CollapsiblePane>,
      );
      expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("false");
    });
  });

  // ── Toggle interaction ──────────────────────────────────────────────────────

  describe("toggle interaction", () => {
    it("toggles collapsed state when toggle is called", () => {
      render(
        <CollapsiblePane
          defaultCollapsed={false}
          renderToggle={({ collapsed, toggle }) => (
            <button aria-expanded={!collapsed} onClick={toggle} data-testid="toggle">
              Toggle
            </button>
          )}
        >
          <div>Content</div>
        </CollapsiblePane>,
      );

      const btn = screen.getByTestId("toggle");
      expect(btn.getAttribute("aria-expanded")).toBe("true");

      fireEvent.click(btn);
      expect(btn.getAttribute("aria-expanded")).toBe("false");

      fireEvent.click(btn);
      expect(btn.getAttribute("aria-expanded")).toBe("true");
    });
  });

  // ── axe-core structural scans ───────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — expanded state with role=navigation", async () => {
      const { container } = render(
        <CollapsiblePane
          defaultCollapsed={false}
          role="navigation"
          aria-label="Primary navigation"
          renderToggle={({ collapsed, toggle }) => (
            <button aria-expanded={!collapsed} onClick={toggle}>
              Toggle navigation
            </button>
          )}
        >
          <nav>
            <ul>
              <li>
                <a href="/">Home</a>
              </li>
            </ul>
          </nav>
        </CollapsiblePane>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — collapsed state", async () => {
      const { container } = render(
        <CollapsiblePane
          defaultCollapsed={true}
          role="navigation"
          aria-label="Primary navigation"
          renderToggle={({ collapsed, toggle }) => (
            <button aria-expanded={!collapsed} onClick={toggle}>
              Toggle navigation
            </button>
          )}
        >
          <nav>
            <ul>
              <li>
                <a href="/">Home</a>
              </li>
            </ul>
          </nav>
        </CollapsiblePane>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — no toggle button, no role", async () => {
      const { container } = render(
        <CollapsiblePane defaultCollapsed={false}>
          <div>Simple content</div>
        </CollapsiblePane>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
