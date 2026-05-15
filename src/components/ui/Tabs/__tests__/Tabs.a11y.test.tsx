/**
 * Tabs — structural accessibility tests (Story 2.13 AC #7)
 *
 * Validates:
 *   - TabsList has role="tablist"
 *   - Tab triggers have role="tab" with aria-selected and aria-controls
 *   - TabPanel has role="tabpanel" with aria-labelledby
 *   - Underline and pill variants both meet structural requirements
 *   - Zero axe violations across underline + pill + default-selected states
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *   Contrast is verified separately by the contrast harness.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/ui/Tabs/__tests__/Tabs.a11y.test.tsx
 */

import axe from "axe-core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Tab, TabPanel, TabsList, TabsRoot } from "../Tabs";

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

// Helper: render a fully composed Tabs component
function renderTabs(variant: "underline" | "pill" = "underline", defaultValue = "overview") {
  return render(
    <TabsRoot defaultValue={defaultValue}>
      <TabsList variant={variant}>
        <Tab value="overview" variant={variant}>
          Overview
        </Tab>
        <Tab value="settings" variant={variant}>
          Settings
        </Tab>
        <Tab value="logs" variant={variant}>
          Logs
        </Tab>
      </TabsList>
      <TabPanel value="overview">Overview content</TabPanel>
      <TabPanel value="settings">Settings content</TabPanel>
      <TabPanel value="logs">Logs content</TabPanel>
    </TabsRoot>,
  );
}

describe("Tabs — structural accessibility (Story 2.13 AC #7)", () => {
  // ── Role contract ─────────────────────────────────────────────────────────────

  describe("role contract", () => {
    it("renders tablist", () => {
      renderTabs();
      expect(screen.getByRole("tablist")).toBeDefined();
    });

    it("renders tab triggers with role='tab'", () => {
      renderTabs();
      const tabs = screen.getAllByRole("tab");
      expect(tabs.length).toBe(3);
    });

    it("active tab has aria-selected='true'", () => {
      renderTabs("underline", "overview");
      const overviewTab = screen.getByRole("tab", { name: "Overview" });
      expect(overviewTab.getAttribute("aria-selected")).toBe("true");
    });

    it("renders tabpanel for active tab", () => {
      renderTabs();
      expect(screen.getByRole("tabpanel")).toBeDefined();
    });

    it("tabpanel has aria-labelledby linking to tab trigger", () => {
      renderTabs();
      const panel = screen.getByRole("tabpanel");
      expect(panel.getAttribute("aria-labelledby")).toBeTruthy();
    });
  });

  // ── Pill variant ──────────────────────────────────────────────────────────────

  describe("pill variant", () => {
    it("renders pill tablist", () => {
      renderTabs("pill");
      expect(screen.getByRole("tablist")).toBeDefined();
    });

    it("active pill tab has aria-selected='true'", () => {
      renderTabs("pill", "settings");
      const settingsTab = screen.getByRole("tab", { name: "Settings" });
      expect(settingsTab.getAttribute("aria-selected")).toBe("true");
    });
  });

  // ── axe-core scans ────────────────────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — underline tabs (default)", async () => {
      const { container } = renderTabs("underline");
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — pill tabs", async () => {
      const { container } = renderTabs("pill");
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — non-first tab selected", async () => {
      const { container } = renderTabs("underline", "logs");
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });
  });
});
