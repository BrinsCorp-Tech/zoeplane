// ZoePlane Sidecar — Project-overlay asset resolver
//
// Implements FR-074 (project-overlay-on-global resolution + shadow marking)
// and FR-075 (scope-badge data) for the asset index.
//
// Design:
//   - resolveAsset(kind, name, projectId) — returns the active asset row for a
//     (kind, name) pair scoped to the given project. Project-scoped rows win;
//     global rows are returned when no project override exists.
//   - recomputeShadows(projectId, filter?) — stamps shadowed_by_project_id on
//     global rows that have a matching project-scoped counterpart. Runs inside
//     a single SQLite transaction (clear step + set step atomically). Accepts
//     an optional (kind, name) filter for per-event narrow recomputes.
//   - composeScopeBadge(row, projectName) — produces the FR-075 badge string.
//
// This module is stateless over SQLite reads/writes — no FS access.
// The watcher (watcher.ts) calls into it; resolver does not import watcher.
//
// Story: 3.4 — Project-overlay resolution + shadow marking (FR-074, FR-075)

import { Database } from "bun:sqlite";
import { log } from "../log";

// ---------------------------------------------------------------------------
// Internal DB row types — resolver-local, do NOT import scanner's AssetRow
// ---------------------------------------------------------------------------

/** Full asset row as read from the `assets` table. */
interface AssetDbRow {
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

/** Minimal projects row needed for badge + existence check. */
interface ProjectDbRow {
  id: string;
  display_name: string;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A resolved asset — the full DB row plus computed display fields.
 * Consumers (Epic 06 Library view) render `scopeBadge` directly.
 */
export interface ResolvedAsset extends AssetDbRow {
  /** FR-075 badge string — computed by composeScopeBadge(). */
  scopeBadge: string;
  /** True when this global row is shadowed by a project-scoped counterpart. */
  shadowed: boolean;
}

/** Result of resolveAsset(). */
export interface ResolveResult {
  /**
   * The active asset for the given (kind, name, projectId) triple.
   * null only when neither global nor project-scoped row exists.
   */
  active: ResolvedAsset | null;
  /**
   * ID of the global row that is shadowed by the returned project row, or null
   * when the active row is already global (no shadowing) or no global row exists.
   */
  shadowedGlobalId: string | null;
}

// ---------------------------------------------------------------------------
// Badge composition (FR-075)
// ---------------------------------------------------------------------------

/**
 * Compose the FR-075 scope-badge string for an asset row.
 *
 * Three forms:
 *   "Global"                             — global row, not shadowed
 *   "Project: <name>"                    — project row, no matching global
 *   "Project: <name> (shadows Global)"   — project row, matching global exists
 *
 * @param row         The DB row to compose the badge for.
 * @param projectName The display_name of the owning project (from projects table).
 *                    Ignored for global-scoped rows.
 * @param hasShadowedGlobal  Whether a global row exists for the same (kind, name).
 *                           Ignored for global-scoped rows.
 */
export function composeScopeBadge(
  row: AssetDbRow,
  projectName: string | null,
  hasShadowedGlobal: boolean,
): string {
  if (row.scope === "global") {
    return "Global";
  }
  // project (or local) scope
  const label = projectName !== null ? `Project: ${projectName}` : "Project: (unknown)";
  if (hasShadowedGlobal) {
    return `${label} (shadows Global)`;
  }
  return label;
}

// ---------------------------------------------------------------------------
// resolveAsset
// ---------------------------------------------------------------------------

/**
 * Resolve the active asset for a (kind, name, projectId) triple.
 *
 * Resolution rule (FR-074):
 *   1. If a project-scoped row exists for (kind, name, project_id=projectId),
 *      return it as the active row. Set shadowedGlobalId to the ID of the
 *      matching global row (kind, name, scope='global') if one exists.
 *   2. If no project-scoped row exists, return the global row (scope='global')
 *      as the active row with shadowedGlobalId=null.
 *   3. If neither scope has a matching row, return { active: null, shadowedGlobalId: null }.
 *
 * Degenerate case (AC-8): if two project-scoped rows exist for the same
 * (kind, name, project_id) — a schema violation that the unique index should
 * prevent — return the row with the most recent last_modified_at and log an error.
 *
 * @param db         Open bun:sqlite Database instance.
 * @param kind       Asset kind (skill, agent, command, team, workflow).
 * @param name       Asset name exactly as stored in assets.name column.
 * @param projectId  UUID of the active project. If null, only global rows are considered.
 */
export function resolveAsset(
  db: Database,
  kind: string,
  name: string,
  projectId: string | null,
): ResolveResult {
  // ------------------------------------------------------------------
  // Step 1: Fetch project-scoped rows (expecting 0 or 1; >1 is a bug)
  // ------------------------------------------------------------------
  let projectRows: AssetDbRow[] = [];

  if (projectId !== null) {
    projectRows = db
      .query<AssetDbRow, [string, string, string]>(
        `SELECT * FROM assets
         WHERE kind = ? AND name = ? AND scope = 'project' AND project_id = ?
           AND deleted_at IS NULL
         ORDER BY last_modified_at DESC`,
      )
      .all(kind, name, projectId);

    if (projectRows.length > 1) {
      log(
        "ERROR",
        "Resolver: schema violation — multiple project rows for same (kind, name, project_id)",
        {
          kind,
          name,
          projectId,
          count: projectRows.length,
        },
      );
      // AC-8: return the most recent row (already ordered DESC above).
      projectRows = [projectRows[0]];
    }
  }

  // ------------------------------------------------------------------
  // Step 2: Fetch the global row (expecting 0 or 1)
  // ------------------------------------------------------------------
  const globalRow = db
    .query<AssetDbRow, [string, string]>(
      `SELECT * FROM assets
       WHERE kind = ? AND name = ? AND scope = 'global' AND project_id IS NULL
         AND deleted_at IS NULL
       ORDER BY last_modified_at DESC
       LIMIT 1`,
    )
    .get(kind, name);

  // ------------------------------------------------------------------
  // Step 3: Look up project display_name (for badge composition)
  // ------------------------------------------------------------------
  let projectName: string | null = null;
  if (projectId !== null) {
    const projectRow = db
      .query<ProjectDbRow, [string]>("SELECT id, display_name FROM projects WHERE id = ? LIMIT 1")
      .get(projectId);
    if (projectRow !== null) {
      projectName = projectRow.display_name;
    }
  }

  // ------------------------------------------------------------------
  // Step 4: Compose result
  // ------------------------------------------------------------------
  const projectRow = projectRows.length > 0 ? projectRows[0] : null;
  const hasGlobal = globalRow !== null;

  if (projectRow !== null) {
    // Project-scoped row wins (FR-074 overlay rule).
    const hasShadowedGlobal = hasGlobal;
    const active: ResolvedAsset = {
      ...projectRow,
      scopeBadge: composeScopeBadge(projectRow, projectName, hasShadowedGlobal),
      shadowed: false,
    };
    return {
      active,
      shadowedGlobalId: hasShadowedGlobal ? globalRow!.id : null,
    };
  }

  if (globalRow !== null) {
    // No project override — return global row.
    const active: ResolvedAsset = {
      ...globalRow,
      scopeBadge: composeScopeBadge(globalRow, null, false),
      shadowed: globalRow.shadowed_by_project_id !== null,
    };
    return { active, shadowedGlobalId: null };
  }

  // Neither scope has a row.
  return { active: null, shadowedGlobalId: null };
}

// ---------------------------------------------------------------------------
// recomputeShadows
// ---------------------------------------------------------------------------

/**
 * Optional filter for narrow per-event recomputes.
 *
 * When present, only the specified (kind, name) pair is recomputed.
 * When absent, all project-scoped rows for the given projectId are processed.
 */
export interface ShadowFilter {
  kind: string;
  name: string;
}

/**
 * Recompute `shadowed_by_project_id` on all global rows that have a matching
 * project-scoped counterpart for the given `projectId`.
 *
 * Algorithm (FR-074):
 *   (a) Clear `shadowed_by_project_id` to NULL on all global rows currently
 *       shadowed by this project (scoped by filter if provided).
 *   (b) For every project-scoped row with project_id = projectId (scoped by
 *       filter if provided), find the matching global row by (kind, name) and
 *       set its `shadowed_by_project_id = projectId`.
 *
 * Both steps run inside a single SQLite transaction (AC-3).
 *
 * Defensive behaviour (AC-7): if projectId is not found in the `projects` table,
 * log a warning and return without modifying any rows.
 *
 * Performance note: a full-project recompute does a full scan of the assets
 * table to find project-scoped rows. At Sprint 3 scale (hundreds of rows) this
 * is acceptable. TODO: Story 3.8+ — consider adding an index on
 * (scope, project_id) if row counts grow into the thousands.
 *
 * @param db        Open bun:sqlite Database instance.
 * @param projectId UUID of the project being recomputed.
 * @param filter    Optional (kind, name) pair for per-event narrow recompute.
 */
export function recomputeShadows(db: Database, projectId: string, filter?: ShadowFilter): void {
  // ------------------------------------------------------------------
  // Defensive check: project must exist (AC-7)
  //
  // This existence-guard SELECT runs outside the transaction intentionally.
  // bun:sqlite uses a single-writer model: only one write can execute at a
  // time, but reads are serialisable within a connection. Running the guard
  // read outside the transaction is safe here because:
  //   (a) the projects table is only written by project-open/close events
  //       (Story 3.7), which are infrequent and well-separated from watcher
  //       callbacks in wall-clock time, and
  //   (b) if a project is deleted between this check and the transaction, the
  //       UPDATE steps are no-ops (they match on shadowed_by_project_id = ?
  //       which no longer exists), so the worst case is a stale no-op, not
  //       corruption.
  // ------------------------------------------------------------------
  const projectExists = db
    .query<{ id: string }, [string]>("SELECT id FROM projects WHERE id = ? LIMIT 1")
    .get(projectId);

  if (projectExists === null) {
    log("WARN", "Resolver: recomputeShadows called for unknown projectId — no-op", { projectId });
    return;
  }

  // ------------------------------------------------------------------
  // Single transaction: clear + set (AC-3)
  // ------------------------------------------------------------------
  const recompute = db.transaction(() => {
    if (filter !== undefined) {
      // Narrow recompute: single (kind, name) pair only (AC-4 / per-event path).
      const { kind, name } = filter;

      // (a) Clear: un-shadow the global row for this (kind, name) if currently
      //     shadowed by this project.
      db.query(
        `UPDATE assets
         SET shadowed_by_project_id = NULL
         WHERE scope = 'global' AND project_id IS NULL
           AND kind = ? AND name = ?
           AND shadowed_by_project_id = ?`,
      ).run(kind, name, projectId);

      // (b) Set: shadow the global row if a project-scoped counterpart exists.
      //     Uses a correlated EXISTS subquery to avoid a second round-trip.
      db.query(
        `UPDATE assets
         SET shadowed_by_project_id = ?
         WHERE scope = 'global' AND project_id IS NULL
           AND kind = ? AND name = ?
           AND EXISTS (
             SELECT 1 FROM assets a2
             WHERE a2.scope = 'project'
               AND a2.project_id = ?
               AND a2.kind = ?
               AND a2.name = ?
               AND a2.deleted_at IS NULL
           )`,
      ).run(projectId, kind, name, projectId, kind, name);
    } else {
      // Full project recompute: process all project-scoped rows for projectId.

      // (a) Clear: reset all global rows previously shadowed by this project.
      //     TODO: Story 3.8+ — add index on (scope, project_id) if row count grows.
      db.query(
        `UPDATE assets
         SET shadowed_by_project_id = NULL
         WHERE scope = 'global' AND project_id IS NULL
           AND shadowed_by_project_id = ?`,
      ).run(projectId);

      // (b) Set: for every project-scoped row belonging to this project, find its
      //     matching global counterpart and stamp it.
      db.query(
        `UPDATE assets
         SET shadowed_by_project_id = ?
         WHERE scope = 'global' AND project_id IS NULL
           AND EXISTS (
             SELECT 1 FROM assets a2
             WHERE a2.scope = 'project'
               AND a2.project_id = ?
               AND a2.kind = assets.kind
               AND a2.name = assets.name
               AND a2.deleted_at IS NULL
           )`,
      ).run(projectId, projectId);
    }
  });

  recompute();

  log("INFO", "Resolver: shadow recompute complete", {
    projectId,
    filter: filter ?? "full",
  });
}

// ---------------------------------------------------------------------------
// runShadowRecomputeAll — called from startup chain in index.ts
// ---------------------------------------------------------------------------

/**
 * Run a full shadow recompute for every active project in the `projects` table.
 *
 * Called once at startup after `runColdLaunchScan()` completes. This ensures
 * that `shadowed_by_project_id` is correctly stamped even on re-launch (because
 * scanner's INSERT OR IGNORE leaves all rows with `shadowed_by_project_id=NULL`
 * when rows already exist from a previous run — AC per story: "must run on
 * every startup, not just first launch").
 *
 * @param db  Open bun:sqlite Database instance.
 */
export function runShadowRecomputeAll(db: Database): void {
  let projectRows: Array<{ id: string }> = [];

  try {
    projectRows = db
      .query<{ id: string }, []>("SELECT id FROM projects WHERE deleted_at IS NULL")
      .all();
  } catch (err) {
    log("WARN", "Resolver: failed to query projects for startup shadow recompute", {
      error: String(err),
    });
    return;
  }

  if (projectRows.length === 0) {
    log("INFO", "Resolver: no active projects — shadow recompute skipped at startup");
    return;
  }

  log("INFO", "Resolver: running startup shadow recompute for all active projects", {
    count: projectRows.length,
  });

  for (const { id } of projectRows) {
    recomputeShadows(db, id);
  }

  log("INFO", "Resolver: startup shadow recompute complete", { count: projectRows.length });
}

// ---------------------------------------------------------------------------
// listAssetsForProject — FR-032 partial / AC-6
// ---------------------------------------------------------------------------

/**
 * List all assets visible for a given project, with scopeBadge and shadowed flag.
 *
 * When `includeShadowed` is false (default), global rows with a non-NULL
 * `shadowed_by_project_id` are excluded — the project-scoped override is the
 * only visible row (FR-032 project-scoped visibility).
 *
 * When `includeShadowed` is true, shadowed global rows are included with
 * `shadowed=true` so the Library view can offer a "show shadowed" toggle (FR-075).
 *
 * ### `shadowed` flag freshness
 * The `shadowed` field on each returned row is derived in-memory from the fetched
 * row set — a global row is marked `shadowed=true` if and only if the same fetch
 * also returned a project-scoped row with a matching `(kind, name)`. This means
 * `shadowed` is self-consistent within a single call, independent of whether
 * `recomputeShadows` has run recently. Callers must NOT rely on `shadowed_by_project_id`
 * on the raw DB row for freshness — that column is only current immediately after a
 * `recomputeShadows` call.
 *
 * @param db              Open bun:sqlite Database instance.
 * @param projectId       UUID of the active project (or null for global-only view).
 * @param includeShadowed Include shadowed global rows (default false).
 */
export function listAssetsForProject(
  db: Database,
  projectId: string | null,
  includeShadowed = false,
): ResolvedAsset[] {
  // ------------------------------------------------------------------
  // Fetch candidate rows
  // ------------------------------------------------------------------
  let rows: AssetDbRow[];

  if (projectId !== null) {
    if (includeShadowed) {
      // All global rows + all project-scoped rows for this project.
      rows = db
        .query<AssetDbRow, [string]>(
          `SELECT * FROM assets
           WHERE deleted_at IS NULL
             AND (scope = 'global' OR (scope = 'project' AND project_id = ?))
           ORDER BY kind, name, scope DESC`,
        )
        .all(projectId);
    } else {
      // Exclude global rows shadowed by this project.
      rows = db
        .query<AssetDbRow, [string, string]>(
          `SELECT * FROM assets
           WHERE deleted_at IS NULL
             AND (
               (scope = 'global' AND (shadowed_by_project_id IS NULL OR shadowed_by_project_id != ?))
               OR (scope = 'project' AND project_id = ?)
             )
           ORDER BY kind, name, scope DESC`,
        )
        .all(projectId, projectId);
    }
  } else {
    // No active project — return global rows only.
    rows = db
      .query<AssetDbRow, []>(
        `SELECT * FROM assets
         WHERE deleted_at IS NULL AND scope = 'global'
         ORDER BY kind, name`,
      )
      .all();
  }

  // ------------------------------------------------------------------
  // Resolve project display_name (one lookup for the whole list)
  // ------------------------------------------------------------------
  let projectName: string | null = null;
  if (projectId !== null) {
    const pRow = db
      .query<ProjectDbRow, [string]>("SELECT id, display_name FROM projects WHERE id = ? LIMIT 1")
      .get(projectId);
    if (pRow !== null) {
      projectName = pRow.display_name;
    }
  }

  // ------------------------------------------------------------------
  // Build result with badge + shadowed flag
  //
  // Both hasShadowedGlobal (for badge) and shadowed (for the flag) are
  // derived from the in-memory row set so they are self-consistent within
  // a single call — independent of the shadowed_by_project_id column value
  // on disk, which is only current immediately after a recomputeShadows call.
  // TODO: Story 3.8+ — hasShadowedGlobal is O(n²); switch to a Set keyed on
  // `${kind}:${name}` once row counts grow into the thousands.
  // ------------------------------------------------------------------
  return rows.map((row) => {
    const hasShadowedGlobal =
      row.scope === "project"
        ? rows.some((r) => r.scope === "global" && r.kind === row.kind && r.name === row.name)
        : false;

    // For a global row, shadowed=true iff a project-scoped row for the same
    // (kind, name) is present in the fetched set. Derived in-memory for
    // freshness consistency (see JSDoc note above).
    const shadowed =
      row.scope === "global"
        ? rows.some((r) => r.scope === "project" && r.kind === row.kind && r.name === row.name)
        : false;

    return {
      ...row,
      scopeBadge: composeScopeBadge(
        row,
        row.scope === "project" ? projectName : null,
        hasShadowedGlobal,
      ),
      shadowed,
    };
  });
}
