/**
 * CommandsLibraryView — integration tests.
 *
 * Covers:
 *   - Empty state renders when assets=[]
 *   - Cards render with mock command asset data
 *   - fetchAssets is called with kind='command' and NO scope filter (both scopes returned)
 *   - Global and project-scoped command cards render with correct scope badges (AC #1, AC #2)
 *   - AC #2: when only global rows are returned, no "Project" scope badges appear
 *   - AC #4: zero project rows renders cleanly (no error state)
 *   - AC #5: command with null frontMatter still renders a card (parse-warning state)
 *   - SSE invalidation fires on event.kind==='command'; does NOT fire on event.kind==='skill'
 *   - Error state renders when sidecar 500s
 *   - Loading state renders skeleton while fetching
 *   - Sidecar-ready race: port arrives after mount (Finding 1 pattern)
 *   - Search filtering works
 *   - F-001: onActivate is called with sourcePath as assetId (not UUID)
 *
 * Strategy:
 *   - Mock fetch-assets module (no real HTTP calls)
 *   - Mock sidecar-client getSidecarBaseUrl() to return a fixed URL
 *   - Mock Tauri invoke (not available in JSDOM)
 *   - Mock Tauri path helpers (homeDir, join)
 *   - Mock EventSource for SSE invalidation tests
 *   - Mock useAssetNav to capture open() calls for F-001 verification
 *
 * Story: 6.6
 */

import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AssetSummary } from "@zoeplane/shared-types";
import { CommandsLibraryView } from "../CommandsLibraryView";

// ---------------------------------------------------------------------------
// Global stubs (must be set before any module imports that reference them)
// ---------------------------------------------------------------------------

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

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/path", () => ({
  homeDir: vi.fn().mockResolvedValue("/Users/testuser"),
  join: vi.fn((...parts: string[]) => Promise.resolve(parts.join("/"))),
}));

// Capture open() calls from CommandCard's onActivate (F-001 verification)
const mockOpen = vi.fn();
vi.mock("@/stores/asset-nav", () => ({
  useAssetNav: {
    getState: () => ({ open: mockOpen }),
  },
}));

import { fetchAssets } from "@/lib/fetch-assets";
const mockFetchAssets = vi.mocked(fetchAssets);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommandAsset(
  id: string,
  name: string,
  scope: "global" | "project" = "global",
  overrides: Partial<AssetSummary> = {},
): AssetSummary {
  return {
    id,
    kind: "command",
    name,
    scope,
    projectId: scope === "project" ? "proj-001" : null,
    sourcePath:
      scope === "project"
        ? `/Users/testuser/my-project/.claude/commands/${name}.md`
        : `/Users/testuser/.claude/commands/${name}.md`,
    validationStatus: "valid",
    lastModifiedAt: Date.now() - 60_000,
    lastModifiedBy: "external",
    frontMatter: {
      name,
      description: `${name} command description.`,
    },
    bodyExcerpt: null,
    provenance: null,
    ...overrides,
  };
}

function makeEmptyResponse() {
  return { assets: [], truncated: false, totalCount: 0 };
}

function makeAssetsResponse(assets: AssetSummary[]) {
  return { assets, truncated: false, totalCount: assets.length };
}

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
  mockOpen.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CommandsLibraryView", () => {
  // ── Empty state ────────────────────────────────────────────────────────────

  it("renders empty state when assets array is empty", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("No commands found")).toBeDefined();
    });
  });

  it("renders 'Open ~/.claude/commands/ in Finder' button in empty state", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /Open.*commands.*Finder/i });
      expect(button).toBeDefined();
    });
  });

  it("renders docs link to commands documentation in empty state", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /Learn how to author/i });
      expect(link).toBeDefined();
      expect(link.getAttribute("href")).toContain("slash-commands");
    });
  });

  // ── Populated state ────────────────────────────────────────────────────────

  it("renders command cards when assets are returned", async () => {
    const assets = [
      makeCommandAsset("id-001", "Debug Helper"),
      makeCommandAsset("id-002", "Code Review"),
    ];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Debug Helper")).toBeDefined();
      expect(screen.getByText("Code Review")).toBeDefined();
    });
  });

  it("fetchAssets is called with kind='command' and no scope filter", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(mockFetchAssets).toHaveBeenCalledWith(expect.objectContaining({ kind: "command" }));
      // No scope filter — both scopes returned (AC #1)
      const call = mockFetchAssets.mock.calls[0]?.[0];
      expect(call?.scope).toBeUndefined();
    });
  });

  it("fetchAssets is NOT called with kind='skill'", async () => {
    mockFetchAssets.mockResolvedValueOnce(makeEmptyResponse());

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(mockFetchAssets).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "skill" }));
    });
  });

  // ── Scope badges (AC #1) ────────────────────────────────────────────────────

  it("renders 'Global' badge for scope=global commands (AC #1)", async () => {
    const assets = [makeCommandAsset("id-001", "Global Cmd", "global")];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Global")).toBeDefined();
    });
  });

  it("renders 'Project' badge for scope=project commands (AC #1)", async () => {
    const assets = [makeCommandAsset("id-001", "Project Cmd", "project")];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Project")).toBeDefined();
    });
  });

  // ── AC #2: no project active — only global rows ────────────────────────────

  it("renders only Global badges when sidecar returns only global-scoped commands (AC #2)", async () => {
    const assets = [
      makeCommandAsset("id-001", "Global Cmd 1", "global"),
      makeCommandAsset("id-002", "Global Cmd 2", "global"),
    ];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      const globalBadges = screen.getAllByText("Global");
      expect(globalBadges).toHaveLength(2);
      expect(screen.queryByText("Project")).toBeNull();
    });
  });

  // ── AC #4: zero project rows — no error shown ──────────────────────────────

  it("renders cleanly with only global commands when project has no commands dir (AC #4)", async () => {
    // Sidecar returns only global rows; missing project/.claude/commands/ is handled gracefully
    const assets = [makeCommandAsset("id-001", "Global Only", "global")];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Global Only")).toBeDefined();
      expect(screen.queryByText("Couldn't load commands")).toBeNull();
    });
  });

  // ── AC #5: parse-warning state — card still renders with frontMatter=null ──

  it("renders CommandCard for a command with unparseable front-matter (AC #5)", async () => {
    const assets = [
      makeCommandAsset("id-001", "broken", "global", {
        validationStatus: "invalid",
        frontMatter: null,
      }),
    ];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      // Card renders (not omitted)
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
      // Warning indicator present
      expect(screen.getByText("Cannot parse front-matter")).toBeDefined();
    });
  });

  // ── Error state ────────────────────────────────────────────────────────────

  it("renders error state when fetchAssets throws", async () => {
    mockFetchAssets.mockRejectedValueOnce(new Error("Network failure"));

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load commands")).toBeDefined();
    });
  });

  it("renders Retry button in error state", async () => {
    mockFetchAssets.mockRejectedValueOnce(new Error("5xx"));

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
    });
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it("renders loading skeleton while fetching", () => {
    mockFetchAssets.mockImplementation(() => new Promise(() => {}));

    renderWithQuery(<CommandsLibraryView />);

    const loadingRegion = document.querySelector('[aria-busy="true"]');
    expect(loadingRegion).not.toBeNull();
  });

  // ── SSE cache invalidation ─────────────────────────────────────────────────

  it("invalidates query cache when LibraryRefreshEvent with kind='command' arrives via SSE", async () => {
    capturedMessageHandler = null;

    mockFetchAssets.mockResolvedValue(
      makeAssetsResponse([makeCommandAsset("id-001", "Debug Helper")]),
    );

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Debug Helper")).toBeDefined();
    });

    mockFetchAssets.mockResolvedValueOnce(
      makeAssetsResponse([
        makeCommandAsset("id-001", "Debug Helper"),
        makeCommandAsset("id-002", "New Command"),
      ]),
    );

    await act(async () => {
      capturedMessageHandler?.({
        data: JSON.stringify({ type: "library:refresh", kind: "command", count: 2 }),
      } as MessageEvent);
    });

    await waitFor(() => {
      expect(screen.getByText("New Command")).toBeDefined();
    });
  });

  it("does NOT invalidate query cache when LibraryRefreshEvent with kind='skill' arrives", async () => {
    capturedMessageHandler = null;

    mockFetchAssets.mockResolvedValue(
      makeAssetsResponse([makeCommandAsset("id-001", "Debug Helper")]),
    );

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Debug Helper")).toBeDefined();
    });

    const initialCallCount = mockFetchAssets.mock.calls.length;

    await act(async () => {
      capturedMessageHandler?.({
        data: JSON.stringify({ type: "library:refresh", kind: "skill", count: 1 }),
      } as MessageEvent);
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchAssets.mock.calls.length).toBe(initialCallCount);
  });

  // ── Sidecar-ready race (Finding 1) ─────────────────────────────────────────

  it("fires query when sidecar port becomes available after initial mount", async () => {
    const { getSidecarBaseUrl } = await import("@/lib/sidecar-client");
    const mockGet = vi.mocked(getSidecarBaseUrl);
    mockGet.mockReturnValue(null);

    mockFetchAssets.mockResolvedValue(
      makeAssetsResponse([makeCommandAsset("id-001", "Debug Helper")]),
    );

    renderWithQuery(<CommandsLibraryView />);

    expect(screen.queryByText("Debug Helper")).toBeNull();

    mockGet.mockReturnValue("http://127.0.0.1:9999");

    await act(async () => {
      _capturedPortSubscriber?.();
    });

    await waitFor(() => {
      expect(screen.getByText("Debug Helper")).toBeDefined();
    });

    mockGet.mockReturnValue("http://127.0.0.1:9999");
  });

  // ── Search filtering ────────────────────────────────────────────────────────

  it("filters commands by name via search input", async () => {
    const assets = [
      makeCommandAsset("id-001", "Debug Helper"),
      makeCommandAsset("id-002", "Code Review"),
    ];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    const { getByRole } = renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Debug Helper")).toBeDefined();
    });

    vi.useFakeTimers({ shouldAdvanceTime: true });

    const searchInput = getByRole("searchbox");

    await act(async () => {
      const { fireEvent } = await import("@testing-library/react");
      fireEvent.change(searchInput, { target: { value: "Code" } });
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(screen.queryByText("Debug Helper")).toBeNull();
      // Use getAllByText since name appears in both card header and description text
      const matches = screen.getAllByText(/Code Review/i);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  // ── F-001: open() receives sourcePath, not UUID ────────────────────────────

  it("calls open() with 'command' kind and sourcePath (not UUID) when a card is activated (F-001)", async () => {
    const sourcePath = "/Users/testuser/.claude/commands/my-command.md";
    const assets = [makeCommandAsset("uuid-001", "My Command", "global", { sourcePath })];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("My Command")).toBeDefined();
    });

    // Click the card button
    fireEvent.click(screen.getByRole("button", { name: /Command: My Command/i }));

    expect(mockOpen).toHaveBeenCalledWith("command", sourcePath);
    // Must NOT be called with the UUID
    expect(mockOpen).not.toHaveBeenCalledWith("command", "uuid-001");
  });

  it("calls open() with sourcePath for project-scoped command (F-001 project path)", async () => {
    const sourcePath = "/Users/testuser/my-project/.claude/commands/project-cmd.md";
    const assets = [makeCommandAsset("uuid-002", "Project Cmd", "project", { sourcePath })];
    mockFetchAssets.mockResolvedValueOnce(makeAssetsResponse(assets));

    renderWithQuery(<CommandsLibraryView />);

    await waitFor(() => {
      expect(screen.getByText("Project Cmd")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /Command: Project Cmd/i }));

    expect(mockOpen).toHaveBeenCalledWith("command", sourcePath);
  });
});
