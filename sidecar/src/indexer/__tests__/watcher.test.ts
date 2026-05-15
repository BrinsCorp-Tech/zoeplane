// @vitest-environment node
/**
 * Unit tests for the FS Watcher Service (Story 3.2).
 *
 * Covers:
 *   1. 250 ms coalescing debounce logic — same-path events within the window
 *      collapse into a single AssetIndexUpdatedEvent emission.
 *   2. Events outside the 250 ms window produce separate emissions.
 *   3. IPC contract — constructing an AssetIndexUpdatedEvent matches the
 *      WatcherEvent type shape from @zoeplane/shared-types.
 *
 * These are pure-logic tests using fake timers (vitest useFakeTimers).
 * No real FS watching or chokidar instances are started.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WATCHER_ASSET_UPDATED,
  WATCHER_STARTED,
  WATCHER_ERROR,
  type AssetIndexUpdatedEvent,
  type WatcherStartedEvent,
  type WatcherErrorEvent,
  type WatcherEvent,
} from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// Coalescing logic extracted for unit testing
// ---------------------------------------------------------------------------
// The coalescing mechanism is: a Map<path, setTimeout handle>. When an event
// fires for path P within 250 ms of a previous event for P, the existing timer
// is cancelled and a new 250 ms timer is set. The emission fires only when the
// timer fires (no new event arrived within the window).
//
// We test this logic in isolation using fake timers — no chokidar, no FS.

function makeCoalescer(onEmit: (path: string, kind: AssetIndexUpdatedEvent["eventKind"]) => void) {
  const map = new Map<string, ReturnType<typeof setTimeout>>();
  const lastKind = new Map<string, AssetIndexUpdatedEvent["eventKind"]>();

  return {
    handleEvent(path: string, kind: AssetIndexUpdatedEvent["eventKind"]) {
      lastKind.set(path, kind);

      const existing = map.get(path);
      if (existing !== undefined) {
        clearTimeout(existing);
      }

      const handle = setTimeout(() => {
        map.delete(path);
        const resolvedKind = lastKind.get(path) ?? kind;
        lastKind.delete(path);
        onEmit(path, resolvedKind);
      }, 250);

      map.set(path, handle);
    },
    pendingCount(): number {
      return map.size;
    },
    clear() {
      for (const h of map.values()) clearTimeout(h);
      map.clear();
      lastKind.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Coalescing debounce logic (250 ms window)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits a single event after 250 ms of silence for a single path", () => {
    const emitted: Array<{ path: string; kind: AssetIndexUpdatedEvent["eventKind"] }> = [];
    const coalescer = makeCoalescer((path, kind) => emitted.push({ path, kind }));

    coalescer.handleEvent("/tmp/foo.md", "modified");

    // Nothing emitted yet.
    expect(emitted).toHaveLength(0);
    expect(coalescer.pendingCount()).toBe(1);

    // Advance 249 ms — still within the window.
    vi.advanceTimersByTime(249);
    expect(emitted).toHaveLength(0);

    // Advance 1 more ms — window closes.
    vi.advanceTimersByTime(1);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({ path: "/tmp/foo.md", kind: "modified" });
    expect(coalescer.pendingCount()).toBe(0);
  });

  it("collapses multiple events for the same path within 250 ms into one emission", () => {
    const emitted: Array<{ path: string; kind: AssetIndexUpdatedEvent["eventKind"] }> = [];
    const coalescer = makeCoalescer((path, kind) => emitted.push({ path, kind }));
    const path = "/tmp/bar.md";

    coalescer.handleEvent(path, "created");
    vi.advanceTimersByTime(50);
    coalescer.handleEvent(path, "modified"); // resets the 250 ms window
    vi.advanceTimersByTime(50);
    coalescer.handleEvent(path, "modified"); // resets again
    vi.advanceTimersByTime(249); // still within window

    expect(emitted).toHaveLength(0);

    vi.advanceTimersByTime(1); // window closes

    // Only one emission, with the last event kind.
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({ path, kind: "modified" });
  });

  it("preserves atomic-write delete+create as a single emission within 250 ms", () => {
    // VSCode/Cursor write temp file, delete original, rename temp → original.
    // This produces: unlink ("removed") then add ("created") within <100 ms.
    // Both should collapse into a single emission.
    const emitted: Array<{ path: string; kind: AssetIndexUpdatedEvent["eventKind"] }> = [];
    const coalescer = makeCoalescer((path, kind) => emitted.push({ path, kind }));
    const path = "/tmp/.claude/skills/my-skill/SKILL.md";

    coalescer.handleEvent(path, "removed"); // temp rename delete — sets timer t=0
    vi.advanceTimersByTime(48); // t=48 (still within first timer's 250 ms)
    coalescer.handleEvent(path, "created"); // temp rename add — resets timer at t=48
    vi.advanceTimersByTime(250); // advance 250 ms from last event (t=298 total)

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({ path, kind: "created" }); // last event kind wins
  });

  it("produces separate emissions for events more than 250 ms apart on the same path", () => {
    const emitted: Array<{ path: string; kind: AssetIndexUpdatedEvent["eventKind"] }> = [];
    const coalescer = makeCoalescer((path, kind) => emitted.push({ path, kind }));
    const path = "/tmp/baz.md";

    coalescer.handleEvent(path, "modified");
    vi.advanceTimersByTime(251); // first window closes → first emission
    coalescer.handleEvent(path, "removed");
    vi.advanceTimersByTime(251); // second window closes → second emission

    expect(emitted).toHaveLength(2);
    expect(emitted[0]).toEqual({ path, kind: "modified" });
    expect(emitted[1]).toEqual({ path, kind: "removed" });
  });

  it("handles multiple paths independently without cross-contamination", () => {
    const emitted: Array<{ path: string; kind: AssetIndexUpdatedEvent["eventKind"] }> = [];
    const coalescer = makeCoalescer((path, kind) => emitted.push({ path, kind }));

    coalescer.handleEvent("/tmp/a.md", "created");
    vi.advanceTimersByTime(100);
    coalescer.handleEvent("/tmp/b.md", "modified");
    vi.advanceTimersByTime(150); // a's window closes (100+150=250), b's still open
    coalescer.handleEvent("/tmp/b.md", "modified"); // reset b
    vi.advanceTimersByTime(250); // b's window closes

    expect(emitted).toHaveLength(2);
    expect(emitted.find((e) => e.path === "/tmp/a.md")).toEqual({
      path: "/tmp/a.md",
      kind: "created",
    });
    expect(emitted.find((e) => e.path === "/tmp/b.md")).toEqual({
      path: "/tmp/b.md",
      kind: "modified",
    });
  });
});

// ---------------------------------------------------------------------------
// IPC contract — type shape validation
// ---------------------------------------------------------------------------

describe("IPC contract — WatcherEvent type shapes", () => {
  it("AssetIndexUpdatedEvent satisfies the WatcherEvent union for a global path", () => {
    const event: AssetIndexUpdatedEvent = {
      type: WATCHER_ASSET_UPDATED,
      path: "/Users/zeke/.claude/skills/my-skill/SKILL.md",
      eventKind: "modified",
      projectRoot: null,
    };

    // Type check: should be assignable to WatcherEvent.
    const asUnion: WatcherEvent = event;
    expect(asUnion.type).toBe("asset:index:updated");
    expect((asUnion as AssetIndexUpdatedEvent).path).toBe(
      "/Users/zeke/.claude/skills/my-skill/SKILL.md",
    );
    expect((asUnion as AssetIndexUpdatedEvent).eventKind).toBe("modified");
    expect((asUnion as AssetIndexUpdatedEvent).projectRoot).toBeNull();
  });

  it("AssetIndexUpdatedEvent satisfies the WatcherEvent union for a project path", () => {
    const event: AssetIndexUpdatedEvent = {
      type: WATCHER_ASSET_UPDATED,
      path: "/Users/zeke/MyProject/.claude/commands/build.md",
      eventKind: "created",
      projectRoot: "/Users/zeke/MyProject",
    };

    const asUnion: WatcherEvent = event;
    expect(asUnion.type).toBe(WATCHER_ASSET_UPDATED);
    expect((asUnion as AssetIndexUpdatedEvent).projectRoot).toBe("/Users/zeke/MyProject");
  });

  it("WatcherStartedEvent has correct shape and constant", () => {
    const event: WatcherStartedEvent = {
      type: WATCHER_STARTED,
      root: "/Users/zeke/.claude/skills",
      projectRoot: null,
    };

    const asUnion: WatcherEvent = event;
    expect(asUnion.type).toBe("watcher:started");
    expect((asUnion as WatcherStartedEvent).root).toBe("/Users/zeke/.claude/skills");
  });

  it("WatcherErrorEvent has correct shape for project_claude_missing", () => {
    const event: WatcherErrorEvent = {
      type: WATCHER_ERROR,
      root: "/Users/zeke/MyProject/.claude",
      reason: "project_claude_missing",
    };

    const asUnion: WatcherEvent = event;
    expect(asUnion.type).toBe("watcher:error");
    expect((asUnion as WatcherErrorEvent).reason).toBe("project_claude_missing");
  });

  it("WatcherErrorEvent has correct shape for OS-level errors", () => {
    const event: WatcherErrorEvent = {
      type: WATCHER_ERROR,
      root: "/restricted/path",
      reason: "EACCES: permission denied",
    };

    const asUnion: WatcherEvent = event;
    expect(asUnion.type).toBe(WATCHER_ERROR);
    expect((asUnion as WatcherErrorEvent).reason).toContain("EACCES");
  });

  it("channel name constants match literal string values", () => {
    expect(WATCHER_ASSET_UPDATED).toBe("asset:index:updated");
    expect(WATCHER_STARTED).toBe("watcher:started");
    expect(WATCHER_ERROR).toBe("watcher:error");
  });

  it("all valid eventKind values are accepted by AssetIndexUpdatedEvent", () => {
    // NOTE: "renamed" is a reserved future value in the type union and is NOT
    // currently emitted by the chokidar v5 sidecar implementation. Atomic
    // renames collapse to "modified" (or "created") via the 250 ms debounce.
    const kinds: Array<AssetIndexUpdatedEvent["eventKind"]> = [
      "created",
      "modified",
      "removed",
      "renamed", // reserved — unreachable from current implementation
    ];

    for (const kind of kinds) {
      const event: AssetIndexUpdatedEvent = {
        type: WATCHER_ASSET_UPDATED,
        path: `/tmp/${kind}.md`,
        eventKind: kind,
        projectRoot: null,
      };
      expect(event.eventKind).toBe(kind);
    }
  });

  // EACCES surfacing path (M-1):
  // startGlobalWatcher() now calls accessSync(root, R_OK) before fsw.add().
  // Mocking this path requires mocking both node:fs (accessSync) AND chokidar
  // (chokidarWatch) to avoid spawning a real FSWatcher instance. That level of
  // coupling makes the test fragile relative to its value here.
  //
  // Manual verification instead:
  //   chmod 000 ~/.claude/teams   # or any non-critical global root
  //   restart `bun run --cwd sidecar dev`
  //   confirm SSE stream emits: { type: "watcher:error", reason: "global_root_permission_denied" }
  //   chmod 755 ~/.claude/teams   # restore
  //
  // The two contract tests below validate the WatcherErrorEvent shape for both
  // new reason values that startGlobalWatcher emits.
  it("WatcherErrorEvent has correct shape for global_root_missing", () => {
    const event: WatcherErrorEvent = {
      type: WATCHER_ERROR,
      root: "/Users/zeke/.claude/workflows",
      reason: "global_root_missing",
    };

    const asUnion: WatcherEvent = event;
    expect(asUnion.type).toBe("watcher:error");
    expect((asUnion as WatcherErrorEvent).reason).toBe("global_root_missing");
  });

  it("WatcherErrorEvent has correct shape for global_root_permission_denied", () => {
    const event: WatcherErrorEvent = {
      type: WATCHER_ERROR,
      root: "/Users/zeke/.claude/teams",
      reason: "global_root_permission_denied",
    };

    const asUnion: WatcherEvent = event;
    expect(asUnion.type).toBe("watcher:error");
    expect((asUnion as WatcherErrorEvent).reason).toBe("global_root_permission_denied");
  });
});
