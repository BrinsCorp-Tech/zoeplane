// @vitest-environment node
/**
 * Integration tests for the FS Watcher Service — symlinked watch roots (CR-5).
 *
 * Regression suite confirming that chokidar fires events for files inside
 * symlinked watch roots after the followSymlinks: true fix.
 *
 * These tests use REAL chokidar against a tmpdir — do NOT mock chokidar.
 * No ~/.claude/ paths are touched; the tests are fully isolated.
 *
 * See ADR-005 §"Symlinked Watch Roots (followSymlinks: true)" for rationale.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  subscribeToWatcherEvents,
  stopWatcher,
  __test_only__startWatcherForRoots,
} from "../watcher";
import {
  WATCHER_ASSET_UPDATED,
  type AssetIndexUpdatedEvent,
  type WatcherEvent,
} from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect AssetIndexUpdatedEvent payloads from the watcher subscription. */
function collectEvents(): { events: AssetIndexUpdatedEvent[]; unsubscribe: () => void } {
  const events: AssetIndexUpdatedEvent[] = [];
  const unsubscribe = subscribeToWatcherEvents((e: WatcherEvent) => {
    if (e.type === WATCHER_ASSET_UPDATED) {
      events.push(e as AssetIndexUpdatedEvent);
    }
  });
  return { events, unsubscribe };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(() => {
  // Guard: the test-only export must be available (NODE_ENV=test).
  if (!__test_only__startWatcherForRoots) {
    throw new Error("watcher.__test_only__startWatcherForRoots is undefined — set NODE_ENV=test");
  }

  tmpRoot = mkdtempSync(join(tmpdir(), "zp-watcher-it-"));
  // real-target/ — the actual directory the symlink points at.
  mkdirSync(join(tmpRoot, "real-target"), { recursive: true });
  // symlinked-root → real-target (simulates PAI ~/.claude/skills symlink)
  symlinkSync(join(tmpRoot, "real-target"), join(tmpRoot, "symlinked-root"));
});

afterEach(async () => {
  // Always stop the shared watcher and clean up tmpdir.
  await stopWatcher();
  rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("watcher integration — symlinked watch roots (CR-5 regression)", () => {
  it("fires an AssetIndexUpdatedEvent for a depth-1 file under a symlinked watch root", async () => {
    const { events, unsubscribe } = collectEvents();

    // Add the SYMLINK path as the watch root (not the realpath).
    __test_only__startWatcherForRoots!([join(tmpRoot, "symlinked-root")]);

    // Allow chokidar to reach the "ready" state before writing.
    await sleep(300);

    // Write a file into the real target — should fire via the symlink.
    writeFileSync(join(tmpRoot, "real-target", "depth1.md"), "hello");

    // Wait for 250 ms debounce + buffer.
    await sleep(600);

    unsubscribe();

    const match = events.find((e) => e.path.includes("depth1.md"));
    expect(match).toBeDefined();
    expect(match?.eventKind).toBe("created");
  }, 10_000);

  it("fires an AssetIndexUpdatedEvent for a depth-2 file under a symlinked watch root", async () => {
    const { events, unsubscribe } = collectEvents();

    __test_only__startWatcherForRoots!([join(tmpRoot, "symlinked-root")]);

    await sleep(300);

    // Create a subdirectory first, then write into it.
    mkdirSync(join(tmpRoot, "real-target", "sub"), { recursive: true });
    await sleep(100);
    writeFileSync(join(tmpRoot, "real-target", "sub", "depth2.md"), "nested");

    await sleep(600);

    unsubscribe();

    const match = events.find((e) => e.path.includes("depth2.md"));
    expect(match).toBeDefined();
    expect(match?.eventKind).toBe("created");
  }, 10_000);

  it("fires an AssetIndexUpdatedEvent for a depth-1 file under a NON-symlinked (real) watch root — regression guard", async () => {
    const { events, unsubscribe } = collectEvents();

    // Watch the real directory directly (not via symlink).
    __test_only__startWatcherForRoots!([join(tmpRoot, "real-target")]);

    await sleep(300);

    writeFileSync(join(tmpRoot, "real-target", "depth1-real.md"), "real");

    await sleep(600);

    unsubscribe();

    const match = events.find((e) => e.path.includes("depth1-real.md"));
    expect(match).toBeDefined();
    expect(match?.eventKind).toBe("created");
  }, 10_000);
});
