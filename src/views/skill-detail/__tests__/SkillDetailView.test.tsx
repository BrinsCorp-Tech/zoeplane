/**
 * SkillDetailView — stale-closure regression tests.
 *
 * Covers:
 *   - Critical Issue 1: stale `asset` closure causes universal "error-not-found"
 *     when selectedSkillId is a UUID (library navigation path). The fix uses a
 *     local variable inside the IIFE to carry the resolved asset/path forward
 *     rather than reading from React state that hasn't settled yet.
 *
 * Strategy:
 *   - Mock fetch (global) to return a skill asset whose id matches the UUID
 *   - Mock sidecar-client getSidecarBaseUrl() to return a fixed URL
 *   - Mock Tauri invoke to return UTF-8 bytes for fs_read_file
 *   - Directly set skill-nav store state (open(id)) to simulate clicking a card
 *
 * Story: 6.4 — Skill Detail + Skill Editor (FR-003)
 */

import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetSummary } from "@zoeplane/shared-types";
import { SkillDetailView } from "../SkillDetailView";
import { useSkillNav } from "@/stores/skill-nav";

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

function makeSkillAsset(id: string): AssetSummary {
  return {
    id,
    kind: "skill",
    name: "My Skill",
    scope: "global",
    projectId: null,
    sourcePath: SKILL_SOURCE_PATH,
    validationStatus: "valid",
    lastModifiedAt: Date.now() - 60_000,
    lastModifiedBy: "external",
    frontMatter: { name: "My Skill", description: "A test skill." },
    bodyExcerpt: null,
    provenance: null,
  };
}

/** Encode a string as byte array (what fs_read_file returns). */
function encodeUtf8(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

const SKILL_FILE_CONTENT = `---
name: My Skill
description: A test skill.
---

This is the skill body.
`;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset skill-nav store to library mode
  useSkillNav.setState({ selectedSkillId: null, mode: "library" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SkillDetailView — stale-closure regression (Critical Issue 1)", () => {
  it("renders loaded state (not error-not-found) when selectedSkillId is a UUID opened from the library", async () => {
    // Arrange: sidecar returns an asset whose id === the UUID
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ assets: [makeSkillAsset(SKILL_UUID)] }),
      }),
    );
    // fs_read_file returns the skill file bytes
    mockInvoke.mockResolvedValue(encodeUtf8(SKILL_FILE_CONTENT));

    // Simulate user clicking a SkillCard — sets selectedSkillId to UUID
    act(() => {
      useSkillNav.getState().open(SKILL_UUID);
    });

    render(<SkillDetailView />);

    // BEFORE fix: loadState would be "error-not-found" because `asset` is still
    // null at the point the closure reads it (stale closure bug).
    // AFTER fix: the local variable carries the resolved asset forward and the
    // view reaches "loaded" state.
    await waitFor(() => {
      expect(screen.queryByText("Skill file not found")).toBeNull();
    });

    await waitFor(() => {
      // The skill name heading should appear in the loaded state
      expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("My Skill");
    });
  });

  it("does NOT set loadState to error-not-found when asset is found in the assets API response", async () => {
    // Same as above but with an explicit assertion on absence of error state
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ assets: [makeSkillAsset(SKILL_UUID)] }),
      }),
    );
    mockInvoke.mockResolvedValue(encodeUtf8(SKILL_FILE_CONTENT));

    act(() => {
      useSkillNav.getState().open(SKILL_UUID);
    });

    render(<SkillDetailView />);

    // Loading state first
    expect(screen.queryByText("Skill file not found")).toBeNull();

    // After async resolution: still no error
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
        json: () => Promise.resolve({ assets: [makeSkillAsset(SKILL_UUID)] }),
      }),
    );
    mockInvoke.mockResolvedValue(encodeUtf8(SKILL_FILE_CONTENT));

    act(() => {
      useSkillNav.getState().open(SKILL_UUID);
    });

    render(<SkillDetailView />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "fs_read_file",
        expect.objectContaining({ path: SKILL_SOURCE_PATH }),
      );
    });
  });
});
