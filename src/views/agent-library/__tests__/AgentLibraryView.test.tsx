/**
 * AgentLibraryView — integration tests.
 *
 * Covers:
 *   - Empty state renders correctly when assets=[]
 *   - Cards render with mock asset data
 *   - SSE event triggers query invalidation (mock the SSE stream)
 *   - Error state renders when sidecar 500s
 *   - reveal_in_finder inline error surfacing (Story 6.13 AC #6 — convergence)
 *
 * Strategy:
 *   - Mock fetch-assets module (no real HTTP calls)
 *   - Mock sidecar-client getSidecarBaseUrl() to return a fixed URL
 *   - Mock Tauri invoke (invoke is not available in JSDOM)
 *   - Mock Tauri path helpers (invoke is not available in JSDOM)
 *   - Mock EventSource for SSE invalidation tests
 *
 * Story: 6.2, 6.13
 */

import { cleanup, render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AssetSummary } from "@zoeplane/shared-types";
import { AgentLibraryView } from "../AgentLibraryView";

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

function makeAsset(id: string, name: string): AssetSummary {
  return {
    id,
    kind: "agent",
    name,
    scope: "global",
    projectId: null,
    sourcePath: `/Users/zeke/.claude/agents/${name}.md`,
    validationStatus: "valid",
    lastModifiedAt: Date.now() - 60_000,
    lastModifiedBy: "external",
    frontMatter: {
      name,
      voice_id: "8fcyCHOzlKDlxh1InJSf",
      voice_name: "Joseph",
      traits: {
        expertise: ["implementation"],
        personality: ["efficiency"],
        approach: ["rapid"],
      },
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
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentLibraryView", () => {
  // ── Empty state ────────────────────────────────────────────────────────────

  it("renders empty state when assets array is empty", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());

    renderWithQuery(<AgentLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("No agents found")).toBeDefined();
    });
  });

  it("renders 'Open ~/.claude/agents/ in Finder' button in empty state", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());

    renderWithQuery(<AgentLibraryView />);

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /Open.*agents.*Finder/i });
      expect(button).toBeDefined();
    });
  });

  it("renders docs link in empty state", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());

    renderWithQuery(<AgentLibraryView />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /Learn how to author/i });
      expect(link).toBeDefined();
    });
  });

  // ── Populated state ────────────────────────────────────────────────────────

  it("renders agent cards when assets are returned", async () => {
    const assets = [
      makeAsset("id-001", "Sprint Programmer"),
      makeAsset("id-002", "Research Analyst"),
    ];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    renderWithQuery(<AgentLibraryView />);

    await waitFor(() => {
      // Agent names appear as card headings
      expect(screen.getByText("Sprint Programmer")).toBeDefined();
      expect(screen.getByText("Research Analyst")).toBeDefined();
    });
  });

  it("renders cards as button roles", async () => {
    const assets = [makeAsset("id-001", "Sprint Programmer")];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    renderWithQuery(<AgentLibraryView />);

    await waitFor(() => {
      // There may be multiple buttons (card + ? icon buttons); at least one card button
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  // ── Error state ────────────────────────────────────────────────────────────

  it("renders error state when fetchAssets throws", async () => {
    mockFetchAssets.mockRejectedValueOnce(new Error("Network failure"));

    renderWithQuery(<AgentLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load agents")).toBeDefined();
    });
  });

  it("renders Retry button in error state", async () => {
    mockFetchAssets.mockRejectedValueOnce(new Error("5xx"));

    renderWithQuery(<AgentLibraryView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
    });
  });

  // ── SSE invalidation ───────────────────────────────────────────────────────

  it("invalidates query cache when LibraryRefreshEvent with kind=agent arrives via SSE", async () => {
    // Reset captured handler
    capturedMessageHandler = null;

    // First fetch returns 1 asset
    mockFetchAssets.mockResolvedValue(
      makeAssetsResponse([makeAsset("id-001", "Sprint Programmer")]),
    );

    renderWithQuery(<AgentLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Sprint Programmer")).toBeDefined();
    });

    // Simulate SSE library:refresh event
    // Second fetch returns 2 assets (simulating a new agent added)
    mockFetchAssets.mockResolvedValueOnce(
      makeAssetsResponse([
        makeAsset("id-001", "Sprint Programmer"),
        makeAsset("id-002", "New Agent"),
      ]),
    );

    await act(async () => {
      capturedMessageHandler?.({
        data: JSON.stringify({ type: "library:refresh", kind: "agent", count: 2 }),
      } as MessageEvent);
    });

    await waitFor(() => {
      expect(screen.getByText("New Agent")).toBeDefined();
    });
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it("renders loading skeleton while fetching", () => {
    // fetchAssets never resolves during this test
    mockFetchAssets.mockImplementation(() => new Promise(() => {}));

    renderWithQuery(<AgentLibraryView />);

    // LibraryShell renders loading skeleton with aria-busy
    const loadingRegion = document.querySelector('[aria-busy="true"]');
    expect(loadingRegion).not.toBeNull();
  });

  // ── Search ─────────────────────────────────────────────────────────────────

  it("filters agents by name via search input", async () => {
    const assets = [
      makeAsset("id-001", "Sprint Programmer"),
      makeAsset("id-002", "Research Analyst"),
    ];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    const { getByRole } = renderWithQuery(<AgentLibraryView />);

    // Wait for real async data load to complete before engaging fake timers
    await waitFor(() => {
      expect(screen.getByText("Sprint Programmer")).toBeDefined();
    });

    // Switch to fake timers only for the debounce phase
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const searchInput = getByRole("searchbox");

    // fireEvent.change triggers the React onChange handler (setSearchTerm)
    await act(async () => {
      // Use fireEvent from @testing-library/react to properly trigger React's onChange
      const { fireEvent } = await import("@testing-library/react");
      fireEvent.change(searchInput, { target: { value: "Research" } });
      // Advance past the LibraryShell 150ms debounce
      vi.advanceTimersByTime(200);
    });

    // After filtering, only Research Analyst should remain visible
    await waitFor(() => {
      expect(screen.queryByText("Sprint Programmer")).toBeNull();
      expect(screen.getByText(/Research Analyst/i)).toBeDefined();
    });
  });

  // ── reveal_in_finder error surfacing (Story 6.13 AC #6 — convergence) ───────
  // Agent variants previously swallowed reveal failures silently. After Story 6.13
  // they share LibraryEmptyPanel / LibraryErrorPanel which surface inline alerts.

  it("shows inline error message when reveal_in_finder fails from empty state", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));

    renderWithQuery(<AgentLibraryView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open.*agents.*Finder/i })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*agents.*Finder/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't open ~/.claude/agents/ — directory may not exist yet."),
      ).toBeDefined();
    });
  });

  it("inline error message in empty state has aria-live='polite'", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));

    renderWithQuery(<AgentLibraryView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open.*agents.*Finder/i })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*agents.*Finder/i }));
    });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.getAttribute("aria-live")).toBe("polite");
    });
  });

  it("does NOT show inline error message when reveal_in_finder succeeds from empty state", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());
    mockInvoke.mockResolvedValueOnce(undefined);

    renderWithQuery(<AgentLibraryView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open.*agents.*Finder/i })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*agents.*Finder/i }));
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Couldn't open ~/.claude/agents/ — directory may not exist yet."),
      ).toBeNull();
    });
  });

  // ── SSE race: sidecar port arrives after mount (Finding 1) ─────────────────

  it("fires query when sidecar port becomes available after initial mount", async () => {
    // Arrange: getSidecarBaseUrl returns null initially, then the real URL
    const { getSidecarBaseUrl } = await import("@/lib/sidecar-client");
    const mockGet = vi.mocked(getSidecarBaseUrl);
    mockGet.mockReturnValue(null); // sidecar not ready on first render

    mockFetchAssets.mockResolvedValue(
      makeAssetsResponse([makeAsset("id-001", "Sprint Programmer")]),
    );

    renderWithQuery(<AgentLibraryView />);

    // Should be in pending/disabled state (no data yet, query disabled)
    expect(screen.queryByText("Sprint Programmer")).toBeNull();

    // Simulate sidecar port arriving: update the mock return and notify subscribers
    mockGet.mockReturnValue("http://127.0.0.1:9999");

    await act(async () => {
      _capturedPortSubscriber?.();
    });

    // After port arrival, the query should fire and cards should render
    await waitFor(() => {
      expect(screen.getByText("Sprint Programmer")).toBeDefined();
    });

    // Restore default mock
    mockGet.mockReturnValue("http://127.0.0.1:9999");
  });
});
