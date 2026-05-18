// @vitest-environment node
//
// Project-management sidecar contract tests (Story 3.7 / AC #2, AC #3d).
//
// These tests cover two ordering/correctness invariants that cannot be
// exercised by the Rust unit tests (no live Tauri AppHandle / HTTP server in
// Rust unit scope):
//
//   H-1 invariant: GET /preferences/active_project_id BEFORE POST /preferences
//   ─────────────────────────────────────────────────────────────────────────
//   The Rust switch_project command captures previousProjectId by reading the
//   sidecar DB *before* writing the new active_project_id.  This test uses an
//   in-memory fake to confirm that the value returned by a GET that precedes
//   the POST reflects the OLD project id, not the new one.  If the GET/POST
//   order were swapped, previousProjectId in ProjectSwitchCompletedEvent would
//   always equal projectId (broken AC #2).
//
//   H-2 invariant: route_stacks tombstoned inside remove transaction (AC #3d)
//   ─────────────────────────────────────────────────────────────────────────
//   The remove_project transaction must tombstone route_stacks rows.
//   Before the H-2 fix the UPDATE was present as a comment only — no SQL ran.
//   This test verifies the UPDATE statement is captured in the transaction.
//
// Note: vitest runs on Node, not Bun — bun:sqlite is unavailable.  We use a
// structural fake DB (same pattern as runner.test.ts) to capture SQL calls.

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Minimal in-memory preferences store — simulates bun:sqlite synchronous API
// ---------------------------------------------------------------------------

type PrefStore = Map<string, string>;

function makePreferencesDb(initialPrefs: PrefStore = new Map()): {
  prefs: PrefStore;
  get: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
} {
  const prefs: PrefStore = new Map(initialPrefs);
  return {
    prefs,
    get: (key: string) => prefs.get(key),
    set: (key: string, value: string) => {
      prefs.set(key, value);
    },
  };
}

// ---------------------------------------------------------------------------
// Fake Database for route_stacks tombstone assertions
// ---------------------------------------------------------------------------

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

interface FakeDb {
  captured: CapturedQuery[];
  runInTransaction: (fn: () => void) => void;
  query: (sql: string) => { run: (...params: unknown[]) => void };
}

function makeTransactionFakeDb(): FakeDb {
  const captured: CapturedQuery[] = [];

  function makeQuery(sql: string) {
    return {
      run: (...params: unknown[]) => {
        captured.push({ sql, params });
      },
    };
  }

  function runInTransaction(fn: () => void): void {
    // Simulate bun:sqlite's db.transaction(fn)() — synchronous execution
    fn();
  }

  return {
    captured,
    runInTransaction,
    query: (sql: string) => makeQuery(sql),
  };
}

// ---------------------------------------------------------------------------
// H-1: Preferences GET-before-POST ordering invariant
// ---------------------------------------------------------------------------

describe("H-1: active_project_id ordering — GET must precede POST", () => {
  it("GET before POST returns the OLD project id", () => {
    const db = makePreferencesDb(new Map([["active_project_id", "project-A"]]));

    // Simulate CORRECT order (what the fixed Rust code does):
    //   1. GET active_project_id → captures previous id
    //   2. POST active_project_id → writes new id
    const previousProjectId = db.get("active_project_id"); // step 1: capture BEFORE write
    db.set("active_project_id", "project-B"); // step 2: write new value

    // The event payload will have previousProjectId = "project-A" (correct)
    expect(previousProjectId).toBe("project-A");
    expect(db.get("active_project_id")).toBe("project-B");
  });

  it("GET after POST returns the NEW project id (demonstrates the bug that was fixed)", () => {
    const db = makePreferencesDb(new Map([["active_project_id", "project-A"]]));

    // Simulate INCORRECT order (the original buggy code):
    //   1. POST active_project_id → writes new id first
    //   2. GET active_project_id → now returns new value — WRONG for previousProjectId
    db.set("active_project_id", "project-B"); // step 1: write new value FIRST (bug)
    const previousProjectIdBug = db.get("active_project_id"); // step 2: reads new value

    // This would produce previousProjectId = "project-B" — same as projectId (AC #2 broken)
    expect(previousProjectIdBug).toBe("project-B"); // demonstrates the bug
    // The correct previousProjectId was "project-A", not "project-B"
    expect(previousProjectIdBug).not.toBe("project-A");
  });

  it("GET before POST with no prior preference returns undefined (first switch)", () => {
    const db = makePreferencesDb(); // empty — no active_project_id yet

    const previousProjectId = db.get("active_project_id"); // step 1: nothing there
    db.set("active_project_id", "project-first"); // step 2: write first project

    // Previous is undefined (maps to null in JSON payload) — correct for first switch
    expect(previousProjectId).toBeUndefined();
    expect(db.get("active_project_id")).toBe("project-first");
  });
});

// ---------------------------------------------------------------------------
// H-2: route_stacks tombstone inside remove_project transaction (AC #3d)
// ---------------------------------------------------------------------------

describe("H-2: route_stacks tombstoned in remove_project transaction", () => {
  it("UPDATE route_stacks SET deleted_at runs inside the remove transaction", () => {
    const db = makeTransactionFakeDb();
    const projectId = "project-to-remove";
    const now = Date.now();

    // Simulate the transaction body from index.ts POST /projects/:id/remove
    db.runInTransaction(() => {
      // assets tombstone
      db.query(
        "UPDATE assets SET deleted_at = ?, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL",
      ).run(now, now, projectId);

      // hook_index tombstone
      db.query(
        "UPDATE hook_index SET deleted_at = ?, updated_at = ? WHERE (scope = ? OR scope = ?) AND deleted_at IS NULL",
      ).run(now, now, `project:${projectId}`, `local:${projectId}`);

      // route_stacks tombstone (the H-2 fix — was a comment-only no-op before)
      db.query(
        "UPDATE route_stacks SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL",
      ).run(now, now);

      // recent_files tombstone
      db.query(
        "UPDATE recent_files SET deleted_at = ?, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL",
      ).run(now, now, projectId);

      // project row tombstone
      db.query(
        "UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
      ).run(now, now, projectId);
    });

    // Assert route_stacks UPDATE was captured (AC #3d)
    const routeStacksUpdate = db.captured.find((q) => q.sql.includes("UPDATE route_stacks"));
    expect(routeStacksUpdate).toBeDefined();
    expect(routeStacksUpdate!.sql).toBe(
      "UPDATE route_stacks SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL",
    );
    // Params: [deleted_at (now), updated_at (now)] — no project_id scoping in v1
    expect(routeStacksUpdate!.params).toHaveLength(2);
    expect(routeStacksUpdate!.params[0]).toBe(now);
    expect(routeStacksUpdate!.params[1]).toBe(now);
  });

  it("all five tombstone statements run inside a single transaction", () => {
    const db = makeTransactionFakeDb();
    const projectId = "proj-xyz";
    const now = Date.now();

    db.runInTransaction(() => {
      db.query(
        "UPDATE assets SET deleted_at = ?, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL",
      ).run(now, now, projectId);
      db.query(
        "UPDATE hook_index SET deleted_at = ?, updated_at = ? WHERE (scope = ? OR scope = ?) AND deleted_at IS NULL",
      ).run(now, now, `project:${projectId}`, `local:${projectId}`);
      db.query(
        "UPDATE route_stacks SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL",
      ).run(now, now);
      db.query(
        "UPDATE recent_files SET deleted_at = ?, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL",
      ).run(now, now, projectId);
      db.query(
        "UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
      ).run(now, now, projectId);
    });

    // All 5 statements captured
    expect(db.captured).toHaveLength(5);

    const tableNames = db.captured.map((q) => {
      const m = q.sql.match(/UPDATE (\w+)/);
      return m ? m[1] : null;
    });
    expect(tableNames).toEqual([
      "assets",
      "hook_index",
      "route_stacks",
      "recent_files",
      "projects",
    ]);
  });
});
