/**
 * AssetDetailView — stale-closure regression tests + kind-parameter dispatch tests.
 *
 * Covers:
 *   - Critical Issue 1 (carried from Story 6.4): stale `asset` closure causes
 *     universal "error-not-found" when selectedAssetId is a UUID (library navigation
 *     path). The fix uses a local variable inside the IIFE to carry the resolved
 *     asset/path forward rather than reading from React state that hasn't settled yet.
 *   - Kind-parameter dispatch: skill and agent paths both render AssetDetailView
 *     and surface the correct "Back to Skills" / "Back to Agents" label (AC #1).
 *
 * Strategy:
 *   - Mock fetch (global) to return an asset whose id matches the UUID
 *   - Mock sidecar-client getSidecarBaseUrl() to return a fixed URL
 *   - Mock Tauri invoke to return UTF-8 bytes for fs_read_file
 *   - Directly set asset-nav store state (open(kind, id)) to simulate clicking a card
 *
 * Story: 6.16 — Asset Detail+Editor Kind-Parameterized Refactor (FR-003, FR-010)
 */

import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetSummary } from "@zoeplane/shared-types";
import { AssetDetailView } from "../AssetDetailView";
import { useAssetNav } from "@/stores/asset-nav";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// EventSource stub (SSE hook — not exercised here but imported transitively)
class MockEventSource {
  addEventListener(): void {}
  close(): void {}
}
vi.stubGlobal("EventSource", MockEventSource);

vi.mock("@/lib/sidecar-client", () => ({
  getSidecarBaseUrl: vi.fn().mockReturnValue("http://127.0.0.1:9999"),
  initSidecarClient: vi.fn(),
  subscribeSidecarPort: vi.fn(() => () => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SKILL_UUID = "3f8a1b2c-4d5e-6f70-8192-a3b4c5d6e7f8";
const SKILL_SOURCE_PATH = "/Users/testuser/.claude/skills/my-skill.md";

const AGENT_UUID = "9a8b7c6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4";
const AGENT_SOURCE_PATH = "/Users/testuser/.claude/agents/my-agent.md";

function makeAsset(id: string, kind: "skill" | "agent", sourcePath: string): AssetSummary {
  return {
    id,
    kind,
    name: kind === "skill" ? "My Skill" : "My Agent",
    scope: "global",
    projectId: null,
    sourcePath,
    validationStatus: "valid",
    lastModifiedAt: Date.now() - 60_000,
    lastModifiedBy: "external",
    frontMatter: {
      name: kind === "skill" ? "My Skill" : "My Agent",
      description: `A test ${kind}.`,
    },
    bodyExcerpt: null,
    provenance: null,
  };
}

/** Encode a string as byte array (what fs_read_file returns). */
function encodeUtf8(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

function makeFileContent(name: string, kind: string): string {
  return `---
name: ${name}
description: A test ${kind}.
---

This is the ${kind} body.
`;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset asset-nav store to library mode
  useAssetNav.setState({ kind: "skill", selectedAssetId: null, mode: "library", dirtyByKey: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AssetDetailView — stale-closure regression (carried from Story 6.4)", () => {
  it("renders loaded state (not error-not-found) when selectedAssetId is a UUID opened from the skill library", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ assets: [makeAsset(SKILL_UUID, "skill", SKILL_SOURCE_PATH)] }),
      }),
    );
    mockInvoke.mockResolvedValue(encodeUtf8(makeFileContent("My Skill", "skill")));

    act(() => {
      useAssetNav.getState().open("skill", SKILL_UUID);
    });

    render(<AssetDetailView />);

    await waitFor(() => {
      expect(screen.queryByText("Skill file not found")).toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("My Skill");
    });
  });

  it("does NOT set loadState to error-not-found when asset is found in the assets API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ assets: [makeAsset(SKILL_UUID, "skill", SKILL_SOURCE_PATH)] }),
      }),
    );
    mockInvoke.mockResolvedValue(encodeUtf8(makeFileContent("My Skill", "skill")));

    act(() => {
      useAssetNav.getState().open("skill", SKILL_UUID);
    });

    render(<AssetDetailView />);

    expect(screen.queryByText("Skill file not found")).toBeNull();

    await waitFor(
      () => {
        expect(screen.queryByText("Skill file not found")).toBeNull();
      },
      { timeout: 2000 },
    );
  });

  it("uses the sourcePath from the fetched asset to call fs_read_file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ assets: [makeAsset(SKILL_UUID, "skill", SKILL_SOURCE_PATH)] }),
      }),
    );
    mockInvoke.mockResolvedValue(encodeUtf8(makeFileContent("My Skill", "skill")));

    act(() => {
      useAssetNav.getState().open("skill", SKILL_UUID);
    });

    render(<AssetDetailView />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "fs_read_file",
        expect.objectContaining({ path: SKILL_SOURCE_PATH }),
      );
    });
  });
});

describe("AssetDetailView — kind-parameter dispatch (AC #1)", () => {
  it("renders 'Back to Skills' label when kind=skill", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ assets: [makeAsset(SKILL_UUID, "skill", SKILL_SOURCE_PATH)] }),
      }),
    );
    mockInvoke.mockResolvedValue(encodeUtf8(makeFileContent("My Skill", "skill")));

    act(() => {
      useAssetNav.getState().open("skill", SKILL_UUID);
    });

    render(<AssetDetailView />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("My Skill");
    });

    // Back button aria-label should reference "Skills"
    expect(screen.getByRole("button", { name: /back to skills/i })).toBeDefined();
  });

  it("renders 'Back to Agents' label when kind=agent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ assets: [makeAsset(AGENT_UUID, "agent", AGENT_SOURCE_PATH)] }),
      }),
    );
    mockInvoke.mockResolvedValue(encodeUtf8(makeFileContent("My Agent", "agent")));

    act(() => {
      useAssetNav.getState().open("agent", AGENT_UUID);
    });

    render(<AssetDetailView />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("My Agent");
    });

    // Back button aria-label should reference "Agents"
    expect(screen.getByRole("button", { name: /back to agents/i })).toBeDefined();
  });

  it("passes kind=agent in the assets API query when kind=agent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ assets: [makeAsset(AGENT_UUID, "agent", AGENT_SOURCE_PATH)] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    mockInvoke.mockResolvedValue(encodeUtf8(makeFileContent("My Agent", "agent")));

    act(() => {
      useAssetNav.getState().open("agent", AGENT_UUID);
    });

    render(<AssetDetailView />);

    await waitFor(() => {
      const calls = fetchMock.mock.calls as [string, ...unknown[]][];
      expect(calls.some(([url]) => typeof url === "string" && url.includes("kind=agent"))).toBe(
        true,
      );
    });
  });
});
