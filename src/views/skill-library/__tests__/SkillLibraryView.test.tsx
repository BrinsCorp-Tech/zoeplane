/**
 * SkillLibraryView — integration tests.
 *
 * Covers:
 *   - Empty state renders when assets=[]
 *   - Cards render with mock skill asset data (filtered to kind='skill')
 *   - SSE invalidation fires on event.kind==='skill'; does NOT fire on event.kind==='agent'
 *   - Sidecar-ready race: port arrives after mount (Finding 1 pattern)
 *   - Error state renders when sidecar 500s
 *   - Search filtering works with concrete assertions (Story 6.2 Finding 2 lesson)
 *
 * Strategy:
 *   - Mock fetch-assets module (no real HTTP calls)
 *   - Mock sidecar-client getSidecarBaseUrl() to return a fixed URL
 *   - Mock Tauri invoke (invoke is not available in JSDOM)
 *   - Mock Tauri path helpers (homeDir, join)
 *   - Mock EventSource for SSE invalidation tests
 *
 * Story: 6.3
 */

import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AssetSummary } from "@zoeplane/shared-types";
import { SkillLibraryView } from "../SkillLibraryView";

// ---------------------------------------------------------------------------
// Global stubs (must be set before any module imports that reference them)
// ---------------------------------------------------------------------------

// EventSource is not available in JSDOM — stub it globally so the SSE-invalidation
// hook (useLibrarySSE) does not throw "EventSource is not defined" on mount.
// The captured handler is exposed via `capturedMessageHandler` for SSE tests.
let capturedMessageHandler: ((e: MessageEvent) => void) | null = null;

class MockEventSource {
  addEventListener(type: string, handler: (e: MessageEvent) => void): void {
    if (type === "message") capturedMessageHandler = handler;
  }
  close(): void {}
}
vi.stubGlobal("EventSource", MockEventSource);

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock fetch-assets so no real HTTP calls are made
vi.mock("@/lib/fetch-assets", () => ({
  fetchAssets: vi.fn(),
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

// Mock sidecar-client.
// Default: getSidecarBaseUrl returns the fixed test URL ("always ready").
// The subscribeSidecarPort mock captures the subscriber callback so tests can
// simulate the port-arrival event (Finding 1 race-condition test).
let _capturedPortSubscriber: (() => void) | null = null;

vi.mock("@/lib/sidecar-client", () => ({
  getSidecarBaseUrl: vi.fn().mockReturnValue("http://127.0.0.1:9999"),
  initSidecarClient: vi.fn(),
  subscribeSidecarPort: vi.fn((cb: () => void) => {
    _capturedPortSubscriber = cb;
    return () => {
      _capturedPortSubscriber = null;
    };
  }),
}));

// Mock Tauri invoke (not available in JSDOM)
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock Tauri path helpers (not available in JSDOM)
vi.mock("@tauri-apps/api/path", () => ({
  homeDir: vi.fn().mockResolvedValue("/Users/testuser"),
  join: vi.fn((...parts: string[]) => Promise.resolve(parts.join("/"))),
}));

import { fetchAssets } from "@/lib/fetch-assets";
const mockFetchAssets = vi.mocked(fetchAssets);

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkillAsset(id: string, name: string): AssetSummary {
  return {
    id,
    kind: "skill",
    name,
    scope: "global",
    projectId: null,
    sourcePath: `/Users/testuser/.claude/skills/${name}.md`,
    validationStatus: "valid",
    lastModifiedAt: Date.now() - 60_000,
    lastModifiedBy: "external",
    frontMatter: {
      name,
      description: `${name} skill description.`,
    },
    bodyExcerpt: null,
    provenance: null,
  };
}

function makeEmptyResponse() {
  return { assets: [], truncated: false, totalCount: 0 };
}

function makeAssetsResponse(assets: AssetSummary[]) {
  return { assets, truncated: false, totalCount: assets.length };
}

/** Wrap component in a fresh QueryClient to avoid test cross-contamination. */
function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  _capturedPortSubscriber = null;
  capturedMessageHandler = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SkillLibraryView", () => {
  // ── Empty state ────────────────────────────────────────────────────────────

  it("renders empty state when assets array is empty", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("No skills found")).toBeDefined();
    });
  });

  it("renders 'Open ~/.claude/skills/ in Finder' button in empty state", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /Open.*skills.*Finder/i });
      expect(button).toBeDefined();
    });
  });

  it("renders docs link to skills documentation in empty state", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /Learn how to author/i });
      expect(link).toBeDefined();
      // Link target is the canonical skills docs URL
      expect(link.getAttribute("href")).toContain("claude-code/skills");
    });
  });

  // ── Populated state ────────────────────────────────────────────────────────

  it("renders skill cards when assets are returned", async () => {
    const assets = [
      makeSkillAsset("id-001", "Code Reviewer"),
      makeSkillAsset("id-002", "Research Analyst"),
    ];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Code Reviewer")).toBeDefined();
      expect(screen.getByText("Research Analyst")).toBeDefined();
    });
  });

  it("fetchAssets is called with kind='skill' and scope='global'", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(mockFetchAssets).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "skill", scope: "global" }),
      );
    });
  });

  it("fetchAssets is NOT called with kind='agent'", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(mockFetchAssets).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "agent" }));
    });
  });

  it("renders cards as button roles", async () => {
    const assets = [makeSkillAsset("id-001", "Code Reviewer")];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  // ── Error state ────────────────────────────────────────────────────────────

  it("renders error state when fetchAssets throws", async () => {
    mockFetchAssets.mockRejectedValueOnce(new Error("Network failure"));

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load skills")).toBeDefined();
    });
  });

  it("renders Retry button in error state", async () => {
    mockFetchAssets.mockRejectedValueOnce(new Error("5xx"));

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
    });
  });

  // ── reveal_in_finder error surfacing (Finding 1 — code review) ────────────

  it("shows inline error message when reveal_in_finder fails from empty state", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open.*skills.*Finder/i })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*skills.*Finder/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't open ~/.claude/skills/ — directory may not exist yet."),
      ).toBeDefined();
    });
  });

  it("inline error message in empty state has aria-live='polite'", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open.*skills.*Finder/i })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*skills.*Finder/i }));
    });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.getAttribute("aria-live")).toBe("polite");
    });
  });

  it("does NOT show inline error message when reveal_in_finder succeeds from empty state", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());
    mockInvoke.mockResolvedValueOnce(undefined);

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open.*skills.*Finder/i })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*skills.*Finder/i }));
    });

    // Error message must not appear
    await waitFor(() => {
      expect(
        screen.queryByText("Couldn't open ~/.claude/skills/ — directory may not exist yet."),
      ).toBeNull();
    });
  });

  it("docs link is still rendered after reveal_in_finder fails from empty state", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open.*skills.*Finder/i })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*skills.*Finder/i }));
    });

    await waitFor(() => {
      // Error message appears
      expect(
        screen.getByText("Couldn't open ~/.claude/skills/ — directory may not exist yet."),
      ).toBeDefined();
    });

    // Docs link is still present and clickable
    const docsLink = screen.getByRole("link", { name: /Learn how to author/i });
    expect(docsLink).toBeDefined();
    expect(docsLink.getAttribute("href")).toContain("claude-code/skills");
  });

  it("shows inline error message when reveal_in_finder fails from error state", async () => {
    mockFetchAssets.mockRejectedValueOnce(new Error("Network failure"));
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reveal in Finder" })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't open ~/.claude/skills/ — directory may not exist yet."),
      ).toBeDefined();
    });
  });

  it("inline error message in error state has aria-live='polite'", async () => {
    mockFetchAssets.mockRejectedValueOnce(new Error("Network failure"));
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reveal in Finder" })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.getAttribute("aria-live")).toBe("polite");
    });
  });

  it("does NOT show inline error message when reveal_in_finder succeeds from error state", async () => {
    mockFetchAssets.mockRejectedValueOnce(new Error("Network failure"));
    mockInvoke.mockResolvedValueOnce(undefined);

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reveal in Finder" })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Couldn't open ~/.claude/skills/ — directory may not exist yet."),
      ).toBeNull();
    });
  });

  // ── SSE invalidation — skill events ───────────────────────────────────────

  it("invalidates query cache when LibraryRefreshEvent with kind='skill' arrives via SSE", async () => {
    capturedMessageHandler = null;

    // First fetch returns 1 skill
    mockFetchAssets.mockResolvedValue(
      makeAssetsResponse([makeSkillAsset("id-001", "Code Reviewer")]),
    );

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Code Reviewer")).toBeDefined();
    });

    // Second fetch returns 2 skills (simulating a new skill added)
    mockFetchAssets.mockResolvedValueOnce(
      makeAssetsResponse([
        makeSkillAsset("id-001", "Code Reviewer"),
        makeSkillAsset("id-002", "New Skill"),
      ]),
    );

    await act(async () => {
      capturedMessageHandler?.({
        data: JSON.stringify({ type: "library:refresh", kind: "skill", count: 2 }),
      } as MessageEvent);
    });

    await waitFor(() => {
      expect(screen.getByText("New Skill")).toBeDefined();
    });
  });

  it("does NOT invalidate query cache when LibraryRefreshEvent with kind='agent' arrives", async () => {
    capturedMessageHandler = null;

    // Single fetch — returns 1 skill
    mockFetchAssets.mockResolvedValue(
      makeAssetsResponse([makeSkillAsset("id-001", "Code Reviewer")]),
    );

    renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Code Reviewer")).toBeDefined();
    });

    const initialCallCount = mockFetchAssets.mock.calls.length;

    // Send an SSE event for 'agent' kind — should NOT trigger a skills re-fetch
    await act(async () => {
      capturedMessageHandler?.({
        data: JSON.stringify({ type: "library:refresh", kind: "agent", count: 1 }),
      } as MessageEvent);
    });

    // Wait briefly to ensure no additional calls are queued
    await new Promise((r) => setTimeout(r, 50));

    // fetchAssets call count should not have increased
    expect(mockFetchAssets.mock.calls.length).toBe(initialCallCount);
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it("renders loading skeleton while fetching", () => {
    // fetchAssets never resolves during this test
    mockFetchAssets.mockImplementation(() => new Promise(() => {}));

    renderWithQuery(<SkillLibraryView />);

    // LibraryShell renders loading skeleton with aria-busy
    const loadingRegion = document.querySelector('[aria-busy="true"]');
    expect(loadingRegion).not.toBeNull();
  });

  // ── SSE race: sidecar port arrives after mount (Finding 1) ─────────────────

  it("fires query when sidecar port becomes available after initial mount", async () => {
    // Arrange: getSidecarBaseUrl returns null initially, then the real URL
    const { getSidecarBaseUrl } = await import("@/lib/sidecar-client");
    const mockGet = vi.mocked(getSidecarBaseUrl);
    mockGet.mockReturnValue(null); // sidecar not ready on first render

    mockFetchAssets.mockResolvedValue(
      makeAssetsResponse([makeSkillAsset("id-001", "Code Reviewer")]),
    );

    renderWithQuery(<SkillLibraryView />);

    // Should be in pending/disabled state (no data yet, query disabled)
    expect(screen.queryByText("Code Reviewer")).toBeNull();

    // Simulate sidecar port arriving: update the mock return and notify subscribers
    mockGet.mockReturnValue("http://127.0.0.1:9999");

    await act(async () => {
      _capturedPortSubscriber?.();
    });

    // After port arrival, the query should fire and cards should render
    await waitFor(() => {
      expect(screen.getByText("Code Reviewer")).toBeDefined();
    });

    // Restore default mock
    mockGet.mockReturnValue("http://127.0.0.1:9999");
  });

  // ── Search filtering (concrete assertions — Story 6.2 Finding 2) ───────────

  it("filters skills by name via search input", async () => {
    const assets = [
      makeSkillAsset("id-001", "Code Reviewer"),
      makeSkillAsset("id-002", "Research Helper"),
    ];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    const { getByRole } = renderWithQuery(<SkillLibraryView />);

    // Wait for real async data load before engaging fake timers
    await waitFor(() => {
      expect(screen.getByText("Code Reviewer")).toBeDefined();
    });

    // Switch to fake timers only for the debounce phase
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const searchInput = getByRole("searchbox");

    await act(async () => {
      const { fireEvent } = await import("@testing-library/react");
      fireEvent.change(searchInput, { target: { value: "Research" } });
      // Advance past the LibraryShell 150ms debounce
      vi.advanceTimersByTime(200);
    });

    // After filtering, only Research Helper should remain visible
    await waitFor(() => {
      expect(screen.queryByText("Code Reviewer")).toBeNull();
      // Use getAllByText since the name appears in the card header AND description text
      const matches = screen.getAllByText(/Research Helper/i);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it("shows all skills when search input is cleared", async () => {
    const assets = [
      makeSkillAsset("id-001", "Code Reviewer"),
      makeSkillAsset("id-002", "Research Helper"),
    ];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    const { getByRole } = renderWithQuery(<SkillLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Code Reviewer")).toBeDefined();
    });

    vi.useFakeTimers({ shouldAdvanceTime: true });

    const searchInput = getByRole("searchbox");

    // Type a search term
    await act(async () => {
      const { fireEvent } = await import("@testing-library/react");
      fireEvent.change(searchInput, { target: { value: "Code" } });
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(screen.queryByText("Research Helper")).toBeNull();
    });

    // Clear search
    await act(async () => {
      const { fireEvent } = await import("@testing-library/react");
      fireEvent.change(searchInput, { target: { value: "" } });
      vi.advanceTimersByTime(200);
    });

    // Both cards should be visible again
    await waitFor(() => {
      expect(screen.getByText("Code Reviewer")).toBeDefined();
      expect(screen.getByText("Research Helper")).toBeDefined();
    });
  });
});
