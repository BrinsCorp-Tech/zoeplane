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
 *   - Library view routing: "agents" → AgentLibraryView, "skills" → SkillLibraryView
 *   - Unmapped nav item → Epic 03 placeholder; null → same
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
 * Sprint 5 (Epic 06) additions:
 *   AgentLibraryView and SkillLibraryView are now rendered by HostShell when the
 *   active nav item is "agents" or "skills". Both views call fetchAssets and
 *   subscribe to SSE on mount; the relevant modules are mocked so no real HTTP or
 *   SSE activity occurs. TanStack QueryClientProvider wraps the new test cases.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/layout/HostShell/__tests__/HostShell.a11y.test.tsx
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { HostShell } from "../HostShell";
import { useAppStore } from "@/stores/app";
import { useNotificationsStore } from "@/stores/notifications";
import { useCommandPaletteStore } from "@/stores/commandPalette";
import { useActiveNav } from "@/stores/active-nav";
import { useAssetNav } from "@/stores/asset-nav";

// ─── Mock Tauri invoke ────────────────────────────────────────────────────────
//
// @tauri-apps/api/core is not available in JSDOM. We mock the module so
// StatusBar (composed inside HostShell) can mount without crashing.

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({ running: true, pid: 1234, version: "1.0.0" }),
}));

// ─── Mock sidecar-client (Sprint 5 addition) ─────────────────────────────────
//
// AgentLibraryView and SkillLibraryView call getSidecarBaseUrl() and
// subscribeSidecarPort() on mount. Return null so queries stay disabled and
// no real HTTP or SSE activity occurs in these structural tests.

vi.mock("@/lib/sidecar-client", () => ({
  getSidecarBaseUrl: vi.fn().mockReturnValue(null),
  initSidecarClient: vi.fn(),
  subscribeSidecarPort: vi.fn((_cb: () => void) => () => {}),
}));

// ─── Mock fetch-assets (Sprint 5 addition) ───────────────────────────────────
//
// Prevent any real HTTP calls from the library views. With getSidecarBaseUrl
// returning null the query is disabled, but mocking defensively keeps the
// module boundary clean and avoids subtle import-order issues.

vi.mock("@/lib/fetch-assets", () => ({
  fetchAssets: vi.fn().mockResolvedValue({ assets: [], truncated: false, totalCount: 0 }),
  SidecarError: class SidecarError extends Error {
    constructor(
      message: string,
      public readonly status: number,
      public readonly response?: unknown,
    ) {
      super(message);
    }
  },
}));

// ─── EventSource stub (Sprint 5 addition) ────────────────────────────────────
//
// EventSource is not available in JSDOM. Stub it globally so the SSE hooks
// inside AgentLibraryView/SkillLibraryView do not throw on mount.
// With getSidecarBaseUrl returning null, the hooks return early before
// constructing an EventSource, but the stub prevents any accidental throw.

class MockEventSource {
  addEventListener(_type: string, _handler: (e: MessageEvent) => void): void {}
  close(): void {}
}
vi.stubGlobal("EventSource", MockEventSource);

// ─── Helper: QueryClient wrapper (Sprint 5 addition) ─────────────────────────
//
// AgentLibraryView and SkillLibraryView use useQuery — they require a
// QueryClientProvider ancestor. Wrap only the test cases that render the
// library views via HostShell navigation state.

function renderWithQuery(ui: JSX.Element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

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
  useActiveNav.setState({ activeItemId: null });
  useAssetNav.setState({ kind: "skill", selectedAssetId: null, mode: "library", dirtyByKey: {} });
  vi.clearAllMocks();
});

beforeEach(() => {
  useAppStore.getState()._setProjectRoot(null);
  useNotificationsStore.getState().clearAll();
  useNotificationsStore.getState().closeCenter();
  useCommandPaletteStore.setState({ actions: [], open: false });
  useActiveNav.setState({ activeItemId: null });
  useAssetNav.setState({ kind: "skill", selectedAssetId: null, mode: "library", dirtyByKey: {} });
});

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

    it("renders the open-project subtext with library hint when projectRoot is null", () => {
      render(<HostShell />);
      expect(
        screen.getByText(/Open a project — or click Agents \/ Skills in the sidebar/),
      ).toBeDefined();
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
      expect(main.textContent).not.toContain("Open a project");
    });
  });

  // ── Project open state ──────────────────────────────────────────────────────

  describe("project open state", () => {
    it("renders Epic 03 placeholder (not empty-state) when a project is open and no nav item selected", () => {
      useAppStore.getState()._setProjectRoot("/Users/example/project");
      // activeItemId is null (default from beforeEach) — unmapped → placeholder
      render(<HostShell />);
      expect(screen.queryByText("No project open")).toBeNull();
      expect(screen.getByText(/Epic 03 wires route rendering/)).toBeDefined();
    });

    it("renders Epic 03 placeholder when activeItemId is an unmapped value", () => {
      useAppStore.getState()._setProjectRoot("/Users/example/project");
      // "settings" is an unmapped nav item (not commands/agents/skills)
      useActiveNav.setState({ activeItemId: "settings" });
      render(<HostShell />);
      expect(screen.getByText(/Epic 03 wires route rendering/)).toBeDefined();
    });
  });

  // ── Library view routing (Sprint 5 — Epic 06) ───────────────────────────────
  //
  // These tests require a QueryClientProvider because the library views use
  // TanStack Query internally. The sidecar-client and fetch-assets modules are
  // mocked (getSidecarBaseUrl returns null) so queries stay disabled and no
  // real HTTP activity occurs. The LibraryShell <section aria-label> is the
  // stable assertion surface.

  describe("library view routing — Sprint 5 (Epic 06)", () => {
    it("renders AgentLibraryView when activeItemId is 'agents' and project is open", () => {
      useAppStore.getState()._setProjectRoot("/Users/example/project");
      useActiveNav.setState({ activeItemId: "agents" });
      renderWithQuery(<HostShell />);
      // LibraryShell renders <section aria-label="Agents library"> (region role)
      expect(screen.getByRole("region", { name: "Agents library" })).toBeDefined();
    });

    it("renders SkillLibraryView when activeItemId is 'skills' and project is open", () => {
      useAppStore.getState()._setProjectRoot("/Users/example/project");
      useActiveNav.setState({ activeItemId: "skills" });
      renderWithQuery(<HostShell />);
      // LibraryShell renders <section aria-label="Skills library"> (region role)
      expect(screen.getByRole("region", { name: "Skills library" })).toBeDefined();
    });

    it("renders AgentLibraryView when project is null (global-scope library bypasses project gate)", () => {
      // Library views show global-scope assets (~/.claude/agents) and do NOT
      // require a project to be open. Routing must happen before the project-null gate.
      useActiveNav.setState({ activeItemId: "agents" });
      renderWithQuery(<HostShell />);
      expect(screen.getByRole("region", { name: "Agents library" })).toBeDefined();
    });

    it("renders SkillLibraryView when project is null (global-scope library bypasses project gate)", () => {
      useActiveNav.setState({ activeItemId: "skills" });
      renderWithQuery(<HostShell />);
      expect(screen.getByRole("region", { name: "Skills library" })).toBeDefined();
    });

    it("renders CommandsLibraryView when activeItemId is 'commands' (Story 6.6)", () => {
      useActiveNav.setState({ activeItemId: "commands" });
      renderWithQuery(<HostShell />);
      // CommandsLibraryView renders via LibraryShell <section aria-label="Commands library">
      expect(screen.getByRole("region", { name: "Commands library" })).toBeDefined();
    });

    it("renders placeholder when activeItemId is null with project open", () => {
      useAppStore.getState()._setProjectRoot("/Users/example/project");
      // activeItemId remains null from beforeEach
      render(<HostShell />);
      expect(screen.queryByRole("region", { name: "Agents library" })).toBeNull();
      expect(screen.queryByRole("region", { name: "Skills library" })).toBeNull();
      expect(screen.queryByRole("region", { name: "Commands library" })).toBeNull();
      expect(screen.getByText(/Epic 03 wires route rendering/)).toBeDefined();
    });
  });

  // ── Story 6.18: command editor dispatch (AC1/AC2) ──────────────────────────
  //
  // Verifies that HostShell routes kind="command" + mode="editor" to
  // AssetEditorView (the flip added in Story 6.18) and that kind="command" +
  // mode="detail" still routes to AssetDetailView (regression guard).
  //
  // AssetEditorView performs async file loading on mount — it renders a
  // loading spinner while invoke("fs_read_file") is in flight. The Tauri
  // invoke mock returns a resolved value so the spinner is visible immediately.
  // We assert on the loading state text ("Loading…") as the stable surface
  // that confirms AssetEditorView was mounted (the CommandsLibraryView would
  // render the library section, not a loading spinner).

  describe("command kind-dispatch — Story 6.18 (AC1/AC2)", () => {
    it("renders AssetEditorView (loading state) when activeItemId='commands' + kind='command' + mode='editor'", () => {
      useActiveNav.setState({ activeItemId: "commands" });
      useAssetNav.setState({
        kind: "command",
        selectedAssetId: "/Users/testuser/.claude/commands/my-cmd.md",
        mode: "editor",
        dirtyByKey: {},
      });
      renderWithQuery(<HostShell />);
      // AssetEditorView renders a loading spinner while fs_read_file is in flight.
      // The Commands library section must NOT be visible.
      expect(screen.queryByRole("region", { name: "Commands library" })).toBeNull();
      // Loading text from AssetEditorView's loading state
      expect(screen.getByText("Loading…")).toBeDefined();
    });

    it("still renders AssetDetailView when activeItemId='commands' + kind='command' + mode='detail' (regression guard)", () => {
      useActiveNav.setState({ activeItemId: "commands" });
      useAssetNav.setState({
        kind: "command",
        selectedAssetId: "/Users/testuser/.claude/commands/my-cmd.md",
        mode: "detail",
        dirtyByKey: {},
      });
      renderWithQuery(<HostShell />);
      // AssetDetailView renders a loading state too; the library section must be absent.
      expect(screen.queryByRole("region", { name: "Commands library" })).toBeNull();
    });

    it("still renders CommandsLibraryView when activeItemId='commands' + mode='library'", () => {
      useActiveNav.setState({ activeItemId: "commands" });
      useAssetNav.setState({
        kind: "command",
        selectedAssetId: null,
        mode: "library",
        dirtyByKey: {},
      });
      renderWithQuery(<HostShell />);
      expect(screen.getByRole("region", { name: "Commands library" })).toBeDefined();
    });
  });

  // ── axe-core structural scans ───────────────────────────────────────────────

  describe("axe-core structural violations — zero expected", () => {
    it("has zero axe violations — empty-state (no project open)", async () => {
      const { container } = render(<HostShell />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — project open", async () => {
      useAppStore.getState()._setProjectRoot("/Users/example/project");
      const { container } = render(<HostShell />);
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });

    it("has zero axe violations — children prop variant", async () => {
      const { container } = render(
        <HostShell>
          <p>Custom story content</p>
        </HostShell>,
      );
      const results = await runAxe(container);
      expect(results.violations, formatViolations(results)).toHaveLength(0);
    });
  });
});
