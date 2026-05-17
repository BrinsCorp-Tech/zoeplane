// @vitest-environment node
/**
 * Tests for hook-discovery.ts (Story 3.6).
 *
 * Vitest runs on Node, not Bun, so `bun:sqlite` is unavailable — we use a
 * structural fake Database (same pattern as validator.test.ts / resolver.test.ts).
 *
 * Real tmpdir fixtures are used for settings.json content — no fs mocks.
 *
 * Windows regression: HOME + USERPROFILE are both set so os.homedir() / the
 * HOME ?? USERPROFILE fallback in hook-discovery.ts resolves cross-platform.
 * Path comparisons in the module use replaceAll("\\", "/") normalization so
 * tests that construct paths with node:path native separators are exercised on
 * any host.
 *
 * No permission-denied tests use chmod — those are wrapped with
 * describe.skipIf(process.platform === "win32") per the Windows-CI pattern.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Database, Statement } from "bun:sqlite";
import {
  runHookDiscovery,
  reindexHooksForPath,
  subscribeToHookDiscoveryEvents,
} from "../hook-discovery";
import type { WatcherEvent } from "@zoeplane/shared-types";
import { HOOK_INDEX_COMPLETED, type HookIndexCompletedEvent } from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Fake Database
// ---------------------------------------------------------------------------

/** A captured DB write (INSERT, UPDATE, or run). */
interface CapturedWrite {
  sql: string;
  params: unknown[];
}

/** An in-memory hook_index row for assertion. */
interface FakeHookRow {
  id: string;
  hook_id: string;
  scope: string;
  source_path: string;
  source_hash: string;
  event: string;
  matcher: string | null;
  command: string;
  disabled: 0 | 1;
  discovered_at: number;
  last_modified_at: number;
  last_modified_by: string;
  deleted_at: number | null;
  workspace_id: string;
  author_id: string;
  visibility: string;
  created_at: number;
  updated_at: number;
}

interface FakeProjectRow {
  id: string;
  path: string;
}

interface FakeDbResult {
  db: Database;
  hookRows: FakeHookRow[];
  writes: CapturedWrite[];
  projects: FakeProjectRow[];
}

/**
 * Build a fake Database that simulates hook_index + projects tables.
 *
 * The fake:
 * - Returns `projects` from SELECT ... FROM projects queries.
 * - Returns `hookRows` from SELECT ... FROM hook_index queries.
 * - Applies INSERT (UPSERT) rows into hookRows in-memory.
 * - Applies UPDATE soft-delete into hookRows in-memory.
 * - Captures all writes in `writes` for assertion.
 */
function makeFakeDb(
  initialHookRows: FakeHookRow[] = [],
  projects: FakeProjectRow[] = [],
): FakeDbResult {
  const hookRows: FakeHookRow[] = initialHookRows.map((r) => ({ ...r }));
  const writes: CapturedWrite[] = [];

  function applyUpsert(params: Record<string, unknown>): void {
    const hookId = params.$hook_id as string;
    const existing = hookRows.find((r) => r.hook_id === hookId);
    if (existing !== null && existing !== undefined) {
      // ON CONFLICT DO UPDATE: preserve discovered_at, update the rest.
      existing.last_modified_at = params.$last_modified_at as number;
      existing.last_modified_by = "external";
      existing.source_hash = params.$source_hash as string;
      existing.updated_at = params.$updated_at as number;
      existing.deleted_at = null;
      existing.source_path = params.$source_path as string;
    } else {
      // New row insert.
      hookRows.push({
        id: params.$id as string,
        hook_id: params.$hook_id as string,
        scope: params.$scope as string,
        source_path: params.$source_path as string,
        source_hash: params.$source_hash as string,
        event: params.$event as string,
        matcher: (params.$matcher as string | null) ?? null,
        command: params.$command as string,
        disabled: params.$disabled as 0 | 1,
        discovered_at: params.$discovered_at as number,
        last_modified_at: params.$last_modified_at as number,
        last_modified_by: "external",
        deleted_at: null,
        workspace_id: params.$workspace_id as string,
        author_id: params.$author_id as string,
        visibility: params.$visibility as string,
        created_at: params.$created_at as number,
        updated_at: params.$updated_at as number,
      });
    }
  }

  function applySoftDelete(sql: string, params: unknown[]): void {
    // Two shapes:
    //   1. Soft-delete all for scope: UPDATE hook_index SET deleted_at=? ... WHERE scope=? AND deleted_at IS NULL
    //   2. Soft-delete non-present:   UPDATE hook_index SET deleted_at=? ... WHERE scope=? AND ... AND hook_id NOT IN (...)
    const now = params[0] as number;
    const updatedAt = params[1] as number;
    const scope = params[2] as string;

    if (sql.includes("NOT IN")) {
      // Extract active hook IDs from remaining params.
      const activeIds = params.slice(3) as string[];
      for (const row of hookRows) {
        if (row.scope === scope && row.deleted_at === null && !activeIds.includes(row.hook_id)) {
          row.deleted_at = now;
          row.updated_at = updatedAt;
        }
      }
    } else {
      // Soft-delete all for scope.
      for (const row of hookRows) {
        if (row.scope === scope && row.deleted_at === null) {
          row.deleted_at = now;
          row.updated_at = updatedAt;
        }
      }
    }
  }

  const db = {
    prepare(sql: string): Statement {
      return {
        run(params: unknown): unknown {
          writes.push({ sql, params: [params] });
          if (sql.includes("INSERT INTO hook_index")) {
            applyUpsert(params as Record<string, unknown>);
          }
          return { changes: 1, lastInsertRowid: 0 };
        },
        get: () => null,
        all: () => [],
        values: () => [],
        finalize: () => undefined,
        toString: () => sql,
      } as unknown as Statement;
    },

    query<T, _P>(sql: string) {
      return {
        all(...args: unknown[]): T[] {
          if (sql.includes("FROM projects")) {
            return projects as unknown as T[];
          }
          if (
            sql.includes("FROM hook_index") &&
            sql.includes("SELECT id, hook_id, discovered_at")
          ) {
            // Return only active rows for the given scope — first positional
            // arg matches the `scope = ?` parameter in the production query.
            const scope = args[0] as string;
            return hookRows.filter(
              (r) => r.deleted_at === null && r.scope === scope,
            ) as unknown as T[];
          }
          return [] as T[];
        },
        get(_scope?: unknown): T | null {
          return null;
        },
        run(...params: unknown[]): unknown {
          writes.push({ sql, params });
          // The soft-delete SQL may have whitespace/newlines between "hook_index" and "SET".
          if (sql.includes("UPDATE hook_index") && sql.includes("deleted_at")) {
            applySoftDelete(sql, params);
          }
          return { changes: 0, lastInsertRowid: 0 };
        },
      };
    },

    transaction<T extends (...args: unknown[]) => unknown>(fn: T): T {
      return ((...args: unknown[]) => fn(...args)) as unknown as T;
    },

    exec(_sql: string): void {
      /* no-op */
    },
  } as unknown as Database;

  return { db, hookRows, writes, projects };
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeSettingsJson(
  hooks: Record<string, unknown>,
  disabledHooks?: Record<string, unknown>,
): string {
  const obj: Record<string, unknown> = { hooks };
  if (disabledHooks !== undefined) {
    obj._disabled_hooks = disabledHooks;
  }
  return JSON.stringify(obj, null, 2);
}

/** Standard hook entry structure. */
function hookEntry(command: string, matcher?: string): Record<string, unknown> {
  const entry: Record<string, unknown> = { hooks: [{ command }] };
  if (matcher !== undefined) {
    entry.matcher = matcher;
  }
  return entry;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("hook-discovery", () => {
  let tmpDir: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hook-discovery-test-"));
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    // Point HOME at tmpDir so ~/.claude/ resolves to our fixture directory.
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    if (originalUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalUserProfile;
    }
  });

  // -------------------------------------------------------------------------
  // hook_id computation
  // -------------------------------------------------------------------------

  describe("hook_id computation", () => {
    it("computes correct sha256 with no separator — user scope", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      const content = makeSettingsJson({
        PostToolUse: [hookEntry("echo done")],
      });
      writeFileSync(join(claudeDir, "settings.json"), content);

      const { db, hookRows } = makeFakeDb();
      await runHookDiscovery(db);

      const activeRows = hookRows.filter((r) => r.deleted_at === null);
      expect(activeRows).toHaveLength(1);

      // Verify hook_id = sha256("user" + "PostToolUse" + "" + "echo done")
      const expectedHookId = sha256("user" + "PostToolUse" + "" + "echo done");
      expect(activeRows[0].hook_id).toBe(expectedHookId);
    });

    it("includes matcher in hook_id when present", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      const content = makeSettingsJson({
        PreToolUse: [hookEntry("./notify.sh", "Bash")],
      });
      writeFileSync(join(claudeDir, "settings.json"), content);

      const { db, hookRows } = makeFakeDb();
      await runHookDiscovery(db);

      const activeRows = hookRows.filter((r) => r.deleted_at === null);
      expect(activeRows).toHaveLength(1);

      const expectedHookId = sha256("user" + "PreToolUse" + "Bash" + "./notify.sh");
      expect(activeRows[0].hook_id).toBe(expectedHookId);
      expect(activeRows[0].matcher).toBe("Bash");
    });

    it("produces different hook_ids for same command with vs without matcher", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      const content = makeSettingsJson({
        PostToolUse: [hookEntry("echo done"), hookEntry("echo done", "Write")],
      });
      writeFileSync(join(claudeDir, "settings.json"), content);

      const { db, hookRows } = makeFakeDb();
      await runHookDiscovery(db);

      const activeRows = hookRows.filter((r) => r.deleted_at === null);
      expect(activeRows).toHaveLength(2);
      expect(activeRows[0].hook_id).not.toBe(activeRows[1].hook_id);
    });

    it("hook_id hex output is lowercase", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      writeFileSync(
        join(claudeDir, "settings.json"),
        makeSettingsJson({ Stop: [hookEntry("echo stop")] }),
      );

      const { db, hookRows } = makeFakeDb();
      await runHookDiscovery(db);

      const row = hookRows.find((r) => r.deleted_at === null);
      expect(row).toBeDefined();
      expect(row!.hook_id).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // -------------------------------------------------------------------------
  // Cold-launch: user scope
  // -------------------------------------------------------------------------

  describe("runHookDiscovery — user scope", () => {
    it("upserts hooks from ~/.claude/settings.json with scope='user'", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      writeFileSync(
        join(claudeDir, "settings.json"),
        makeSettingsJson({
          PostToolUse: [hookEntry("echo a"), hookEntry("echo b", "Write")],
          Stop: [hookEntry("./stop.sh")],
        }),
      );

      const { db, hookRows } = makeFakeDb();
      const totals = await runHookDiscovery(db);

      const active = hookRows.filter((r) => r.deleted_at === null);
      expect(active).toHaveLength(3);
      expect(active.every((r) => r.scope === "user")).toBe(true);
      expect(active.every((r) => r.last_modified_by === "external")).toBe(true);
      expect(totals.hooksDiscovered).toBe(3);
    });

    it("marks hooks as disabled=0 from hooks key and disabled=1 from _disabled_hooks key", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      writeFileSync(
        join(claudeDir, "settings.json"),
        makeSettingsJson(
          { PostToolUse: [hookEntry("active-cmd")] },
          { PreToolUse: [hookEntry("disabled-cmd")] },
        ),
      );

      const { db, hookRows } = makeFakeDb();
      await runHookDiscovery(db);

      const active = hookRows.filter((r) => r.deleted_at === null && r.command === "active-cmd");
      const disabled = hookRows.filter(
        (r) => r.deleted_at === null && r.command === "disabled-cmd",
      );

      expect(active).toHaveLength(1);
      expect(active[0].disabled).toBe(0);
      expect(disabled).toHaveLength(1);
      expect(disabled[0].disabled).toBe(1);
    });

    it("skips user scope gracefully when ~/.claude/settings.json does not exist", async () => {
      // No .claude directory created — settings.json absent.
      const { db, hookRows } = makeFakeDb();
      const totals = await runHookDiscovery(db);

      expect(hookRows.filter((r) => r.scope === "user")).toHaveLength(0);
      expect(totals.hooksDiscovered).toBe(0);
    });

    it("soft-deletes previously discovered user hooks when settings.json is removed", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      // Pre-existing row for user scope.
      const existingHook: FakeHookRow = {
        id: crypto.randomUUID(),
        hook_id: sha256("userPostToolUseecho old"),
        scope: "user",
        source_path: join(claudeDir, "settings.json"),
        source_hash: "aabbcc",
        event: "PostToolUse",
        matcher: null,
        command: "echo old",
        disabled: 0,
        discovered_at: 1000,
        last_modified_at: 1000,
        last_modified_by: "external",
        deleted_at: null,
        workspace_id: "00000000-0000-0000-0000-000000000001",
        author_id: "00000000-0000-0000-0000-000000000001",
        visibility: "private",
        created_at: 1000,
        updated_at: 1000,
      };

      // Do not create the settings.json file — simulate removal.
      const { db, hookRows } = makeFakeDb([existingHook]);
      await runHookDiscovery(db);

      // The pre-existing row should be soft-deleted.
      const userRows = hookRows.filter((r) => r.scope === "user");
      expect(userRows.every((r) => r.deleted_at !== null)).toBe(true);
    });

    it("sets FR-068 sync-friendly defaults on new rows", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      writeFileSync(
        join(claudeDir, "settings.json"),
        makeSettingsJson({ Stop: [hookEntry("echo stop")] }),
      );

      const { db, hookRows } = makeFakeDb();
      await runHookDiscovery(db);

      const row = hookRows.find((r) => r.deleted_at === null);
      expect(row).toBeDefined();
      expect(row!.workspace_id).toBe("00000000-0000-0000-0000-000000000001");
      expect(row!.author_id).toBe("00000000-0000-0000-0000-000000000001");
      expect(row!.visibility).toBe("private");
      expect(row!.deleted_at).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Cold-launch: project + local scopes
  // -------------------------------------------------------------------------

  describe("runHookDiscovery — project and local scopes", () => {
    it("upserts project-scope hooks from <project>/.claude/settings.json", async () => {
      const projectPath = join(tmpDir, "my-project");
      const claudeDir = join(projectPath, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      const projectId = crypto.randomUUID();
      writeFileSync(
        join(claudeDir, "settings.json"),
        makeSettingsJson({ PostToolUse: [hookEntry("echo project-hook")] }),
      );

      const { db, hookRows } = makeFakeDb([], [{ id: projectId, path: projectPath }]);
      await runHookDiscovery(db);

      const projectRows = hookRows.filter(
        (r) => r.scope === `project:${projectId}` && r.deleted_at === null,
      );
      expect(projectRows).toHaveLength(1);
      expect(projectRows[0].command).toBe("echo project-hook");

      const expectedHookId = sha256(
        `project:${projectId}` + "PostToolUse" + "" + "echo project-hook",
      );
      expect(projectRows[0].hook_id).toBe(expectedHookId);
    });

    it("upserts local-scope hooks from <project>/.claude/settings.local.json", async () => {
      const projectPath = join(tmpDir, "my-project");
      const claudeDir = join(projectPath, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      const projectId = crypto.randomUUID();
      writeFileSync(
        join(claudeDir, "settings.local.json"),
        makeSettingsJson({ PreToolUse: [hookEntry("./local-hook.sh")] }),
      );

      const { db, hookRows } = makeFakeDb([], [{ id: projectId, path: projectPath }]);
      await runHookDiscovery(db);

      const localRows = hookRows.filter(
        (r) => r.scope === `local:${projectId}` && r.deleted_at === null,
      );
      expect(localRows).toHaveLength(1);
      expect(localRows[0].command).toBe("./local-hook.sh");
    });

    it("returns correct projectsScanned count", async () => {
      const p1Path = join(tmpDir, "project-1");
      const p2Path = join(tmpDir, "project-2");
      mkdirSync(join(p1Path, ".claude"), { recursive: true });
      mkdirSync(join(p2Path, ".claude"), { recursive: true });

      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();

      const { db } = makeFakeDb(
        [],
        [
          { id: id1, path: p1Path },
          { id: id2, path: p2Path },
        ],
      );
      const totals = await runHookDiscovery(db);

      expect(totals.projectsScanned).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // FR-090: discovered_at preservation
  // -------------------------------------------------------------------------

  describe("discovered_at preservation (FR-090)", () => {
    it("preserves discovered_at on upsert when hook_id already exists", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      const command = "echo preserved";
      const event = "PostToolUse";
      const hookId = sha256("user" + event + "" + command);
      const originalDiscoveredAt = 12345678;

      const existingHook: FakeHookRow = {
        id: crypto.randomUUID(),
        hook_id: hookId,
        scope: "user",
        source_path: join(claudeDir, "settings.json"),
        source_hash: "old-hash",
        event,
        matcher: null,
        command,
        disabled: 0,
        discovered_at: originalDiscoveredAt,
        last_modified_at: originalDiscoveredAt,
        last_modified_by: "external",
        deleted_at: null,
        workspace_id: "00000000-0000-0000-0000-000000000001",
        author_id: "00000000-0000-0000-0000-000000000001",
        visibility: "private",
        created_at: originalDiscoveredAt,
        updated_at: originalDiscoveredAt,
      };

      writeFileSync(
        join(claudeDir, "settings.json"),
        makeSettingsJson({ [event]: [hookEntry(command)] }),
      );

      const { db, hookRows } = makeFakeDb([existingHook]);
      await runHookDiscovery(db);

      const row = hookRows.find((r) => r.hook_id === hookId);
      expect(row).toBeDefined();
      // discovered_at must be preserved from the original row.
      expect(row!.discovered_at).toBe(originalDiscoveredAt);
      // last_modified_at should be updated.
      expect(row!.last_modified_at).toBeGreaterThan(originalDiscoveredAt);
    });

    it("sets discovered_at = last_modified_at for new rows", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      writeFileSync(
        join(claudeDir, "settings.json"),
        makeSettingsJson({ Stop: [hookEntry("echo new")] }),
      );

      const { db, hookRows } = makeFakeDb();
      const beforeMs = Date.now();
      await runHookDiscovery(db);
      const afterMs = Date.now();

      const row = hookRows.find((r) => r.deleted_at === null);
      expect(row).toBeDefined();
      expect(row!.discovered_at).toBeGreaterThanOrEqual(beforeMs);
      expect(row!.discovered_at).toBeLessThanOrEqual(afterMs);
      expect(row!.discovered_at).toBe(row!.last_modified_at);
    });
  });

  // -------------------------------------------------------------------------
  // Soft-delete removed hooks
  // -------------------------------------------------------------------------

  describe("soft-delete removed hooks", () => {
    it("soft-deletes hook_index rows whose hook_id is no longer in the parsed file", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      const removedCommand = "echo removed";
      const removedHookId = sha256("user" + "PostToolUse" + "" + removedCommand);

      const existing: FakeHookRow = {
        id: crypto.randomUUID(),
        hook_id: removedHookId,
        scope: "user",
        source_path: join(claudeDir, "settings.json"),
        source_hash: "old-hash",
        event: "PostToolUse",
        matcher: null,
        command: removedCommand,
        disabled: 0,
        discovered_at: 5000,
        last_modified_at: 5000,
        last_modified_by: "external",
        deleted_at: null,
        workspace_id: "00000000-0000-0000-0000-000000000001",
        author_id: "00000000-0000-0000-0000-000000000001",
        visibility: "private",
        created_at: 5000,
        updated_at: 5000,
      };

      // New settings.json does NOT contain the removed command.
      writeFileSync(
        join(claudeDir, "settings.json"),
        makeSettingsJson({ Stop: [hookEntry("echo new")] }),
      );

      const { db, hookRows } = makeFakeDb([existing]);
      await runHookDiscovery(db);

      const removedRow = hookRows.find((r) => r.hook_id === removedHookId);
      expect(removedRow).toBeDefined();
      expect(removedRow!.deleted_at).not.toBeNull();
    });

    it("soft-deletes all scope rows when hooks key is empty", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      const existing: FakeHookRow = {
        id: crypto.randomUUID(),
        hook_id: sha256("userStopecho x"),
        scope: "user",
        source_path: join(claudeDir, "settings.json"),
        source_hash: "old-hash",
        event: "Stop",
        matcher: null,
        command: "echo x",
        disabled: 0,
        discovered_at: 1000,
        last_modified_at: 1000,
        last_modified_by: "external",
        deleted_at: null,
        workspace_id: "00000000-0000-0000-0000-000000000001",
        author_id: "00000000-0000-0000-0000-000000000001",
        visibility: "private",
        created_at: 1000,
        updated_at: 1000,
      };

      // settings.json with empty hooks.
      writeFileSync(join(claudeDir, "settings.json"), JSON.stringify({ hooks: {} }));

      const { db, hookRows } = makeFakeDb([existing]);
      await runHookDiscovery(db);

      expect(hookRows.every((r) => r.deleted_at !== null)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // SSE event emission
  // -------------------------------------------------------------------------

  describe("SSE event emission", () => {
    it("emits HookIndexCompletedEvent after cold-launch with correct totals", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      writeFileSync(
        join(claudeDir, "settings.json"),
        makeSettingsJson({
          PostToolUse: [hookEntry("echo a"), hookEntry("echo b")],
        }),
      );

      const received: WatcherEvent[] = [];
      const { db } = makeFakeDb();
      const unsub = subscribeToHookDiscoveryEvents((ev) => received.push(ev));

      await runHookDiscovery(db);
      unsub();

      const completedEvents = received.filter((e) => e.type === HOOK_INDEX_COMPLETED);
      expect(completedEvents).toHaveLength(1);

      const ev = completedEvents[0] as HookIndexCompletedEvent;
      expect(ev.hooksDiscovered).toBe(2);
      expect(ev.projectsScanned).toBe(0);
      expect(ev.elapsedMs).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // reindexHooksForPath — per-event single-file pass
  // -------------------------------------------------------------------------

  describe("reindexHooksForPath", () => {
    it("re-upserts hooks when a settings.json file changes", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      const settingsPath = join(claudeDir, "settings.json");
      writeFileSync(settingsPath, makeSettingsJson({ Stop: [hookEntry("echo updated")] }));

      const { db, hookRows } = makeFakeDb();
      await reindexHooksForPath(db, settingsPath);

      const active = hookRows.filter((r) => r.deleted_at === null);
      expect(active).toHaveLength(1);
      expect(active[0].command).toBe("echo updated");
      expect(active[0].scope).toBe("user");
    });

    it("re-upserts hooks for project scope when project settings.json changes", async () => {
      const projectPath = join(tmpDir, "proj");
      const claudeDir = join(projectPath, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      const projectId = crypto.randomUUID();
      const settingsPath = join(claudeDir, "settings.json");
      writeFileSync(settingsPath, makeSettingsJson({ PreToolUse: [hookEntry("./pre.sh")] }));

      const { db, hookRows } = makeFakeDb([], [{ id: projectId, path: projectPath }]);
      await reindexHooksForPath(db, settingsPath);

      const active = hookRows.filter(
        (r) => r.scope === `project:${projectId}` && r.deleted_at === null,
      );
      expect(active).toHaveLength(1);
      expect(active[0].command).toBe("./pre.sh");
    });

    it("re-upserts hooks for local scope when settings.local.json changes", async () => {
      const projectPath = join(tmpDir, "proj");
      const claudeDir = join(projectPath, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      const projectId = crypto.randomUUID();
      const localPath = join(claudeDir, "settings.local.json");
      writeFileSync(localPath, makeSettingsJson({ Stop: [hookEntry("./local.sh")] }));

      const { db, hookRows } = makeFakeDb([], [{ id: projectId, path: projectPath }]);
      await reindexHooksForPath(db, localPath);

      const active = hookRows.filter(
        (r) => r.scope === `local:${projectId}` && r.deleted_at === null,
      );
      expect(active).toHaveLength(1);
      expect(active[0].command).toBe("./local.sh");
    });

    it("soft-deletes scope hooks when settings.json is removed (file absent on reindex)", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      // Pre-existing row — no settings.json on disk.
      const existing: FakeHookRow = {
        id: crypto.randomUUID(),
        hook_id: sha256("userStopecho gone"),
        scope: "user",
        source_path: join(claudeDir, "settings.json"),
        source_hash: "gone-hash",
        event: "Stop",
        matcher: null,
        command: "echo gone",
        disabled: 0,
        discovered_at: 9999,
        last_modified_at: 9999,
        last_modified_by: "external",
        deleted_at: null,
        workspace_id: "00000000-0000-0000-0000-000000000001",
        author_id: "00000000-0000-0000-0000-000000000001",
        visibility: "private",
        created_at: 9999,
        updated_at: 9999,
      };

      const { db, hookRows } = makeFakeDb([existing]);
      // Pass the path without creating the file — simulates a removal event.
      await reindexHooksForPath(db, join(claudeDir, "settings.json"));

      const userRows = hookRows.filter((r) => r.scope === "user");
      expect(userRows.every((r) => r.deleted_at !== null)).toBe(true);
    });

    it("logs a warning but does not throw when path is not matched to any scope", async () => {
      const { db } = makeFakeDb();
      const unknownPath = join(tmpDir, "some", "other", "settings.json");

      // Should not throw.
      await expect(reindexHooksForPath(db, unknownPath)).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Windows path regression
  // -------------------------------------------------------------------------

  describe("Windows path regression", () => {
    it("path.endsWith('settings.json') matches on POSIX paths (in index.ts watcher branch)", () => {
      // Verify the substring match pattern used in index.ts is portable.
      // On Windows, path.join uses backslashes but the endsWith check is
      // a suffix match on the raw string — both "\settings.json" and
      // "/settings.json" end with "settings.json".
      const posixPath = "/home/user/.claude/settings.json";
      const winPath = "C:\\Users\\user\\.claude\\settings.json";
      const posixLocal = "/home/user/project/.claude/settings.local.json";
      const winLocal = "C:\\Users\\user\\project\\.claude\\settings.local.json";

      expect(posixPath.endsWith("settings.json")).toBe(true);
      expect(winPath.endsWith("settings.json")).toBe(true);
      expect(posixLocal.endsWith("settings.local.json")).toBe(true);
      expect(winLocal.endsWith("settings.local.json")).toBe(true);

      // Note: "othersettings.json" also ends with "settings.json" — endsWith is a suffix
      // check, not a basename check. This is acceptable because "othersettings.json" is
      // not a realistic Claude settings filename. The pattern is intentionally kept simple
      // per the Sprint 3 Windows-CI note (path module sep doesn't apply to substring matching).
      expect("/home/user/.claude/othersettings.json".endsWith("settings.json")).toBe(true);
    });

    it("replaceAll('\\\\', '/') normalizes Windows paths for scope matching", () => {
      const winPath = "C:\\Users\\user\\.claude\\settings.json";
      const normalized = winPath.replaceAll("\\", "/");
      expect(normalized).toBe("C:/Users/user/.claude/settings.json");
      expect(normalized.endsWith("settings.json")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Malformed JSON: parse failure + retry
  // -------------------------------------------------------------------------

  describe("malformed settings.json", () => {
    it("skips upsert when settings.json is malformed JSON (both attempts fail)", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      // Write malformed JSON.
      writeFileSync(join(claudeDir, "settings.json"), "{ this is not valid JSON }}}");

      const { db, hookRows } = makeFakeDb();

      // Should not throw.
      await expect(runHookDiscovery(db)).resolves.toBeDefined();

      // No rows should have been upserted.
      const active = hookRows.filter((r) => r.deleted_at === null);
      expect(active).toHaveLength(0);
    }, 10_000); // allow up to 10 s to account for the 50 ms retry

    it("preserves existing hooks when settings.json is malformed (FR-090 — no discovered_at loss)", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      // Seed a pre-existing user-scope hook row.
      const originalDiscoveredAt = 11111111;
      const existingHook: FakeHookRow = {
        id: crypto.randomUUID(),
        hook_id: sha256("userPostToolUseecho preserved-on-malformed"),
        scope: "user",
        source_path: join(claudeDir, "settings.json"),
        source_hash: "valid-hash-from-before",
        event: "PostToolUse",
        matcher: null,
        command: "echo preserved-on-malformed",
        disabled: 0,
        discovered_at: originalDiscoveredAt,
        last_modified_at: originalDiscoveredAt,
        last_modified_by: "external",
        deleted_at: null,
        workspace_id: "00000000-0000-0000-0000-000000000001",
        author_id: "00000000-0000-0000-0000-000000000001",
        visibility: "private",
        created_at: originalDiscoveredAt,
        updated_at: originalDiscoveredAt,
      };

      // Write malformed JSON (simulates mid-write state where even the retry fails).
      writeFileSync(join(claudeDir, "settings.json"), "{ broken json that will never parse }}}");

      const { db, hookRows } = makeFakeDb([existingHook]);

      // Should not throw.
      await expect(runHookDiscovery(db)).resolves.toBeDefined();

      // Existing row must survive with original discovered_at intact.
      const userRows = hookRows.filter((r) => r.scope === "user");
      expect(userRows).toHaveLength(1);
      expect(userRows[0].deleted_at).toBeNull(); // NOT soft-deleted
      expect(userRows[0].discovered_at).toBe(originalDiscoveredAt); // FR-090 preserved
    }, 10_000); // allow up to 10 s to account for the 50 ms retry
  });

  // -------------------------------------------------------------------------
  // Cross-scope isolation
  // -------------------------------------------------------------------------

  describe("cross-scope isolation", () => {
    it("user-scope cold launch does not touch project-scope rows", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      // User-scope settings.json with one hook.
      writeFileSync(
        join(claudeDir, "settings.json"),
        makeSettingsJson({ Stop: [hookEntry("echo user-only")] }),
      );

      const projectId = crypto.randomUUID();
      const originalDiscoveredAt = 99999999;

      // Seed a project-scope row. No project settings.json on disk — projects
      // table is empty, so project scope is never processed.
      const projectHook: FakeHookRow = {
        id: crypto.randomUUID(),
        hook_id: sha256(`project:${projectId}PostToolUseecho project-hook`),
        scope: `project:${projectId}`,
        source_path: join(tmpDir, "proj", ".claude", "settings.json"),
        source_hash: "project-hash",
        event: "PostToolUse",
        matcher: null,
        command: "echo project-hook",
        disabled: 0,
        discovered_at: originalDiscoveredAt,
        last_modified_at: originalDiscoveredAt,
        last_modified_by: "external",
        deleted_at: null,
        workspace_id: "00000000-0000-0000-0000-000000000001",
        author_id: "00000000-0000-0000-0000-000000000001",
        visibility: "private",
        created_at: originalDiscoveredAt,
        updated_at: originalDiscoveredAt,
      };

      // Pass empty projects list — simulates user launching with no tracked projects.
      const { db, hookRows } = makeFakeDb([projectHook], []);
      await runHookDiscovery(db);

      // User-scope hook must be upserted.
      const userRows = hookRows.filter((r) => r.scope === "user" && r.deleted_at === null);
      expect(userRows).toHaveLength(1);
      expect(userRows[0].command).toBe("echo user-only");

      // Project-scope row must be completely untouched.
      const projectRows = hookRows.filter((r) => r.scope === `project:${projectId}`);
      expect(projectRows).toHaveLength(1);
      expect(projectRows[0].deleted_at).toBeNull(); // not soft-deleted
      expect(projectRows[0].discovered_at).toBe(originalDiscoveredAt); // unchanged
    });
  });

  // -------------------------------------------------------------------------
  // Large file: >100 KB — logs but still parses
  // -------------------------------------------------------------------------

  describe("large settings.json", () => {
    it("still parses and upserts hooks for a settings.json > 100 KB", async () => {
      const claudeDir = join(tmpDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });

      // Build a settings.json just over 100 KB by padding the hooks command.
      const paddedCommand = "echo " + "x".repeat(110_000);
      writeFileSync(
        join(claudeDir, "settings.json"),
        makeSettingsJson({ Stop: [hookEntry(paddedCommand)] }),
      );

      const { db, hookRows } = makeFakeDb();
      await runHookDiscovery(db);

      const active = hookRows.filter((r) => r.deleted_at === null);
      expect(active).toHaveLength(1);
      expect(active[0].command).toBe(paddedCommand);
    });
  });
});
