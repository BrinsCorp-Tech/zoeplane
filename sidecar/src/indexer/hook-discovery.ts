// ZoePlane Sidecar — Hook discovery + hook_index upsert spine
//
// Parses ~/.claude/settings.json and each tracked project's
// <project>/.claude/settings.json + <project>/.claude/settings.local.json,
// extracts every hook entry under the `hooks` and `_disabled_hooks` keys,
// computes a stable hook_id = sha256(scope + event + matcher + command), and
// upserts one row per distinct hook into the `hook_index` table.
//
// Story: 3.6 — Hook discovery + hook_index upsert spine (FR-089, FR-090)
//
// === Architecture ===
//
//   runHookDiscovery(db) — cold-launch full-pass.
//     Called from index.ts after runValidationPipeline() resolves.
//     Processes each scope with a per-scope transaction that wraps both the
//     INSERT batch and the soft-delete for that scope atomically.
//     Emits HookIndexCompletedEvent at end.
//
//   reindexHooksForPath(db, absolutePath) — watcher-triggered single-file pass.
//     Called from the watcher subscriber in index.ts when a settings.json /
//     settings.local.json path arrives. Re-parses one file and re-upserts its
//     hooks within 250 ms of the coalesced event (FR-089).
//
// === hook_id computation ===
//
//   sha256(scope + event + (matcher ?? '') + command) — UTF-8, lowercase hex.
//   No separator characters between fields (PRD §3.10 exact wording).
//   Canonical input order: scope || event || matcher_or_empty || command.
//
// === discovered_at preservation (FR-090) ===
//
//   On upsert by hook_id match: preserve existing discovered_at; update only
//   last_modified_at, last_modified_by, source_hash.
//   On new row: discovered_at = last_modified_at = Date.now().
//
// === Soft-delete pattern (FR-068 tombstone) ===
//
//   After upserting the current set for a scope, rows whose hook_id is no
//   longer present in the parsed file are soft-deleted (deleted_at = now).
//   Query consumers must filter WHERE deleted_at IS NULL.
//
// === Retry on parse failure ===
//
//   If JSON.parse fails, one retry after 50 ms (Epic 03 Risk register #3 —
//   settings.json non-atomic writes). Second failure is logged and skipped.

import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { log } from "../log";
import {
  HOOK_INDEX_COMPLETED,
  type HookIndexCompletedEvent,
  type WatcherEvent,
} from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// FR-068 v1 single-workspace defaults (mirrors scanner.ts)
// ---------------------------------------------------------------------------

const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_AUTHOR_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_VISIBILITY = "private" as const;

// ---------------------------------------------------------------------------
// File-size observability threshold (FR-089)
// ---------------------------------------------------------------------------

/** Files larger than this are still parsed but the 250 ms latency target
 *  is best-effort, not contractual (FR-089). We log size + elapsed time. */
const LARGE_FILE_BYTES = 100_000;

// ---------------------------------------------------------------------------
// settings.json shape
// ---------------------------------------------------------------------------

interface HookEntry {
  matcher?: string;
  hooks: Array<{ command: string }>;
}

type HooksMap = Record<string, HookEntry[]>;

interface SettingsJson {
  hooks?: HooksMap;
  _disabled_hooks?: HooksMap;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

interface ParsedHook {
  scope: string;
  event: string;
  matcher: string | null;
  command: string;
  disabled: 0 | 1;
  hookId: string;
}

interface ExistingHookRow {
  id: string;
  hook_id: string;
  discovered_at: number;
}

// ---------------------------------------------------------------------------
// Event emission — mirrors scanner.ts / validator.ts subscriber pattern
// ---------------------------------------------------------------------------

const eventSubscribers = new Set<(event: WatcherEvent) => void>();

/**
 * Register a subscriber to receive hook-discovery events (HookIndexCompletedEvent).
 * Returns an unsubscribe function. Same API as subscribeToScannerEvents.
 */
export function subscribeToHookDiscoveryEvents(
  callback: (event: WatcherEvent) => void,
): () => void {
  eventSubscribers.add(callback);
  return () => {
    eventSubscribers.delete(callback);
  };
}

function emit(event: WatcherEvent): void {
  for (const sub of eventSubscribers) {
    try {
      sub(event);
    } catch (err) {
      log("WARN", "HookDiscovery: subscriber threw during event emission", {
        eventType: event.type,
        error: String(err),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// hook_id computation
// ---------------------------------------------------------------------------

/**
 * Compute hook_id = sha256(scope + event + (matcher ?? '') + command).
 *
 * PRD §3.10 locks the canonical input order and forbids separators between
 * fields. Lowercase hex output per FR-090.
 */
function computeHookId(
  scope: string,
  event: string,
  matcher: string | null,
  command: string,
): string {
  return createHash("sha256")
    .update(scope + event + (matcher ?? "") + command, "utf8")
    .digest("hex");
}

// ---------------------------------------------------------------------------
// source_hash computation — sha256 of the raw settings.json content
// ---------------------------------------------------------------------------

function computeSourceHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// settings.json parse — with single retry on failure (Risk register #3)
// ---------------------------------------------------------------------------

/**
 * Discriminated result of reading and parsing a settings.json file.
 *
 *   absent      — file does not exist (ENOENT). Safe to soft-delete all
 *                 existing hooks for this scope.
 *   unparseable — file exists but JSON.parse failed after one retry (likely
 *                 mid-write). Existing hook rows must be PRESERVED (no soft-
 *                 delete) to avoid FR-090 discovered_at loss.
 *   ok          — file read and parsed successfully.
 */
type ReadSettingsResult =
  | { kind: "absent" }
  | { kind: "unparseable" }
  | { kind: "ok"; parsed: SettingsJson; content: string; sizeBytes: number };

/**
 * Read and parse a settings.json file.
 *
 * Returns:
 *   { kind: 'absent' }       — file does not exist.
 *   { kind: 'unparseable' }  — file exists but is not valid JSON after retry.
 *   { kind: 'ok', ... }      — success.
 */
async function readSettingsJson(filePath: string): Promise<ReadSettingsResult> {
  // --- Size observability ---
  let sizeBytes = 0;
  try {
    const stats = await stat(filePath);
    sizeBytes = stats.size;
  } catch {
    // File does not exist — normal case (settings files are optional).
    return { kind: "absent" };
  }

  if (sizeBytes > LARGE_FILE_BYTES) {
    log(
      "WARN",
      "HookDiscovery: settings.json exceeds 100 KB — 250 ms latency target is best-effort",
      {
        path: filePath,
        sizeBytes,
      },
    );
  }

  // --- Read + parse (attempt 1) ---
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (err) {
    log("WARN", "HookDiscovery: failed to read settings.json", {
      path: filePath,
      error: String(err),
    });
    // File exists (stat succeeded) but read failed — treat as unparseable to
    // avoid inadvertently tombstoning all hooks on a transient I/O error.
    return { kind: "unparseable" };
  }

  const firstAttempt = tryParseJson(content);
  if (firstAttempt !== null) {
    return { kind: "ok", parsed: firstAttempt, content, sizeBytes };
  }

  // --- Retry after 50 ms (Risk register #3 — non-atomic writes) ---
  log("WARN", "HookDiscovery: settings.json parse failed — retrying in 50 ms", { path: filePath });
  await new Promise<void>((resolve) => setTimeout(resolve, 50));

  let retryContent: string;
  try {
    retryContent = await readFile(filePath, "utf-8");
  } catch (err) {
    log("WARN", "HookDiscovery: settings.json read failed on retry", {
      path: filePath,
      error: String(err),
    });
    return { kind: "unparseable" };
  }

  const secondAttempt = tryParseJson(retryContent);
  if (secondAttempt !== null) {
    return { kind: "ok", parsed: secondAttempt, content: retryContent, sizeBytes };
  }

  log(
    "WARN",
    "HookDiscovery: settings.json unparseable after retry — preserving existing hook rows (FR-090)",
    {
      path: filePath,
    },
  );
  return { kind: "unparseable" };
}

function tryParseJson(content: string): SettingsJson | null {
  try {
    const val = JSON.parse(content);
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      return val as SettingsJson;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook extraction from a parsed settings.json
// ---------------------------------------------------------------------------

/**
 * Extract all hook entries from a parsed settings.json for a given scope.
 *
 * Walks `hooks` (disabled=0) and `_disabled_hooks` (disabled=1) keys.
 * Returns one ParsedHook per (scope, event, matcher, command) tuple.
 */
function extractHooks(parsed: SettingsJson, scope: string): ParsedHook[] {
  const result: ParsedHook[] = [];

  function walkMap(hooksMap: HooksMap, disabled: 0 | 1): void {
    for (const [event, entries] of Object.entries(hooksMap)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (typeof entry !== "object" || entry === null) continue;
        const matcher = typeof entry.matcher === "string" ? entry.matcher : null;
        if (!Array.isArray(entry.hooks)) continue;
        for (const hookDef of entry.hooks) {
          if (typeof hookDef !== "object" || hookDef === null) continue;
          if (typeof hookDef.command !== "string" || hookDef.command.length === 0) continue;
          const command = hookDef.command;
          const hookId = computeHookId(scope, event, matcher, command);
          result.push({ scope, event, matcher, command, disabled, hookId });
        }
      }
    }
  }

  if (parsed.hooks && typeof parsed.hooks === "object" && !Array.isArray(parsed.hooks)) {
    walkMap(parsed.hooks as HooksMap, 0);
  }
  if (
    parsed._disabled_hooks &&
    typeof parsed._disabled_hooks === "object" &&
    !Array.isArray(parsed._disabled_hooks)
  ) {
    walkMap(parsed._disabled_hooks as HooksMap, 1);
  }

  return result;
}

// ---------------------------------------------------------------------------
// DB upsert helpers
// ---------------------------------------------------------------------------

const UPSERT_SQL = `
  INSERT INTO hook_index (
    id, hook_id, scope, source_path, source_hash,
    event, matcher, command,
    disabled, quarantine_reason, user_disabled,
    discovered_at, last_modified_at, last_modified_by,
    evaluator_report_id, import_source,
    workspace_id, author_id, visibility,
    created_at, updated_at, deleted_at
  ) VALUES (
    $id, $hook_id, $scope, $source_path, $source_hash,
    $event, $matcher, $command,
    $disabled, NULL, 0,
    $discovered_at, $last_modified_at, 'external',
    NULL, NULL,
    $workspace_id, $author_id, $visibility,
    $created_at, $updated_at, NULL
  )
  ON CONFLICT(hook_id) DO UPDATE SET
    last_modified_at = excluded.last_modified_at,
    last_modified_by = 'external',
    source_hash      = excluded.source_hash,
    updated_at       = excluded.updated_at,
    deleted_at       = NULL
`;

/**
 * Upsert a set of hooks for one scope into hook_index inside a transaction.
 *
 * Implements FR-090:
 *   - New rows: discovered_at = last_modified_at = now.
 *   - Existing rows (hook_id conflict): discovered_at preserved; only
 *     last_modified_at, last_modified_by, source_hash, updated_at updated.
 *
 * After upserting, soft-deletes rows for this scope whose hook_id is no
 * longer in the parsed set (FR-068 tombstone — never hard-delete).
 *
 * @param db          Open bun:sqlite Database.
 * @param hooks       Parsed hooks for this scope.
 * @param sourcePath  Absolute path to the settings.json that was parsed.
 * @param sourceHash  SHA-256 of the raw settings.json content.
 * @param scope       Scope string ('user' | 'project:<id>' | 'local:<id>').
 *
 * @returns Number of rows upserted (insert or update).
 */
function upsertHooksForScope(
  db: Database,
  hooks: ParsedHook[],
  sourcePath: string,
  sourceHash: string,
  scope: string,
): number {
  const now = Date.now();

  // Fetch existing rows for this scope so we can preserve discovered_at.
  interface ExistingRow {
    id: string;
    hook_id: string;
    discovered_at: number;
  }
  const existingRows = db
    .query<
      ExistingRow,
      [string]
    >("SELECT id, hook_id, discovered_at FROM hook_index WHERE scope = ? AND deleted_at IS NULL")
    .all(scope);

  const existingByHookId = new Map<string, ExistingHookRow>(
    existingRows.map((r) => [r.hook_id, r]),
  );

  const stmt = db.prepare(UPSERT_SQL);

  // Per-scope transaction: wraps both the INSERT batch AND the soft-delete
  // for this scope atomically. If interrupted, re-running is safe (idempotent
  // upsert + idempotent soft-delete).
  const scopeTx = db.transaction(() => {
    for (const hook of hooks) {
      const existing = existingByHookId.get(hook.hookId);
      const discoveredAt = existing !== undefined ? existing.discovered_at : now;
      const rowId = existing !== undefined ? existing.id : crypto.randomUUID();

      stmt.run({
        $id: rowId,
        $hook_id: hook.hookId,
        $scope: hook.scope,
        $source_path: sourcePath,
        $source_hash: sourceHash,
        $event: hook.event,
        $matcher: hook.matcher,
        $command: hook.command,
        $disabled: hook.disabled,
        $discovered_at: discoveredAt,
        $last_modified_at: now,
        $workspace_id: DEFAULT_WORKSPACE_ID,
        $author_id: DEFAULT_AUTHOR_ID,
        $visibility: DEFAULT_VISIBILITY,
        $created_at: discoveredAt,
        $updated_at: now,
      });
    }

    // Soft-delete rows whose hook_id is no longer in the parsed set — inside
    // the same transaction so the snapshot is atomic.
    const activeHookIds = hooks.map((h) => h.hookId);
    softDeleteRemovedHooks(db, scope, activeHookIds, now);
  });

  scopeTx();

  return hooks.length;
}

/**
 * Soft-delete hook_index rows for a given scope that are no longer in
 * activeHookIds. Uses FR-068 tombstone pattern (deleted_at = now, never
 * hard-delete).
 */
function softDeleteRemovedHooks(
  db: Database,
  scope: string,
  activeHookIds: string[],
  now: number,
): void {
  if (activeHookIds.length === 0) {
    // No active hooks — soft-delete all rows for this scope.
    db.query(
      "UPDATE hook_index SET deleted_at = ?, updated_at = ? WHERE scope = ? AND deleted_at IS NULL",
    ).run(now, now, scope);
    return;
  }

  // Build parameterized IN clause.
  const placeholders = activeHookIds.map(() => "?").join(", ");
  const sql = `
    UPDATE hook_index
       SET deleted_at = ?, updated_at = ?
     WHERE scope = ?
       AND deleted_at IS NULL
       AND hook_id NOT IN (${placeholders})
  `;
  db.query(sql).run(now, now, scope, ...activeHookIds);
}

// ---------------------------------------------------------------------------
// Project row query
// ---------------------------------------------------------------------------

interface ProjectRow {
  id: string;
  path: string;
}

function queryProjects(db: Database): ProjectRow[] {
  try {
    return db.query<ProjectRow, []>("SELECT id, path FROM projects WHERE deleted_at IS NULL").all();
  } catch (err) {
    log("WARN", "HookDiscovery: failed to query projects table — project-scope hook scan skipped", {
      error: String(err),
    });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API — HookDiscoveryTotals
// ---------------------------------------------------------------------------

export interface HookDiscoveryTotals {
  hooksDiscovered: number;
  projectsScanned: number;
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// Public API — runHookDiscovery (cold-launch full-pass)
// ---------------------------------------------------------------------------

/**
 * Run the cold-launch hook discovery pass.
 *
 * Scans ~/.claude/settings.json (user scope) and every tracked project's
 * <project>/.claude/settings.json + settings.local.json (project + local scope).
 *
 * Upserts all discovered hooks into hook_index. Emits HookIndexCompletedEvent
 * when done.
 *
 * Called from index.ts after runValidationPipeline() resolves.
 *
 * @param db  Open bun:sqlite Database instance.
 */
export async function runHookDiscovery(db: Database): Promise<HookDiscoveryTotals> {
  const startMs = Date.now();
  log("INFO", "HookDiscovery: cold-launch hook discovery starting");

  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
  let hooksDiscovered = 0;
  let projectsScanned = 0;

  // --- User scope: ~/.claude/settings.json ---
  const userSettingsPath = join(homeDir, ".claude", "settings.json");
  const userResult = await readSettingsJson(userSettingsPath);
  if (userResult.kind === "ok") {
    const hooks = extractHooks(userResult.parsed, "user");
    const sourceHash = computeSourceHash(userResult.content);
    hooksDiscovered += upsertHooksForScope(db, hooks, userSettingsPath, sourceHash, "user");
    log("INFO", "HookDiscovery: user scope upserted", {
      path: userSettingsPath,
      hookCount: hooks.length,
      sizeBytes: userResult.sizeBytes,
    });
  } else if (userResult.kind === "absent") {
    log("INFO", "HookDiscovery: ~/.claude/settings.json absent — user scope soft-deleted");
    // File is gone: tombstone previously discovered user-scope hooks.
    softDeleteRemovedHooks(db, "user", [], Date.now());
  } else {
    // unparseable — file exists but is malformed. Preserve existing rows (FR-090).
    log(
      "WARN",
      "HookDiscovery: ~/.claude/settings.json unparseable — preserving existing user-scope hooks",
    );
  }

  // --- Project + local scopes ---
  const projectRows = queryProjects(db);
  projectsScanned = projectRows.length;

  for (const project of projectRows) {
    // project scope: <project>/.claude/settings.json
    const projectSettingsPath = join(project.path, ".claude", "settings.json");
    const projectScope = `project:${project.id}`;
    const projectResult = await readSettingsJson(projectSettingsPath);
    if (projectResult.kind === "ok") {
      const hooks = extractHooks(projectResult.parsed, projectScope);
      const sourceHash = computeSourceHash(projectResult.content);
      hooksDiscovered += upsertHooksForScope(
        db,
        hooks,
        projectSettingsPath,
        sourceHash,
        projectScope,
      );
      log("INFO", "HookDiscovery: project scope upserted", {
        path: projectSettingsPath,
        projectId: project.id,
        hookCount: hooks.length,
      });
    } else if (projectResult.kind === "absent") {
      softDeleteRemovedHooks(db, projectScope, [], Date.now());
    } else {
      // unparseable — preserve existing rows.
      log("WARN", "HookDiscovery: project settings.json unparseable — preserving existing rows", {
        path: projectSettingsPath,
        projectId: project.id,
      });
    }

    // local scope: <project>/.claude/settings.local.json
    const localSettingsPath = join(project.path, ".claude", "settings.local.json");
    const localScope = `local:${project.id}`;
    const localResult = await readSettingsJson(localSettingsPath);
    if (localResult.kind === "ok") {
      const hooks = extractHooks(localResult.parsed, localScope);
      const sourceHash = computeSourceHash(localResult.content);
      hooksDiscovered += upsertHooksForScope(db, hooks, localSettingsPath, sourceHash, localScope);
      log("INFO", "HookDiscovery: local scope upserted", {
        path: localSettingsPath,
        projectId: project.id,
        hookCount: hooks.length,
      });
    } else if (localResult.kind === "absent") {
      softDeleteRemovedHooks(db, localScope, [], Date.now());
    } else {
      // unparseable — preserve existing rows.
      log("WARN", "HookDiscovery: local settings.json unparseable — preserving existing rows", {
        path: localSettingsPath,
        projectId: project.id,
      });
    }
  }

  const elapsedMs = Date.now() - startMs;
  log("INFO", "HookDiscovery: cold-launch complete", {
    hooksDiscovered,
    projectsScanned,
    elapsedMs,
  });

  const completedEvent: HookIndexCompletedEvent = {
    type: HOOK_INDEX_COMPLETED,
    hooksDiscovered,
    projectsScanned,
    elapsedMs,
  };
  emit(completedEvent);

  return { hooksDiscovered, projectsScanned, elapsedMs };
}

// ---------------------------------------------------------------------------
// Public API — reindexHooksForPath (watcher-triggered single-file pass)
// ---------------------------------------------------------------------------

/**
 * Re-parse a single settings.json / settings.local.json and re-upsert its hooks.
 *
 * Called from the watcher subscriber in index.ts when a coalesced event arrives
 * for a settings file. Resolves the scope by matching the path against project
 * roots in the `projects` table.
 *
 * FR-089: the 250 ms latency target is measured from the coalesced event (the
 * 250 ms debounce absorbs the raw FS event lag). This function should complete
 * well within that window for normal-sized settings files.
 *
 * @param db            Open bun:sqlite Database instance.
 * @param absolutePath  Absolute path to the changed settings file.
 */
export async function reindexHooksForPath(db: Database, absolutePath: string): Promise<void> {
  const startMs = Date.now();
  log("INFO", "HookDiscovery: per-event reindex triggered", { path: absolutePath });

  // Normalize path separators for comparison (Windows safety).
  const normalizedPath = absolutePath.replaceAll("\\", "/");

  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
  const userSettingsPath = join(homeDir, ".claude", "settings.json").replaceAll("\\", "/");

  // --- User scope ---
  if (normalizedPath === userSettingsPath) {
    const result = await readSettingsJson(absolutePath);
    if (result.kind === "ok") {
      const hooks = extractHooks(result.parsed, "user");
      const sourceHash = computeSourceHash(result.content);
      upsertHooksForScope(db, hooks, absolutePath, sourceHash, "user");
    } else if (result.kind === "absent") {
      softDeleteRemovedHooks(db, "user", [], Date.now());
    } else {
      // unparseable — preserve existing rows (FR-090).
      log(
        "WARN",
        "HookDiscovery: per-event reindex — user settings.json unparseable, rows preserved",
      );
    }
    log("INFO", "HookDiscovery: per-event reindex complete (user scope)", {
      path: absolutePath,
      elapsedMs: Date.now() - startMs,
    });
    return;
  }

  // --- Project / local scope: match against projects table ---
  const projectRows = queryProjects(db);

  for (const project of projectRows) {
    const projectSettings = join(project.path, ".claude", "settings.json").replaceAll("\\", "/");
    const localSettings = join(project.path, ".claude", "settings.local.json").replaceAll(
      "\\",
      "/",
    );

    if (normalizedPath === projectSettings) {
      const result = await readSettingsJson(absolutePath);
      const scope = `project:${project.id}`;
      if (result.kind === "ok") {
        const hooks = extractHooks(result.parsed, scope);
        const sourceHash = computeSourceHash(result.content);
        upsertHooksForScope(db, hooks, absolutePath, sourceHash, scope);
      } else if (result.kind === "absent") {
        softDeleteRemovedHooks(db, scope, [], Date.now());
      } else {
        // unparseable — preserve existing rows (FR-090).
        log(
          "WARN",
          "HookDiscovery: per-event reindex — project settings.json unparseable, rows preserved",
          {
            projectId: project.id,
          },
        );
      }
      log("INFO", "HookDiscovery: per-event reindex complete (project scope)", {
        path: absolutePath,
        projectId: project.id,
        elapsedMs: Date.now() - startMs,
      });
      return;
    }

    if (normalizedPath === localSettings) {
      const result = await readSettingsJson(absolutePath);
      const scope = `local:${project.id}`;
      if (result.kind === "ok") {
        const hooks = extractHooks(result.parsed, scope);
        const sourceHash = computeSourceHash(result.content);
        upsertHooksForScope(db, hooks, absolutePath, sourceHash, scope);
      } else if (result.kind === "absent") {
        softDeleteRemovedHooks(db, scope, [], Date.now());
      } else {
        // unparseable — preserve existing rows (FR-090).
        log(
          "WARN",
          "HookDiscovery: per-event reindex — local settings.json unparseable, rows preserved",
          {
            projectId: project.id,
          },
        );
      }
      log("INFO", "HookDiscovery: per-event reindex complete (local scope)", {
        path: absolutePath,
        projectId: project.id,
        elapsedMs: Date.now() - startMs,
      });
      return;
    }
  }

  log("WARN", "HookDiscovery: per-event reindex — path not matched to any known scope", {
    path: absolutePath,
    elapsedMs: Date.now() - startMs,
  });
}
