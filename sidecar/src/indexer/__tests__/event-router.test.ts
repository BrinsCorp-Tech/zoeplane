// @vitest-environment node
/**
 * Tests for the watcher event router (Story 3.8, FR-007).
 *
 * Tests AC behaviours using:
 *   - vi.mock() to replace validator, resolver, scanner, and watcher modules
 *   - A captured watcher callback extracted at vi.mock time
 *   - subscribeToEventRouterEvents to capture emitted events
 *
 * Architecture: vi.mock() replaces module implementations at module-graph level.
 * The event-router imports from these modules so mocked versions are used.
 * The watcher mock captures the callback passed to subscribeToWatcherEvents
 * so tests can inject events directly.
 *
 * No real FS watching, no ~/.claude/ access, no bun:sqlite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Database } from "bun:sqlite";
import {
  LIBRARY_REFRESH,
  ASSET_EXTERNALLY_MODIFIED_WHILE_OPEN,
  WATCHER_ASSET_UPDATED,
  type WatcherEvent,
  type AssetIndexUpdatedEvent,
  type LibraryRefreshEvent,
  type AssetExternallyModifiedWhileOpenEvent,
} from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// Module-level captured state for the watcher mock
// ---------------------------------------------------------------------------

// The watcher subscriber callback registered by initEventRouter.
let _watcherCallback: ((e: WatcherEvent) => void) | null = null;

// isPathWatched return value — tests override this per-scenario.
let _isPathWatched = false;

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

vi.mock("../watcher", () => ({
  subscribeToWatcherEvents: vi.fn((cb: (e: WatcherEvent) => void) => {
    _watcherCallback = cb;
    return () => {
      _watcherCallback = null;
    };
  }),
  isPathWatched: vi.fn((_path: string) => _isPathWatched),
}));

vi.mock("../validator", () => ({
  revalidateAsset: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../resolver", () => ({
  recomputeShadows: vi.fn(),
}));

vi.mock("../scanner", () => ({
  insertAssetRow: vi.fn().mockResolvedValue("new-asset-uuid"),
}));

// ---------------------------------------------------------------------------
// Import modules AFTER vi.mock() declarations
// ---------------------------------------------------------------------------

import {
  initEventRouter,
  subscribeToEventRouterEvents,
  type EventRouterHandle,
} from "../event-router";
import * as validatorMod from "../validator";
import * as scannerMod from "../scanner";
import * as watcherMod from "../watcher";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const HOME = "/home/testuser";
const CLAUDE_DIR = `${HOME}/.claude`;
const SKILL_PATH = `${CLAUDE_DIR}/skills/my-skill/SKILL.md`;
const AGENT_PATH = `${CLAUDE_DIR}/agents/my-agent.md`;
const SETTINGS_PATH = `${CLAUDE_DIR}/settings.json`;

const PROJECT_ROOT = "/projects/my-project";
const PROJECT_CLAUDE = `${PROJECT_ROOT}/.claude`;
const PROJECT_SKILL_PATH = `${PROJECT_CLAUDE}/skills/proj-skill/SKILL.md`;
const PROJECT_ID = "proj-uuid-1234";

// ---------------------------------------------------------------------------
// Minimal fake Database
// ---------------------------------------------------------------------------

interface FakeAssetRow {
  id: string;
  source_path: string;
  deleted_at: number | null;
}

interface FakeProjectRow {
  id: string;
  path: string;
}

function makeFakeDb(assetRows: FakeAssetRow[] = [], projectRows: FakeProjectRow[] = []): Database {
  const rows = assetRows.map((r) => ({ ...r }));
  const projects = projectRows.map((p) => ({ ...p }));

  return {
    query<T>(sql: string) {
      return {
        get(...params: unknown[]): T | null {
          if (sql.includes("SELECT id FROM assets WHERE source_path")) {
            const path = params[0] as string;
            const row = rows.find((r) => r.source_path === path && r.deleted_at === null);
            return (row ? { id: row.id } : null) as unknown as T | null;
          }
          if (sql.includes("SELECT id FROM projects WHERE path")) {
            const path = params[0] as string;
            const proj = projects.find((p) => p.path === path);
            return (proj ? { id: proj.id } : null) as unknown as T | null;
          }
          return null;
        },
        run(..._params: unknown[]): unknown {
          return { changes: 1, lastInsertRowid: 0 };
        },
        all(): T[] {
          return [] as T[];
        },
      };
    },
    prepare(_sql: string) {
      return {
        run: vi.fn().mockReturnValue({ changes: 0, lastInsertRowid: 0 }),
        get: vi.fn().mockReturnValue(null),
        all: vi.fn().mockReturnValue([]),
        finalize: vi.fn(),
      };
    },
    transaction(fn: (...args: unknown[]) => unknown) {
      return fn;
    },
  } as unknown as Database;
}

// ---------------------------------------------------------------------------
// Helper to inject a watcher event into the router's callback
// ---------------------------------------------------------------------------

function fireWatcherEvent(event: AssetIndexUpdatedEvent): void {
  if (_watcherCallback === null) {
    throw new Error("No watcher callback registered — did initEventRouter run?");
  }
  _watcherCallback(event);
}

// ---------------------------------------------------------------------------
// Test setup / teardown
// ---------------------------------------------------------------------------

let routerHandle: EventRouterHandle | null = null;
let capturedEvents: WatcherEvent[] = [];
let unsubscribeEventRouter: (() => void) | null = null;

// Override HOME so deriveClaudeRoot works in tests.
const originalEnv = process.env.HOME;

beforeEach(() => {
  capturedEvents = [];
  _watcherCallback = null;
  _isPathWatched = false;
  process.env.HOME = HOME;

  unsubscribeEventRouter = subscribeToEventRouterEvents((event) => {
    capturedEvents.push(event);
  });

  vi.clearAllMocks();

  // Re-apply mock implementations after clearAllMocks() resets them.
  vi.mocked(validatorMod.revalidateAsset).mockResolvedValue(undefined);
  vi.mocked(scannerMod.insertAssetRow).mockResolvedValue("new-asset-uuid");
  vi.mocked(watcherMod.subscribeToWatcherEvents).mockImplementation(
    (cb: (e: WatcherEvent) => void) => {
      _watcherCallback = cb;
      return () => {
        _watcherCallback = null;
      };
    },
  );
  vi.mocked(watcherMod.isPathWatched).mockImplementation(() => _isPathWatched);
});

afterEach(() => {
  if (routerHandle !== null) {
    routerHandle.unsubscribe();
    routerHandle = null;
  }
  if (unsubscribeEventRouter !== null) {
    unsubscribeEventRouter();
    unsubscribeEventRouter = null;
  }
  process.env.HOME = originalEnv;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flushPromises(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EventRouter — Story 3.8 AC coverage", () => {
  // -------------------------------------------------------------------------
  // Structural / wiring
  // -------------------------------------------------------------------------
  describe("initEventRouter — handle shape", () => {
    it("returns a handle with unsubscribe, registerOpenEditor, unregisterOpenEditor", () => {
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      expect(typeof routerHandle.unsubscribe).toBe("function");
      expect(typeof routerHandle.registerOpenEditor).toBe("function");
      expect(typeof routerHandle.unregisterOpenEditor).toBe("function");
    });

    it("subscribes to watcher events on init", () => {
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      expect(watcherMod.subscribeToWatcherEvents).toHaveBeenCalledTimes(1);
      expect(_watcherCallback).not.toBeNull();
    });

    it("unsubscribe() does not throw", () => {
      const db = makeFakeDb();
      const handle = initEventRouter(db, {});

      expect(() => handle.unsubscribe()).not.toThrow();
      routerHandle = null;
    });
  });

  // -------------------------------------------------------------------------
  // AC #7 — registerOpenEditor rejects unwatched paths
  // -------------------------------------------------------------------------
  describe("AC #7 — registerOpenEditor rejects unwatched paths", () => {
    it("returns path_not_watched error when isPathWatched returns false", () => {
      _isPathWatched = false;
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      const result = routerHandle.registerOpenEditor(SKILL_PATH);

      expect(result).not.toBeNull();
      expect(result?.code).toBe("path_not_watched");
      expect(result?.path).toContain("my-skill");
    });

    it("returns null (success) when isPathWatched returns true", () => {
      _isPathWatched = true;
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      const result = routerHandle.registerOpenEditor(SKILL_PATH);

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // AC #3 — unregisterOpenEditor
  // -------------------------------------------------------------------------
  describe("AC #3 — unregisterOpenEditor", () => {
    it("does not throw for an unregistered path", () => {
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      expect(() => routerHandle!.unregisterOpenEditor(SKILL_PATH)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Event type filtering
  // -------------------------------------------------------------------------
  describe("event type filtering", () => {
    it("ignores non-AssetIndexUpdatedEvent events", async () => {
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      _watcherCallback!({
        type: "watcher:started",
        root: CLAUDE_DIR,
        projectRoot: null,
      });
      await flushPromises();

      expect(validatorMod.revalidateAsset).not.toHaveBeenCalled();
      expect(capturedEvents).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // AC #1 — created event → INSERT + revalidate + LibraryRefreshEvent inserted
  // -------------------------------------------------------------------------
  describe("AC #1 — created event pipeline", () => {
    it("calls insertAssetRow for global created event", async () => {
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "created",
        projectRoot: null,
      });
      await flushPromises();

      expect(scannerMod.insertAssetRow).toHaveBeenCalledWith(db, SKILL_PATH, "global", null);
    });

    it("calls revalidateAsset after INSERT for created event", async () => {
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "created",
        projectRoot: null,
      });
      await flushPromises();

      expect(validatorMod.revalidateAsset).toHaveBeenCalledWith(db, SKILL_PATH, "skill");
    });

    it("emits LibraryRefreshEvent with action=inserted for global created event", async () => {
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "created",
        projectRoot: null,
      });
      await flushPromises();

      const refreshEvents = capturedEvents.filter(
        (e) => e.type === LIBRARY_REFRESH,
      ) as LibraryRefreshEvent[];
      expect(refreshEvents).toHaveLength(1);
      expect(refreshEvents[0].action).toBe("inserted");
      expect(refreshEvents[0].kind).toBe("skill");
      expect(refreshEvents[0].scope).toBe("global");
      expect(refreshEvents[0].projectId).toBeNull();
      expect(refreshEvents[0].summary).toEqual({ created: 1, modified: 0, removed: 0 });
    });

    it("emits LibraryRefreshEvent with project scope for project created event", async () => {
      const db = makeFakeDb([], [{ id: PROJECT_ID, path: PROJECT_ROOT }]);
      routerHandle = initEventRouter(db, {});

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: PROJECT_SKILL_PATH,
        eventKind: "created",
        projectRoot: PROJECT_ROOT,
      });
      await flushPromises();

      expect(scannerMod.insertAssetRow).toHaveBeenCalledWith(
        db,
        PROJECT_SKILL_PATH,
        "project",
        PROJECT_ID,
      );

      const refreshEvents = capturedEvents.filter(
        (e) => e.type === LIBRARY_REFRESH,
      ) as LibraryRefreshEvent[];
      expect(refreshEvents).toHaveLength(1);
      expect(refreshEvents[0].projectId).toBe(PROJECT_ID);
      expect(refreshEvents[0].scope).toBe("project");
      expect(refreshEvents[0].action).toBe("inserted");
    });
  });

  // -------------------------------------------------------------------------
  // AC #2 — modified event → revalidate + LibraryRefreshEvent updated
  // -------------------------------------------------------------------------
  describe("AC #2 — modified event pipeline", () => {
    it("calls revalidateAsset for modified event", async () => {
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "modified",
        projectRoot: null,
      });
      await flushPromises();

      expect(validatorMod.revalidateAsset).toHaveBeenCalledWith(db, SKILL_PATH, "skill");
    });

    it("does NOT call insertAssetRow for modified event", async () => {
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "modified",
        projectRoot: null,
      });
      await flushPromises();

      expect(scannerMod.insertAssetRow).not.toHaveBeenCalled();
    });

    it("emits LibraryRefreshEvent with action=updated for modified event", async () => {
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "modified",
        projectRoot: null,
      });
      await flushPromises();

      const refreshEvents = capturedEvents.filter(
        (e) => e.type === LIBRARY_REFRESH,
      ) as LibraryRefreshEvent[];
      expect(refreshEvents).toHaveLength(1);
      expect(refreshEvents[0].action).toBe("updated");
      expect(refreshEvents[0].kind).toBe("skill");
      expect(refreshEvents[0].summary).toEqual({ created: 0, modified: 1, removed: 0 });
    });

    it("works for agent paths (direct-md kind)", async () => {
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: AGENT_PATH,
        eventKind: "modified",
        projectRoot: null,
      });
      await flushPromises();

      expect(validatorMod.revalidateAsset).toHaveBeenCalledWith(db, AGENT_PATH, "agent");
    });
  });

  // -------------------------------------------------------------------------
  // AC #6 — removed event → tombstone + LibraryRefreshEvent removed
  // -------------------------------------------------------------------------
  describe("AC #6 — removed event tombstones the row", () => {
    it("emits LibraryRefreshEvent with action=removed for global removed event", async () => {
      const existingRow: FakeAssetRow = {
        id: "asset-001",
        source_path: SKILL_PATH,
        deleted_at: null,
      };
      const db = makeFakeDb([existingRow]);
      routerHandle = initEventRouter(db, {});

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "removed",
        projectRoot: null,
      });
      await flushPromises();

      const refreshEvents = capturedEvents.filter(
        (e) => e.type === LIBRARY_REFRESH,
      ) as LibraryRefreshEvent[];
      expect(refreshEvents).toHaveLength(1);
      expect(refreshEvents[0].action).toBe("removed");
      expect(refreshEvents[0].summary).toEqual({ created: 0, modified: 0, removed: 1 });
    });

    it("does NOT call revalidateAsset for removed event", async () => {
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "removed",
        projectRoot: null,
      });
      await flushPromises();

      expect(validatorMod.revalidateAsset).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // AC #5 — modified while open → AssetExternallyModifiedWhileOpenEvent
  // -------------------------------------------------------------------------
  describe("AC #5 — modified while open emits conflict event", () => {
    it("emits AssetExternallyModifiedWhileOpenEvent when path is in editorOpenSet", async () => {
      _isPathWatched = true;
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      // Register path as open.
      expect(routerHandle.registerOpenEditor(SKILL_PATH)).toBeNull();

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "modified",
        projectRoot: null,
      });
      await flushPromises();

      const conflictEvents = capturedEvents.filter(
        (e) => e.type === ASSET_EXTERNALLY_MODIFIED_WHILE_OPEN,
      ) as AssetExternallyModifiedWhileOpenEvent[];
      expect(conflictEvents).toHaveLength(1);
      expect(conflictEvents[0].path).toBe(SKILL_PATH);
      expect(conflictEvents[0].projectId).toBeNull();
    });

    it("still revalidates the data layer when path is open (AC #5a)", async () => {
      _isPathWatched = true;
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      routerHandle.registerOpenEditor(SKILL_PATH);

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "modified",
        projectRoot: null,
      });
      await flushPromises();

      expect(validatorMod.revalidateAsset).toHaveBeenCalledWith(db, SKILL_PATH, "skill");
    });

    it("does NOT emit LibraryRefreshEvent when path is open (AC #6 boundary)", async () => {
      _isPathWatched = true;
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      routerHandle.registerOpenEditor(SKILL_PATH);

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "modified",
        projectRoot: null,
      });
      await flushPromises();

      const refreshEvents = capturedEvents.filter((e) => e.type === LIBRARY_REFRESH);
      expect(refreshEvents).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // AC #3 — unregister resumes silent-reindex path
  // -------------------------------------------------------------------------
  describe("AC #3 — unregisterOpenEditor resumes silent path", () => {
    it("after unregister, modified event emits LibraryRefreshEvent (not conflict)", async () => {
      _isPathWatched = true;
      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      routerHandle.registerOpenEditor(SKILL_PATH);
      routerHandle.unregisterOpenEditor(SKILL_PATH);

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "modified",
        projectRoot: null,
      });
      await flushPromises();

      // LibraryRefreshEvent emitted (not conflict).
      const refreshEvents = capturedEvents.filter(
        (e) => e.type === LIBRARY_REFRESH,
      ) as LibraryRefreshEvent[];
      expect(refreshEvents).toHaveLength(1);
      expect(refreshEvents[0].action).toBe("updated");

      const conflictEvents = capturedEvents.filter(
        (e) => e.type === ASSET_EXTERNALLY_MODIFIED_WHILE_OPEN,
      );
      expect(conflictEvents).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Hook reindex delegation
  // -------------------------------------------------------------------------
  describe("settings.json hook reindex delegation", () => {
    it("calls reindexHooksForPath when event path ends with settings.json", async () => {
      const db = makeFakeDb();
      const reindexMock = vi.fn().mockResolvedValue(undefined);
      routerHandle = initEventRouter(db, { reindexHooksForPath: reindexMock });

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SETTINGS_PATH,
        eventKind: "modified",
        projectRoot: null,
      });
      await flushPromises();

      expect(reindexMock).toHaveBeenCalledWith(db, SETTINGS_PATH);
    });

    it("does NOT call reindexHooksForPath for regular asset paths", async () => {
      const db = makeFakeDb();
      const reindexMock = vi.fn().mockResolvedValue(undefined);
      routerHandle = initEventRouter(db, { reindexHooksForPath: reindexMock });

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "modified",
        projectRoot: null,
      });
      await flushPromises();

      expect(reindexMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // subscribeToEventRouterEvents
  // -------------------------------------------------------------------------
  describe("subscribeToEventRouterEvents", () => {
    it("returns an unsubscribe function", () => {
      const unsub = subscribeToEventRouterEvents(() => undefined);
      expect(typeof unsub).toBe("function");
      unsub();
    });

    it("unsubscribed listener does not receive events", async () => {
      const received: WatcherEvent[] = [];
      const unsub = subscribeToEventRouterEvents((e) => received.push(e));
      unsub(); // Unsubscribe immediately.

      const db = makeFakeDb();
      routerHandle = initEventRouter(db, {});

      fireWatcherEvent({
        type: WATCHER_ASSET_UPDATED,
        path: SKILL_PATH,
        eventKind: "modified",
        projectRoot: null,
      });
      await flushPromises();

      expect(received).toHaveLength(0);
    });
  });
});
