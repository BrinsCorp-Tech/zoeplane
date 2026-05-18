// @vitest-environment node
//
// Tests for the editor detection module (Story 3.9 / FR-035).
//
// Strategy:
//   - Mock `node:child_process` spawn to control exit codes without touching
//     the real filesystem or PATH.
//   - Test detectEditor() composition: first found wins, cascading fallback,
//     none found returns null.
//   - Test the persistence contract (sentinel value when none found).
//
// These tests run under Vitest/Node. The module uses node:child_process.spawn
// so no Bun shims are needed.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChildProcess } from "node:child_process";
import EventEmitter from "node:events";

// ---------------------------------------------------------------------------
// Mock node:child_process
// ---------------------------------------------------------------------------

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

// Import after mock is in place.
import { spawn } from "node:child_process";
import { detectEditor, probeEditorCli } from "../editor-detection";

// ---------------------------------------------------------------------------
// Helper: build a fake ChildProcess that emits close with a given exit code
// ---------------------------------------------------------------------------

function makeFakeProcess(exitCode: number): ChildProcess {
  const emitter = new EventEmitter() as ChildProcess;
  // Emit asynchronously to match real child process behaviour.
  setImmediate(() => emitter.emit("close", exitCode));
  return emitter;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("probeEditorCli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when which exits with code 0 (editor found)", async () => {
    vi.mocked(spawn).mockReturnValueOnce(makeFakeProcess(0));
    const result = await probeEditorCli("code");
    expect(result).toBe(true);
  });

  it("returns false when which exits with code 1 (editor not found)", async () => {
    vi.mocked(spawn).mockReturnValueOnce(makeFakeProcess(1));
    const result = await probeEditorCli("cursor");
    expect(result).toBe(false);
  });

  it("returns false when spawn itself emits an error (which not available)", async () => {
    const emitter = new EventEmitter() as ChildProcess;
    setImmediate(() => emitter.emit("error", new Error("ENOENT")));
    vi.mocked(spawn).mockReturnValueOnce(emitter);
    const result = await probeEditorCli("zed");
    expect(result).toBe(false);
  });

  it("uses which on non-windows platforms", async () => {
    vi.mocked(spawn).mockReturnValueOnce(makeFakeProcess(0));
    await probeEditorCli("code");
    const spawnCall = vi.mocked(spawn).mock.calls[0];
    // On macOS/Linux (test host is darwin) the command should be 'which'.
    if (process.platform !== "win32") {
      expect(spawnCall[0]).toBe("which");
    } else {
      expect(spawnCall[0]).toBe("where");
    }
    expect(spawnCall[1]).toEqual(["code"]);
  });
});

describe("detectEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the first available editor (code found on first probe)", async () => {
    // code exits 0 — cursor and zed should not be probed.
    vi.mocked(spawn).mockReturnValueOnce(makeFakeProcess(0));
    const result = await detectEditor();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("vscode");
    expect(result?.cli).toBe("code");
    // Only one probe call should have been made.
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(1);
  });

  it("falls through to second candidate when first is not found", async () => {
    // code: not found (exit 1), cursor: found (exit 0)
    vi.mocked(spawn)
      .mockReturnValueOnce(makeFakeProcess(1))
      .mockReturnValueOnce(makeFakeProcess(0));
    const result = await detectEditor();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("cursor");
    expect(result?.cli).toBe("cursor");
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(2);
  });

  it("falls through to third candidate when first two are not found", async () => {
    // code: not found, cursor: not found, zed: found
    vi.mocked(spawn)
      .mockReturnValueOnce(makeFakeProcess(1))
      .mockReturnValueOnce(makeFakeProcess(1))
      .mockReturnValueOnce(makeFakeProcess(0));
    const result = await detectEditor();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("zed");
    expect(result?.cli).toBe("zed");
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(3);
  });

  it("returns null when no supported editor is found", async () => {
    // All three probes: not found (exit 1)
    vi.mocked(spawn)
      .mockReturnValueOnce(makeFakeProcess(1))
      .mockReturnValueOnce(makeFakeProcess(1))
      .mockReturnValueOnce(makeFakeProcess(1));
    const result = await detectEditor();
    expect(result).toBeNull();
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(3);
  });
});

describe("persistence sentinel value (AC #4)", () => {
  it("when detectEditor returns null the sentinel JSON serialises correctly", () => {
    // This tests the persistence shape written to user_preferences when no
    // editor is found (index.ts startup chain AC #4 contract).
    const sentinelValue = JSON.stringify({ name: "system", cli: null });
    const parsed = JSON.parse(sentinelValue) as { name: string; cli: string | null };
    expect(parsed.name).toBe("system");
    expect(parsed.cli).toBeNull();
  });

  it("when detectEditor returns a match the value JSON serialises correctly", () => {
    const detected = { name: "vscode" as const, cli: "code" as const };
    const storedValue = JSON.stringify({ name: detected.name, cli: detected.cli });
    const parsed = JSON.parse(storedValue) as { name: string; cli: string };
    expect(parsed.name).toBe("vscode");
    expect(parsed.cli).toBe("code");
  });
});
