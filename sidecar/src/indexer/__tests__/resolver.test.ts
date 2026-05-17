// @vitest-environment node
/**
 * Tests for the project-overlay resolver (Story 3.4).
 *
 * Covers:
 *   - resolveAsset(): project row wins over global; global fallback; neither exists.
 *   - recomputeShadows(): clear step (a) + set step (b) atomicity; narrow filter;
 *     defensive no-op for unknown projectId.
 *   - composeScopeBadge(): three FR-075 badge forms.
 *   - pathToAssetIdentifier(): spot-checks via naming.ts (full coverage in naming.test.ts).
 *   - runShadowRecomputeAll(): iterates active projects; skips when table is empty.
 *
 * Vitest runs on Node — bun:sqlite is unavailable. We use a structural fake Database
 * (same pattern as scanner.test.ts) that stores rows in-memory and evaluates queries
 * against them using a minimal SQL-like dispatcher.
 *
 * For recomputeShadows() we use a query-capture fake that records UPDATE calls so we
 * can assert the correct SQL patterns are executed in the correct order.
 */

import { describe, it, expect } from "vitest";
import type { Database } from "bun:sqlite";
import {
  resolveAsset,
  recomputeShadows,
  composeScopeBadge,
  runShadowRecomputeAll,
} from "../resolver";

// ---------------------------------------------------------------------------
// Shared test-row factory
// ---------------------------------------------------------------------------

interface AssetRow {
  id: string;
  workspace_id: string;
  author_id: string;
  visibility: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  kind: string;
  name: string;
  scope: string;
  project_id: string | null;
  source_path: string;
  validation_status: string;
  shadowed_by_project_id: string | null;
  last_modified_by: string;
  last_modified_at: number;
  front_matter_json: string | null;
  body_excerpt: string | null;
}

function makeAssetRow(overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id: crypto.randomUUID(),
    workspace_id: "00000000-0000-0000-0000-000000000001",
    author_id: "00000000-0000-0000-0000-000000000001",
    visibility: "private",
    created_at: 1000,
    updated_at: 1000,
    deleted_at: null,
    kind: "skill",
    name: "foo",
    scope: "global",
    project_id: null,
    source_path: "/fake/path",
    validation_status: "valid",
    shadowed_by_project_id: null,
    last_modified_by: "external",
    last_modified_at: 1000,
    front_matter_json: null,
    body_excerpt: null,
    ...overrides,
  };
}

interface ProjectRow {
  id: string;
  display_name: string;
  path: string;
  deleted_at: null;
}

function makeProjectRow(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: "proj-1",
    display_name: "My Project",
    path: "/projects/my-project",
    deleted_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fake Database — resolveAsset path
//
// Stores assets[] and projects[] in memory. query() returns rows filtered by
// SQL pattern-matching on the WHERE clauses resolver.ts emits.
// ---------------------------------------------------------------------------

interface FakeResolveDb {
  db: Database;
  assets: AssetRow[];
  projects: ProjectRow[];
  updateCalls: Array<{ sql: string; params: unknown[] }>;
}

function makeFakeResolveDb(assets: AssetRow[] = [], projects: ProjectRow[] = []): FakeResolveDb {
  const updateCalls: Array<{ sql: string; params: unknown[] }> = [];

  const db = {
    query<T>(sql: string) {
      return {
        // .get() — returns first matching row or null
        get(...params: unknown[]): T | null {
          const result = queryRows<T>(sql, params, assets, projects, updateCalls);
          return result.length > 0 ? result[0] : null;
        },
        // .all() — returns all matching rows
        all(...params: unknown[]): T[] {
          return queryRows<T>(sql, params, assets, projects, updateCalls);
        },
        // .run() — for UPDATE statements
        run(...params: unknown[]): void {
          updateCalls.push({ sql: sql.trim(), params });
          applyUpdate(sql, params, assets);
        },
      };
    },
    transaction(fn: () => void) {
      return () => fn();
    },
  } as unknown as Database;

  return { db, assets, projects, updateCalls };
}

// ---------------------------------------------------------------------------
// Query dispatcher — minimal SQL pattern matching
// ---------------------------------------------------------------------------

function queryRows<T>(
  sql: string,
  params: unknown[],
  assets: AssetRow[],
  projects: ProjectRow[],
  _updateCalls: Array<{ sql: string; params: unknown[] }>,
): T[] {
  const s = sql.trim();

  // --- assets queries ---
  if (s.includes("FROM assets") && !s.toUpperCase().startsWith("UPDATE")) {
    let rows = assets.filter((r) => r.deleted_at === null);

    if (s.includes("scope = 'project' AND project_id = ?")) {
      const [kind, name, projectId] = params as [string, string, string];
      rows = rows.filter(
        (r) =>
          r.kind === kind && r.name === name && r.scope === "project" && r.project_id === projectId,
      );
      // ORDER BY last_modified_at DESC — already handled by sort
      rows = [...rows].sort((a, b) => b.last_modified_at - a.last_modified_at);
    } else if (
      s.includes("scope = 'global' AND project_id IS NULL") &&
      s.includes("kind = ? AND name = ?")
    ) {
      const [kind, name] = params as [string, string];
      rows = rows.filter(
        (r) => r.kind === kind && r.name === name && r.scope === "global" && r.project_id === null,
      );
      rows = [...rows].sort((a, b) => b.last_modified_at - a.last_modified_at);
      if (s.includes("LIMIT 1")) {
        rows = rows.slice(0, 1);
      }
    } else if (s.includes("scope = 'global'") && s.includes("shadowed_by_project_id IS NULL OR")) {
      // listAssetsForProject — non-shadowed filter
      const [projectId] = params as [string, string];
      rows = rows.filter(
        (r) =>
          (r.scope === "global" &&
            (r.shadowed_by_project_id === null || r.shadowed_by_project_id !== projectId)) ||
          (r.scope === "project" && r.project_id === projectId),
      );
    }

    return rows as unknown as T[];
  }

  // --- projects queries ---
  if (s.includes("FROM projects")) {
    let prows = projects.filter((p) => p.deleted_at === null);

    if (s.includes("WHERE id = ?")) {
      const [id] = params as [string];
      prows = prows.filter((p) => p.id === id);
      if (s.includes("LIMIT 1")) {
        prows = prows.slice(0, 1);
      }
    } else if (s.includes("WHERE path = ?")) {
      const [path] = params as [string];
      prows = prows.filter((p) => p.path === path);
      if (s.includes("LIMIT 1")) {
        prows = prows.slice(0, 1);
      }
    }
    return prows as unknown as T[];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Update dispatcher — applies UPDATE mutations to the in-memory assets array
// ---------------------------------------------------------------------------

function applyUpdate(sql: string, params: unknown[], assets: AssetRow[]): void {
  const s = sql.trim();

  if (!s.toUpperCase().startsWith("UPDATE")) {
    return;
  }

  if (s.includes("SET shadowed_by_project_id = NULL") && s.includes("shadowed_by_project_id = ?")) {
    // Clear step (a): unset shadowed_by_project_id for a specific projectId
    // (narrow or full variants both match this pattern)
    const projectId = params[params.length - 1] as string;
    for (const row of assets) {
      if (row.scope === "global" && row.shadowed_by_project_id === projectId) {
        if (params.length === 3) {
          // Narrow: also filter by kind + name
          const [kind, name] = params as [string, string, string];
          if (row.kind === kind && row.name === name) {
            row.shadowed_by_project_id = null;
          }
        } else {
          row.shadowed_by_project_id = null;
        }
      }
    }
  } else if (s.includes("SET shadowed_by_project_id = ?") && s.includes("EXISTS")) {
    // Set step (b): stamp projectId on global rows that have project counterparts
    const projectId = params[0] as string;

    if (params.length === 6) {
      // Narrow: kind + name filter
      const [_pid, kind, name] = params as [string, string, string, string, string, string];
      const hasProjectRow = assets.some(
        (r) =>
          r.scope === "project" &&
          r.project_id === projectId &&
          r.kind === kind &&
          r.name === name &&
          r.deleted_at === null,
      );
      if (hasProjectRow) {
        for (const row of assets) {
          if (
            row.scope === "global" &&
            row.project_id === null &&
            row.kind === kind &&
            row.name === name
          ) {
            row.shadowed_by_project_id = projectId;
          }
        }
      }
    } else {
      // Full: update all global rows shadowed by project
      for (const row of assets) {
        if (row.scope === "global" && row.project_id === null) {
          const hasProjectRow = assets.some(
            (r) =>
              r.scope === "project" &&
              r.project_id === projectId &&
              r.kind === row.kind &&
              r.name === row.name &&
              r.deleted_at === null,
          );
          if (hasProjectRow) {
            row.shadowed_by_project_id = projectId;
          }
        }
      }
    }
  }
}

// ===========================================================================
// Tests: composeScopeBadge (FR-075)
// ===========================================================================

describe("composeScopeBadge", () => {
  const globalRow = makeAssetRow({ scope: "global" });
  const projectRow = makeAssetRow({ scope: "project", project_id: "proj-1" });

  it("returns 'Global' for a global row with no shadow", () => {
    expect(composeScopeBadge(globalRow, null, false)).toBe("Global");
  });

  it("returns 'Global' for a global row even when projectName is provided", () => {
    // Global rows ignore the projectName argument.
    expect(composeScopeBadge(globalRow, "My Project", false)).toBe("Global");
  });

  it("returns 'Project: <name>' for a project row with no matching global", () => {
    expect(composeScopeBadge(projectRow, "My Project", false)).toBe("Project: My Project");
  });

  it("returns 'Project: <name> (shadows Global)' for a project row with a matching global", () => {
    expect(composeScopeBadge(projectRow, "My Project", true)).toBe(
      "Project: My Project (shadows Global)",
    );
  });

  it("returns 'Project: (unknown)' when projectName is null for a project row", () => {
    expect(composeScopeBadge(projectRow, null, false)).toBe("Project: (unknown)");
  });
});

// ===========================================================================
// Tests: resolveAsset (FR-074)
// ===========================================================================

describe("resolveAsset — project row wins over global (AC-1)", () => {
  it("returns the project-scoped row as active when both scopes exist", () => {
    const globalRow = makeAssetRow({ id: "global-1", scope: "global", name: "foo", kind: "skill" });
    const projectRow = makeAssetRow({
      id: "proj-row-1",
      scope: "project",
      name: "foo",
      kind: "skill",
      project_id: "proj-1",
    });
    const project = makeProjectRow({ id: "proj-1", display_name: "My Project" });

    const { db } = makeFakeResolveDb([globalRow, projectRow], [project]);

    const result = resolveAsset(db, "skill", "foo", "proj-1");

    expect(result.active).not.toBeNull();
    expect(result.active!.id).toBe("proj-row-1");
    expect(result.active!.scope).toBe("project");
    expect(result.shadowedGlobalId).toBe("global-1");
  });

  it("includes shadowedGlobalId pointing to the global row's id", () => {
    const globalRow = makeAssetRow({ id: "g-id", scope: "global", name: "bar", kind: "agent" });
    const projectRow = makeAssetRow({
      id: "p-id",
      scope: "project",
      name: "bar",
      kind: "agent",
      project_id: "proj-2",
    });
    const project = makeProjectRow({ id: "proj-2", display_name: "Project B" });

    const { db } = makeFakeResolveDb([globalRow, projectRow], [project]);

    const result = resolveAsset(db, "agent", "bar", "proj-2");
    expect(result.shadowedGlobalId).toBe("g-id");
  });

  it("attaches 'Project: <name> (shadows Global)' badge when project row shadows global", () => {
    const globalRow = makeAssetRow({ id: "g-1", scope: "global", name: "baz", kind: "command" });
    const projectRow = makeAssetRow({
      id: "p-1",
      scope: "project",
      name: "baz",
      kind: "command",
      project_id: "proj-1",
    });
    const project = makeProjectRow({ id: "proj-1", display_name: "Alpha" });

    const { db } = makeFakeResolveDb([globalRow, projectRow], [project]);

    const result = resolveAsset(db, "command", "baz", "proj-1");
    expect(result.active!.scopeBadge).toBe("Project: Alpha (shadows Global)");
  });
});

describe("resolveAsset — global fallback (AC-2)", () => {
  it("returns the global row when no project-scoped row exists", () => {
    const globalRow = makeAssetRow({ id: "g-only", scope: "global", name: "foo", kind: "skill" });
    const project = makeProjectRow({ id: "proj-1", display_name: "X" });

    const { db } = makeFakeResolveDb([globalRow], [project]);

    const result = resolveAsset(db, "skill", "foo", "proj-1");

    expect(result.active).not.toBeNull();
    expect(result.active!.id).toBe("g-only");
    expect(result.active!.scope).toBe("global");
    expect(result.shadowedGlobalId).toBeNull();
    expect(result.active!.scopeBadge).toBe("Global");
  });

  it("returns { active: null, shadowedGlobalId: null } when neither scope has a row", () => {
    const project = makeProjectRow({ id: "proj-1", display_name: "X" });
    const { db } = makeFakeResolveDb([], [project]);

    const result = resolveAsset(db, "skill", "missing", "proj-1");

    expect(result.active).toBeNull();
    expect(result.shadowedGlobalId).toBeNull();
  });

  it("returns project-scoped row with no shadowedGlobalId when no global counterpart exists", () => {
    const projectRow = makeAssetRow({
      id: "p-only",
      scope: "project",
      name: "unique",
      kind: "workflow",
      project_id: "proj-1",
    });
    const project = makeProjectRow({ id: "proj-1", display_name: "Y" });

    const { db } = makeFakeResolveDb([projectRow], [project]);

    const result = resolveAsset(db, "workflow", "unique", "proj-1");
    expect(result.active!.id).toBe("p-only");
    expect(result.shadowedGlobalId).toBeNull();
    expect(result.active!.scopeBadge).toBe("Project: Y");
  });
});

describe("resolveAsset — null projectId (global-only view)", () => {
  it("returns the global row when projectId is null", () => {
    const globalRow = makeAssetRow({ id: "g-1", scope: "global", name: "foo" });
    const { db } = makeFakeResolveDb([globalRow], []);

    const result = resolveAsset(db, "skill", "foo", null);
    expect(result.active!.id).toBe("g-1");
    expect(result.shadowedGlobalId).toBeNull();
  });
});

describe("resolveAsset — schema violation degenerate case (AC-8)", () => {
  it("returns the most-recent row when two project rows exist for the same (kind, name, project_id)", () => {
    const older = makeAssetRow({
      id: "old",
      scope: "project",
      name: "dup",
      kind: "skill",
      project_id: "proj-1",
      last_modified_at: 1000,
    });
    const newer = makeAssetRow({
      id: "new",
      scope: "project",
      name: "dup",
      kind: "skill",
      project_id: "proj-1",
      last_modified_at: 2000,
    });
    const project = makeProjectRow({ id: "proj-1" });

    const { db } = makeFakeResolveDb([older, newer], [project]);

    const result = resolveAsset(db, "skill", "dup", "proj-1");
    // Should return the newer row (higher last_modified_at) without throwing.
    expect(result.active!.id).toBe("new");
  });
});

// ===========================================================================
// Tests: recomputeShadows (AC-3 + AC-4 + AC-7)
// ===========================================================================

describe("recomputeShadows — full project recompute (AC-3)", () => {
  it("sets shadowed_by_project_id on the global row when a project counterpart exists", () => {
    const globalRow = makeAssetRow({ id: "g-1", scope: "global", name: "foo", kind: "skill" });
    const projectRow = makeAssetRow({
      id: "p-1",
      scope: "project",
      name: "foo",
      kind: "skill",
      project_id: "proj-1",
    });
    const project = makeProjectRow({ id: "proj-1" });

    const { db, assets } = makeFakeResolveDb([globalRow, projectRow], [project]);

    recomputeShadows(db, "proj-1");

    const globalAfter = assets.find((r) => r.id === "g-1");
    expect(globalAfter?.shadowed_by_project_id).toBe("proj-1");
  });

  it("clears shadowed_by_project_id on global rows no longer shadowed after recompute", () => {
    // Global row was previously stamped by proj-1 but the project row is now deleted.
    const globalRow = makeAssetRow({
      id: "g-1",
      scope: "global",
      name: "foo",
      kind: "skill",
      shadowed_by_project_id: "proj-1",
    });
    const project = makeProjectRow({ id: "proj-1" });

    // No project-scoped row exists anymore.
    const { db, assets } = makeFakeResolveDb([globalRow], [project]);

    recomputeShadows(db, "proj-1");

    // Step (a) should have cleared it; step (b) should not re-stamp it.
    const globalAfter = assets.find((r) => r.id === "g-1");
    expect(globalAfter?.shadowed_by_project_id).toBeNull();
  });

  it("does not stamp global rows that have no project-scoped counterpart", () => {
    const globalFoo = makeAssetRow({ id: "g-foo", scope: "global", name: "foo", kind: "skill" });
    const globalBar = makeAssetRow({ id: "g-bar", scope: "global", name: "bar", kind: "skill" });
    const projectFoo = makeAssetRow({
      id: "p-foo",
      scope: "project",
      name: "foo",
      kind: "skill",
      project_id: "proj-1",
    });
    const project = makeProjectRow({ id: "proj-1" });

    const { db, assets } = makeFakeResolveDb([globalFoo, globalBar, projectFoo], [project]);

    recomputeShadows(db, "proj-1");

    const barAfter = assets.find((r) => r.id === "g-bar");
    expect(barAfter?.shadowed_by_project_id).toBeNull();

    const fooAfter = assets.find((r) => r.id === "g-foo");
    expect(fooAfter?.shadowed_by_project_id).toBe("proj-1");
  });
});

describe("recomputeShadows — narrow filter (AC-4)", () => {
  it("stamps only the filtered (kind, name) pair, leaves other globals untouched", () => {
    const globalFoo = makeAssetRow({ id: "g-foo", scope: "global", name: "foo", kind: "skill" });
    const globalBar = makeAssetRow({ id: "g-bar", scope: "global", name: "bar", kind: "skill" });
    const projectFoo = makeAssetRow({
      id: "p-foo",
      scope: "project",
      name: "foo",
      kind: "skill",
      project_id: "proj-1",
    });
    const projectBar = makeAssetRow({
      id: "p-bar",
      scope: "project",
      name: "bar",
      kind: "skill",
      project_id: "proj-1",
    });
    const project = makeProjectRow({ id: "proj-1" });

    const { db, assets } = makeFakeResolveDb(
      [globalFoo, globalBar, projectFoo, projectBar],
      [project],
    );

    // Only recompute the (skill, foo) pair.
    recomputeShadows(db, "proj-1", { kind: "skill", name: "foo" });

    const fooAfter = assets.find((r) => r.id === "g-foo");
    const barAfter = assets.find((r) => r.id === "g-bar");

    expect(fooAfter?.shadowed_by_project_id).toBe("proj-1");
    expect(barAfter?.shadowed_by_project_id).toBeNull(); // untouched
  });
});

describe("recomputeShadows — defensive no-op for unknown projectId (AC-7)", () => {
  it("does not throw and makes no changes when projectId is not in projects table", () => {
    const globalRow = makeAssetRow({ id: "g-1", scope: "global", name: "foo" });
    const { db, assets } = makeFakeResolveDb([globalRow], []);

    expect(() => recomputeShadows(db, "nonexistent-proj")).not.toThrow();

    const after = assets.find((r) => r.id === "g-1");
    expect(after?.shadowed_by_project_id).toBeNull();
  });
});

// ===========================================================================
// Tests: recomputeShadows — idempotency (HIGH-2)
// ===========================================================================

describe("recomputeShadows — full recompute idempotency", () => {
  it("produces identical shadowed_by_project_id values on second call (full recompute)", () => {
    const globalFoo = makeAssetRow({ id: "g-foo", scope: "global", name: "foo", kind: "skill" });
    const globalBar = makeAssetRow({ id: "g-bar", scope: "global", name: "bar", kind: "agent" });
    const globalBaz = makeAssetRow({ id: "g-baz", scope: "global", name: "baz", kind: "command" });
    const projectFoo = makeAssetRow({
      id: "p-foo",
      scope: "project",
      name: "foo",
      kind: "skill",
      project_id: "proj-1",
    });
    const projectBar = makeAssetRow({
      id: "p-bar",
      scope: "project",
      name: "bar",
      kind: "agent",
      project_id: "proj-1",
    });
    // globalBaz has no project counterpart — should remain NULL both times.
    const project = makeProjectRow({ id: "proj-1" });

    const { db, assets } = makeFakeResolveDb(
      [globalFoo, globalBar, globalBaz, projectFoo, projectBar],
      [project],
    );

    // First call.
    recomputeShadows(db, "proj-1");

    // Snapshot every row's shadowed_by_project_id after first call.
    const snapshotAfterFirst = assets.map((r) => ({
      id: r.id,
      shadowed_by_project_id: r.shadowed_by_project_id,
    }));

    // Second call — must produce identical column values.
    recomputeShadows(db, "proj-1");

    const snapshotAfterSecond = assets.map((r) => ({
      id: r.id,
      shadowed_by_project_id: r.shadowed_by_project_id,
    }));

    // Row-by-row comparison — not just count.
    expect(snapshotAfterSecond).toEqual(snapshotAfterFirst);

    // Spot-check the expected values so test is self-documenting.
    expect(assets.find((r) => r.id === "g-foo")?.shadowed_by_project_id).toBe("proj-1");
    expect(assets.find((r) => r.id === "g-bar")?.shadowed_by_project_id).toBe("proj-1");
    expect(assets.find((r) => r.id === "g-baz")?.shadowed_by_project_id).toBeNull();
  });
});

describe("recomputeShadows — narrow filter idempotency", () => {
  it("produces identical shadowed_by_project_id values on second call (narrow filter)", () => {
    const globalFoo = makeAssetRow({ id: "g-foo", scope: "global", name: "foo", kind: "skill" });
    const globalBar = makeAssetRow({ id: "g-bar", scope: "global", name: "bar", kind: "skill" });
    const projectFoo = makeAssetRow({
      id: "p-foo",
      scope: "project",
      name: "foo",
      kind: "skill",
      project_id: "proj-1",
    });
    const projectBar = makeAssetRow({
      id: "p-bar",
      scope: "project",
      name: "bar",
      kind: "skill",
      project_id: "proj-1",
    });
    const project = makeProjectRow({ id: "proj-1" });

    const { db, assets } = makeFakeResolveDb(
      [globalFoo, globalBar, projectFoo, projectBar],
      [project],
    );

    const filter = { kind: "skill", name: "foo" };

    // First call.
    recomputeShadows(db, "proj-1", filter);

    // Snapshot every row's shadowed_by_project_id after first call.
    const snapshotAfterFirst = assets.map((r) => ({
      id: r.id,
      shadowed_by_project_id: r.shadowed_by_project_id,
    }));

    // Second call with the same filter — must produce identical column values.
    recomputeShadows(db, "proj-1", filter);

    const snapshotAfterSecond = assets.map((r) => ({
      id: r.id,
      shadowed_by_project_id: r.shadowed_by_project_id,
    }));

    // Row-by-row comparison — not just count.
    expect(snapshotAfterSecond).toEqual(snapshotAfterFirst);

    // Spot-check: only the filtered (skill, foo) pair should be stamped.
    expect(assets.find((r) => r.id === "g-foo")?.shadowed_by_project_id).toBe("proj-1");
    // g-bar is outside the filter — must remain NULL despite having a project counterpart.
    expect(assets.find((r) => r.id === "g-bar")?.shadowed_by_project_id).toBeNull();
  });
});

// ===========================================================================
// Tests: runShadowRecomputeAll
// ===========================================================================

describe("runShadowRecomputeAll", () => {
  it("calls recomputeShadows for every active project", () => {
    const globalFoo = makeAssetRow({ id: "g-foo", scope: "global", name: "foo", kind: "skill" });
    const proj1Row = makeAssetRow({
      id: "p1-foo",
      scope: "project",
      name: "foo",
      kind: "skill",
      project_id: "proj-1",
    });
    const proj1 = makeProjectRow({ id: "proj-1", display_name: "Project 1" });
    const proj2 = makeProjectRow({ id: "proj-2", display_name: "Project 2" });

    const { db, assets } = makeFakeResolveDb([globalFoo, proj1Row], [proj1, proj2]);

    runShadowRecomputeAll(db);

    // proj-1 has a project row for "foo" — global should be stamped.
    const fooAfter = assets.find((r) => r.id === "g-foo");
    expect(fooAfter?.shadowed_by_project_id).toBe("proj-1");
  });

  it("does not throw when projects table is empty", () => {
    const { db } = makeFakeResolveDb([], []);
    expect(() => runShadowRecomputeAll(db)).not.toThrow();
  });
});
