// @vitest-environment node
/**
 * Tests for the cold-launch asset scanner (Story 3.3).
 *
 * Vitest runs on Node, not Bun, so `bun:sqlite` is unavailable — we use a
 * structural fake Database (same pattern as db/__tests__/runner.test.ts).
 * The fake captures every INSERT and makes its parameters available for
 * assertions, giving us full coverage of enumeration logic, body_excerpt
 * extraction, FR-068 defaults, and the AssetIndexHydratedEvent emission
 * without requiring a real SQLite runtime.
 *
 * Real tmpdir fixtures are used for the filesystem layer — no mocks on
 * readdir/stat/readFile.
 *
 * No ~/.claude/ paths are touched; all fixtures live under os.tmpdir().
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database, Statement } from "bun:sqlite";
import { runColdLaunchScan, subscribeToScannerEvents } from "../scanner";
import type { WatcherEvent } from "@zoeplane/shared-types";
import { ASSET_INDEX_HYDRATED, type AssetIndexHydratedEvent } from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// Fake Database — structural fake covering the surface scanner.ts touches
// ---------------------------------------------------------------------------

/** Row params captured by the fake statement's .run() calls */
interface CapturedRow {
  $id: string;
  $workspace_id: string;
  $author_id: string;
  $visibility: string;
  $created_at: number;
  $updated_at: number;
  $deleted_at: null;
  $kind: string;
  $name: string;
  $scope: string;
  $project_id: string | null;
  $source_path: string;
  $validation_status: string;
  $shadowed_by_project_id: null;
  $last_modified_by: string;
  $last_modified_at: number;
  $front_matter_json: null;
  $body_excerpt: string;
}

interface FakeDbResult {
  db: Database;
  rows: CapturedRow[];
  projectQueryRows: Array<{ id: string; path: string }>;
}

function makeFakeDb(projectRows: Array<{ id: string; path: string }> = []): FakeDbResult {
  const rows: CapturedRow[] = [];

  // The fake Statement captures every .run() call.
  const fakeStatement: Statement = {
    run(params: unknown): unknown {
      rows.push(params as CapturedRow);
      return { changes: 1, lastInsertRowid: 0 };
    },
    get: () => null,
    all: () => [],
    values: () => [],
    finalize: () => undefined,
    toString: () => "fake-stmt",
  } as unknown as Statement;

  const db = {
    prepare(_sql: string): Statement {
      return fakeStatement;
    },
    query<T, _P>(_sql: string): { all(): T[] } {
      return {
        all: () => projectRows as unknown as T[],
      };
    },
    transaction<T extends (...args: unknown[]) => unknown>(fn: T): T {
      // Execute the function immediately (no real transaction needed in fake).
      return ((...args: unknown[]) => fn(...args)) as unknown as T;
    },
    exec(_sql: string): void {
      /* no-op */
    },
  } as unknown as Database;

  return { db, rows, projectQueryRows: projectRows };
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Create a skill directory: <root>/skills/<name>/SKILL.md */
function mkSkill(root: string, name: string, content = `# ${name}\nBody text.`): string {
  const dir = join(root, "skills", name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "SKILL.md");
  writeFileSync(file, content);
  return file;
}

/** Create an agent file: <root>/agents/<name>.md */
function mkAgent(root: string, name: string, content = `# ${name}\nAgent body.`): string {
  mkdirSync(join(root, "agents"), { recursive: true });
  const file = join(root, "agents", `${name}.md`);
  writeFileSync(file, content);
  return file;
}

/** Create a command file: <root>/commands/<name>.md */
function mkCommand(root: string, name: string, content = `# ${name}\nCommand body.`): string {
  mkdirSync(join(root, "commands"), { recursive: true });
  const file = join(root, "commands", `${name}.md`);
  writeFileSync(file, content);
  return file;
}

/** Create a nested command file: <root>/commands/<subdir>/<name>.md */
function mkNestedCommand(
  root: string,
  subdir: string,
  name: string,
  content = `# ${name}`,
): string {
  const dir = join(root, "commands", subdir);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.md`);
  writeFileSync(file, content);
  return file;
}

// ---------------------------------------------------------------------------
// Test fixture state
// ---------------------------------------------------------------------------

let tmpRoot: string;
/** Fake home dir — overrides HOME (POSIX) and USERPROFILE (Windows) so
 *  os.homedir() returns tmpRoot on every host. Node's os.homedir() reads
 *  USERPROFILE on Windows (not HOME), so POSIX-only override silently fails
 *  the scanner walk on Windows CI — it ends up scanning the real user's
 *  ~/.claude (which doesn't exist on the CI runner) and returns zero rows. */
let claudeDir: string;
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "zp-scanner-test-"));
  claudeDir = join(tmpRoot, ".claude");
  mkdirSync(claudeDir, { recursive: true });
  process.env.HOME = tmpRoot;
  process.env.USERPROFILE = tmpRoot;
});

afterEach(() => {
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;
  rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return all captured rows of a given kind. */
function ofKind(rows: CapturedRow[], kind: string): CapturedRow[] {
  return rows.filter((r) => r.$kind === kind);
}

// ---------------------------------------------------------------------------
// AC-1 / AC-2: Global skill, agent, command enumeration
// ---------------------------------------------------------------------------

describe("runColdLaunchScan — global roots", () => {
  it("inserts a row for each subdir/SKILL.md under skills/", async () => {
    mkSkill(claudeDir, "my-skill");
    mkSkill(claudeDir, "another-skill");

    const { db, rows } = makeFakeDb();
    const totals = await runColdLaunchScan(db);

    expect(totals.skills).toBe(2);
    const skillRows = ofKind(rows, "skill");
    expect(skillRows).toHaveLength(2);
    const names = skillRows.map((r) => r.$name).sort();
    expect(names).toEqual(["another-skill", "my-skill"]);
  });

  it("inserts a row for each direct .md file in agents/", async () => {
    mkAgent(claudeDir, "architect");
    mkAgent(claudeDir, "code-reviewer");

    const { db, rows } = makeFakeDb();
    const totals = await runColdLaunchScan(db);

    expect(totals.agents).toBe(2);
    const agentRows = ofKind(rows, "agent");
    expect(agentRows).toHaveLength(2);
    const names = agentRows.map((r) => r.$name).sort();
    expect(names).toEqual(["architect", "code-reviewer"]);
  });

  it("inserts rows for direct .md files and nested .md files in commands/", async () => {
    mkCommand(claudeDir, "code-audit");
    mkNestedCommand(claudeDir, "consider", "first-principles");
    mkNestedCommand(claudeDir, "consider", "inversion");

    const { db, rows } = makeFakeDb();
    const totals = await runColdLaunchScan(db);

    expect(totals.commands).toBe(3);
    const cmdRows = ofKind(rows, "command");
    const names = cmdRows.map((r) => r.$name).sort();
    expect(names).toEqual(["code-audit", "consider/first-principles", "consider/inversion"]);
  });

  it("sets scope=global, project_id=NULL for all global rows", async () => {
    mkSkill(claudeDir, "test-skill");
    mkAgent(claudeDir, "test-agent");

    const { db, rows } = makeFakeDb();
    await runColdLaunchScan(db);

    for (const row of rows) {
      expect(row.$scope).toBe("global");
      expect(row.$project_id).toBeNull();
    }
  });

  it("sets FR-068 defaults: workspace_id, author_id, visibility", async () => {
    mkSkill(claudeDir, "skill-a");

    const { db, rows } = makeFakeDb();
    await runColdLaunchScan(db);

    const [row] = rows;
    expect(row.$workspace_id).toBe("00000000-0000-0000-0000-000000000001");
    expect(row.$author_id).toBe("00000000-0000-0000-0000-000000000001");
    expect(row.$visibility).toBe("private");
  });

  it("sets validation_status=valid, last_modified_by=external, shadowed_by_project_id=NULL", async () => {
    mkSkill(claudeDir, "skill-b");

    const { db, rows } = makeFakeDb();
    await runColdLaunchScan(db);

    const [row] = rows;
    expect(row.$validation_status).toBe("valid");
    expect(row.$last_modified_by).toBe("external");
    expect(row.$shadowed_by_project_id).toBeNull();
    expect(row.$front_matter_json).toBeNull();
  });

  it("records last_modified_at as the file mtime in epoch ms (integer, > 0)", async () => {
    const before = Date.now();
    mkSkill(claudeDir, "skill-mtime");

    const { db, rows } = makeFakeDb();
    await runColdLaunchScan(db);

    const [row] = rows;
    expect(typeof row.$last_modified_at).toBe("number");
    expect(row.$last_modified_at).toBeGreaterThan(0);
    expect(row.$last_modified_at).toBeGreaterThanOrEqual(before - 1000);
  });

  it("assigns a UUID v4 id to each row", async () => {
    mkSkill(claudeDir, "skill-uuid");

    const { db, rows } = makeFakeDb();
    await runColdLaunchScan(db);

    const [row] = rows;
    expect(typeof row.$id).toBe("string");
    // UUID v4 pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(row.$id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("records source_path as the absolute path to the canonical file", async () => {
    const expectedPath = mkSkill(claudeDir, "path-skill");

    const { db, rows } = makeFakeDb();
    await runColdLaunchScan(db);

    const [row] = rows;
    expect(row.$source_path).toBe(expectedPath);
  });
});

// ---------------------------------------------------------------------------
// AC-5: body_excerpt — first 500 chars, front-matter stripped
// ---------------------------------------------------------------------------

describe("runColdLaunchScan — body_excerpt (AC-5)", () => {
  it("strips YAML front-matter and keeps the body", async () => {
    const content = `---\ntitle: My Skill\nversion: 1.0\n---\n# My Skill\n\nThis is the body.`;
    mkSkill(claudeDir, "fm-skill", content);

    const { db, rows } = makeFakeDb();
    await runColdLaunchScan(db);

    const [row] = rows;
    expect(row.$body_excerpt).toContain("# My Skill");
    expect(row.$body_excerpt).not.toContain("title: My Skill");
    expect(row.$body_excerpt).not.toContain("---");
  });

  it("returns full content when no front-matter is present", async () => {
    const content = "# No Front Matter\n\nJust body content here.";
    mkSkill(claudeDir, "no-fm-skill", content);

    const { db, rows } = makeFakeDb();
    await runColdLaunchScan(db);

    const [row] = rows;
    expect(row.$body_excerpt).toContain("# No Front Matter");
  });

  it("truncates body_excerpt to exactly 500 characters", async () => {
    const body = "A".repeat(600);
    mkSkill(claudeDir, "long-skill", body);

    const { db, rows } = makeFakeDb();
    await runColdLaunchScan(db);

    const [row] = rows;
    expect(row.$body_excerpt.length).toBe(500);
    expect(row.$body_excerpt).toBe("A".repeat(500));
  });

  it("does not exceed 500 chars after front-matter is stripped from a long file", async () => {
    const fm = `---\ntitle: Test\n---\n`;
    const body = "B".repeat(600);
    mkSkill(claudeDir, "long-fm-skill", fm + body);

    const { db, rows } = makeFakeDb();
    await runColdLaunchScan(db);

    const [row] = rows;
    expect(row.$body_excerpt.length).toBeLessThanOrEqual(500);
  });
});

// ---------------------------------------------------------------------------
// AC-7: Skip subdir with missing canonical file — no row, no error
// ---------------------------------------------------------------------------

describe("runColdLaunchScan — missing canonical file (AC-7)", () => {
  it("skips a skills/ subdirectory that has no SKILL.md, inserts valid skill only", async () => {
    // Incomplete subdir — no SKILL.md
    mkdirSync(join(claudeDir, "skills", "incomplete-skill"), { recursive: true });
    // Valid skill
    mkSkill(claudeDir, "valid-skill");

    const { db, rows } = makeFakeDb();
    const totals = await runColdLaunchScan(db);

    expect(totals.skills).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].$name).toBe("valid-skill");
  });
});

// ---------------------------------------------------------------------------
// AC-9: Missing kind directory — skip without error
// ---------------------------------------------------------------------------

describe("runColdLaunchScan — missing kind directory (AC-9)", () => {
  it("returns zero for all kinds when no kind dirs exist", async () => {
    // claudeDir is empty — no kind subdirs
    const { db, rows } = makeFakeDb();
    const totals = await runColdLaunchScan(db);

    expect(totals.skills).toBe(0);
    expect(totals.agents).toBe(0);
    expect(totals.commands).toBe(0);
    expect(totals.teams).toBe(0);
    expect(totals.workflows).toBe(0);
    expect(totals.projectScopedCount).toBe(0);
    expect(rows).toHaveLength(0);
  });

  it("counts correct totals for present kinds when some kind dirs are absent", async () => {
    // Only skills dir exists
    mkSkill(claudeDir, "only-skill");

    const { db, rows } = makeFakeDb();
    const totals = await runColdLaunchScan(db);

    expect(totals.skills).toBe(1);
    expect(totals.agents).toBe(0);
    expect(totals.commands).toBe(0);
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC-4: AssetIndexHydratedEvent emitted after scan completes
// ---------------------------------------------------------------------------

describe("runColdLaunchScan — AssetIndexHydratedEvent (AC-4)", () => {
  it("emits a single AssetIndexHydratedEvent with correct totals", async () => {
    mkSkill(claudeDir, "skill-1");
    mkSkill(claudeDir, "skill-2");
    mkAgent(claudeDir, "agent-1");

    const hydratedEvents: AssetIndexHydratedEvent[] = [];
    const unsub = subscribeToScannerEvents((e: WatcherEvent) => {
      if (e.type === ASSET_INDEX_HYDRATED) {
        hydratedEvents.push(e as AssetIndexHydratedEvent);
      }
    });

    const { db } = makeFakeDb();
    await runColdLaunchScan(db);
    unsub();

    expect(hydratedEvents).toHaveLength(1);
    const evt = hydratedEvents[0];
    expect(evt.type).toBe(ASSET_INDEX_HYDRATED);
    expect(evt.skills).toBe(2);
    expect(evt.agents).toBe(1);
    expect(evt.commands).toBe(0);
    expect(evt.teams).toBe(0);
    expect(evt.workflows).toBe(0);
    expect(evt.projectScopedCount).toBe(0);
    expect(typeof evt.elapsedMs).toBe("number");
    expect(evt.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("includes elapsedMs in totals returned by runColdLaunchScan", async () => {
    const { db } = makeFakeDb();
    const totals = await runColdLaunchScan(db);
    expect(typeof totals.elapsedMs).toBe("number");
    expect(totals.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// AC-3: Project-scoped scan — rows driven by projects table
// ---------------------------------------------------------------------------

describe("runColdLaunchScan — project-scoped rows (AC-3)", () => {
  it("inserts project-scoped rows for skills in a tracked project", async () => {
    const projectId = "proj-uuid-1";
    const projectPath = join(tmpRoot, "my-project");
    const projectClaudeDir = join(projectPath, ".claude");

    // Create a project-scoped skill
    mkSkill(projectClaudeDir, "project-skill");
    // Also a global skill
    mkSkill(claudeDir, "global-skill");

    const { db, rows } = makeFakeDb([{ id: projectId, path: projectPath }]);
    const totals = await runColdLaunchScan(db);

    expect(totals.skills).toBe(1); // global only
    expect(totals.projectScopedCount).toBe(1);

    const projectRows = rows.filter((r) => r.$scope === "project");
    expect(projectRows).toHaveLength(1);
    expect(projectRows[0].$project_id).toBe(projectId);
    expect(projectRows[0].$kind).toBe("skill");
    expect(projectRows[0].$name).toBe("project-skill");

    const globalRows = rows.filter((r) => r.$scope === "global");
    expect(globalRows).toHaveLength(1);
    expect(globalRows[0].$name).toBe("global-skill");
  });

  it("returns 0 project rows when projects table is empty", async () => {
    mkSkill(claudeDir, "global-only");

    const { db } = makeFakeDb([]); // empty projects
    const totals = await runColdLaunchScan(db);

    expect(totals.projectScopedCount).toBe(0);
    expect(totals.skills).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Symlinked kind directories
// ---------------------------------------------------------------------------

describe("runColdLaunchScan — symlinked kind directories", () => {
  it("enumerates skills under a symlinked skills/ directory", async () => {
    // Real target directory for skills
    const realSkillsDir = join(tmpRoot, "real-skills");
    mkdirSync(join(realSkillsDir, "symlinked-skill"), { recursive: true });
    writeFileSync(join(realSkillsDir, "symlinked-skill", "SKILL.md"), "# Sym skill");

    // Symlink ~/.claude/skills → real-skills
    symlinkSync(realSkillsDir, join(claudeDir, "skills"));

    const { db, rows } = makeFakeDb();
    const totals = await runColdLaunchScan(db);

    expect(totals.skills).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].$name).toBe("symlinked-skill");
  });
});

// ---------------------------------------------------------------------------
// HIGH-2a: Depth-guard — files two levels deep must NOT be indexed
// ---------------------------------------------------------------------------

describe("runColdLaunchScan — depth guard for direct-md (commands)", () => {
  it("does NOT index a .md file two levels deep under commands/", async () => {
    // Depth 0: commands/code-audit.md — should be indexed
    mkCommand(claudeDir, "code-audit");
    // Depth 1: commands/consider/first-principles.md — should be indexed
    mkNestedCommand(claudeDir, "consider", "first-principles");
    // Depth 2: commands/consider/subgroup/deep.md — must NOT be indexed
    const deepDir = join(claudeDir, "commands", "consider", "subgroup");
    mkdirSync(deepDir, { recursive: true });
    writeFileSync(join(deepDir, "deep.md"), "# Deep command");

    const { db, rows } = makeFakeDb();
    const totals = await runColdLaunchScan(db);

    // Only depth-0 and depth-1 files are indexed; depth-2 is silently ignored.
    expect(totals.commands).toBe(2);
    const cmdRows = ofKind(rows, "command");
    const names = cmdRows.map((r) => r.$name).sort();
    expect(names).toEqual(["code-audit", "consider/first-principles"]);
    // Confirm the deep file is absent — no row should reference it.
    const hasDeep = cmdRows.some((r) => r.$name.includes("deep"));
    expect(hasDeep).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// HIGH-2b: direct-md permission-denied — WARN + skip, no panic
// ---------------------------------------------------------------------------

describe("runColdLaunchScan — permission-denied on direct-md file", () => {
  it("skips an unreadable agent .md file and produces zero rows for it", async () => {
    // Create a valid agent file alongside a restricted one.
    mkAgent(claudeDir, "readable-agent");
    const restrictedPath = join(claudeDir, "agents", "restricted.md");
    writeFileSync(restrictedPath, "# Restricted agent");
    chmodSync(restrictedPath, 0o000); // no read permission

    const { db, rows } = makeFakeDb();
    let totals: Awaited<ReturnType<typeof runColdLaunchScan>>;
    try {
      totals = await runColdLaunchScan(db);
    } finally {
      // Restore permissions so afterEach rmSync can clean up.
      chmodSync(restrictedPath, 0o644);
    }

    // The scanner must not throw — it logs WARN and continues.
    // Only the readable agent should produce a row.
    const agentRows = ofKind(rows, "agent");
    expect(agentRows.some((r) => r.$name === "readable-agent")).toBe(true);
    expect(agentRows.some((r) => r.$name === "restricted")).toBe(false);
    // totals.agents reflects only successfully-read files.
    expect(totals!.agents).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Idempotency — INSERT OR IGNORE means re-running the fake doesn't error
// ---------------------------------------------------------------------------

describe("runColdLaunchScan — idempotency", () => {
  it("calls INSERT for each row on every scan run (IGNORE on conflict is DB-layer, not scanner)", async () => {
    // The scanner always generates INSERT calls; the DB layer (ON CONFLICT DO NOTHING)
    // handles dedup. The fake doesn't enforce the unique constraint, so both runs
    // will produce rows — this confirms the scanner doesn't implement its own
    // dedup guard that would skip inserts on re-launch.
    mkSkill(claudeDir, "idempotent-skill");

    const { db, rows } = makeFakeDb();
    await runColdLaunchScan(db);
    await runColdLaunchScan(db);

    // 2 runs × 1 skill = 2 captured rows in the fake (real DB would IGNORE the second)
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.$name === "idempotent-skill")).toBe(true);
  });
});
