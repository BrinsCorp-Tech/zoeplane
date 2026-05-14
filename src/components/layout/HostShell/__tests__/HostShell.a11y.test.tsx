/**
 * HostShell — structural accessibility tests (Story 2.8 AC #9)
 *
 * Validates:
 *   - Exactly one of each landmark per ARIA spec:
 *       banner (TitleBar), navigation (Sidebar), complementary (Inspector),
 *       contentinfo (StatusBar), main (PrimaryWorkArea)
 *   - No duplicate landmarks from composition
 *   - Zero axe violations (color-contrast disabled — JSDOM cannot compute OKLCH)
 *   - Empty-state placeholder text present when no project is open
 *
 * JSDOM limitation — OKLCH contrast:
 *   axe-core's color-contrast rule is DISABLED (JSDOM cannot compute OKLCH).
 *
 * Tauri invoke() is mocked — StatusBar calls invoke("sidecar_status") on mount.
 * Without a mock, JSDOM throws "Cannot read properties of undefined (reading 'invoke')".
 *
 * useAppStore._setProjectRoot is used to seed project state for the
 * "project open" variant.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/layout/HostShell/__tests__/HostShell.a11y.test.tsx
 */

import axe from "axe-core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HostShell } from "../HostShell";
import { useAppStore } from "@/stores/app";
import { useNotificationsStore } from "@/stores/notifications";
import { useCommandPaletteStore } from "@/stores/commandPalette";

// ─── Mock Tauri invoke ────────────────────────────────────────────────────────
//
// @tauri-apps/api/core is not available in JSDOM. We mock the module so
// StatusBar (composed inside HostShell) can mount without crashing.

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({ running: true, pid: 1234, version: "1.0.0" }),
}));

// ─── Test setup ───────────────────────────────────────────────────────────────
//
// Story 2.10: CommandPalette and NotificationsCenter are mounted in HostShell.
// Both are closed by default (open=false / centerOpen=false) so they do NOT
// add dialog landmarks to the ARIA tree. We reset both stores in setup/teardown
// to ensure test isolation.

afterEach(() => {
  cleanup();
  useAppStore.getState()._setProjectRoot(null);
  useNotificationsStore.getState().clearAll();
  useNotificationsStore.getState().closeCenter();
  useCommandPaletteStore.setState({ actions: [], open: false });
  vi.clearAllMocks();
});

beforeEach(() => {
  useAppStore.getState()._setProjectRoot(null);
  useNotificationsStore.getState().clearAll();
  useNotificationsStore.getState().closeCenter();
  useCommandPaletteStore.setState({ actions: [], open: false });
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

describe("HostShell — structural accessibility (Story 2.8 AC #9)", () => {
  // ── Landmark composition ────────────────────────────────────────────────────

  describe("landmark composition — exactly one of each", () => {
    it("renders exactly one banner landmark (TitleBar)", () => {
      render(<HostShell />);
      expect(screen.getAllByRole("banner")).toHaveLength(1);
    });

    it("renders exactly one navigation landmark (Sidebar)", () => {
      render(<HostShell />);
      expect(screen.getAllByRole("navigation")).toHaveLength(1);
    });

    it("renders exactly one complementary landmark (Inspector)", () => {
      render(<HostShell />);
      expect(screen.getAllByRole("complementary")).toHaveLength(1);
    });

    it("renders exactly one contentinfo landmark (StatusBar)", () => {
      render(<HostShell />);
      expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
    });

    it("renders exactly one main landmark (PrimaryWorkArea)", () => {
      render(<HostShell />);
      expect(screen.getAllByRole("main")).toHaveLength(1);
    });
  });

  // ── Empty-state placeholder ─────────────────────────────────────────────────
  //
  // NOTE: "No project open" appears twice when no project is set:
  //   1. The PrimaryWorkArea empty-state heading (HostShell's placeholder)
  //   2. The StatusBar project-root field (StatusBar's own "No project open" text)
  // We assert using getAllByText to handle both and verify at least one exists,
  // and scope the heading check to the main landmark to be precise.

  describe("empty-state placeholder — no project open", () => {
    it("renders 'No project open' text (at least once) when projectRoot is null", () => {
      render(<HostShell />);
      // getAllByText throws if ZERO matches; asserts presence without count constraint
      expect(screen.getAllByText("No project open").length).toBeGreaterThan(0);
    });

    it("renders 'No project open' heading inside the main landmark", () => {
      render(<HostShell />);
      const main = screen.getByRole("main");
      // The main region must contain the empty-state heading
      expect(main.textContent).toContain("No project open");
    });

    it("renders 'Open a project to get started' subtext when projectRoot is null", () => {
      render(<HostShell />);
      expect(screen.getByText("Open a project to get started")).toBeDefined();
    });
  });

  // ── Children prop bypass ────────────────────────────────────────────────────

  describe("children prop — bypasses project-state branch", () => {
    it("renders children content inside PrimaryWorkArea when provided", () => {
      render(
        <HostShell>
          <p data-testid="injected-content">Story content</p>
        </HostShell>,
      );
      expect(screen.getByTestId("injected-content")).toBeDefined();
    });

    it("does NOT render the empty-state heading inside main when children are provided", () => {
      render(
        <HostShell>
          <div>Custom content</div>
        </HostShell>,
      );
      // StatusBar still shows "No project open" in its project-root field —
      // that is correct. We only verify the HostShell empty-state heading
      // (which lives inside <main>) is absent from the main region.
      const main = screen.getByRole("main");
      expect(main.textContent).not.toContain("Open a project to get started");
    });
  });

  // ── Project open state ──────────────────────────────────────────────────────

  describe("project open state", () => {
    it("renders Epic 03 placeholder (not empty-state) when a project is open", () => {
      useAppStore.getState()._setProjectRoot("/Users/example/project");
      render(<HostShell />);
      expect(screen.queryByText("No project open")).toBeNull();
      expect(screen.getByText(/Epic 03 wires route rendering/)).toBeDefined();
    });
  });

  // ── axe-core structural scans ───────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — empty-state (no project open)", async () => {
      const { container } = render(<HostShell />);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — project open", async () => {
      useAppStore.getState()._setProjectRoot("/Users/example/project");
      const { container } = render(<HostShell />);
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — children prop variant", async () => {
      const { container } = render(
        <HostShell>
          <p>Custom story content</p>
        </HostShell>,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });
  });
});
