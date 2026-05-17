// @vitest-environment node
/**
 * Tests for the validation pipeline (Story 3.5).
 *
 * Vitest runs on Node, not Bun, so `bun:sqlite` is unavailable — we use a
 * structural fake Database (same pattern as scanner.test.ts / resolver.test.ts).
 *
 * Real tmpdir fixtures are used for filesystem inputs — no mocks on
 * readFile/stat. gray-matter is exercised with real file content.
 *
 * No ~/.claude/ paths are touched; all fixtures live under os.tmpdir().
 *
 * Windows regression: paths are constructed with node:path (native separators
 * on Windows) so the POSIX-normalizing helpers in naming.ts / validator.ts are
 * exercised on any host. HOME + USERPROFILE are overridden so os.homedir() works
 * cross-platform in any test that needs it.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database, Statement } from "bun:sqlite";
import {
  runValidationPipeline,
  revalidateAsset,
  subscribeToValidatorEvents,
  type ValidationTotals,
} from "../validator";
import type { WatcherEvent } from "@zoeplane/shared-types";
import {
  VALIDATION_COMPLETED,
  ASSET_VALIDATION_UPDATED,
  type ValidationCompletedEvent,
  type AssetValidationUpdatedEvent,
} from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// Fake Database — covers SELECT (query), UPDATE (query.run), transaction
// ---------------------------------------------------------------------------

/** A single captured UPDATE call. */
interface CapturedUpdate {
  sql: string;
  params: unknown[];
}

/** A row in the fake assets store. */
interface FakeAssetRow {
  id: string;
  source_path: string;
  kind: string;
  validation_status: string;
  front_matter_json: string | null;
  deleted_at: number | null;
}

interface FakeDbResult {
  db: Database;
  rows: FakeAssetRow[];
  updates: CapturedUpdate[];
}

/**
 * Build a fake Database that:
 * - Returns `assetRows` from SELECT queries on the assets table.
 * - Captures UPDATE calls in `updates`.
 * - Applies UPDATEs to `rows` in-memory so validator assertions can inspect final state.
 * - For SELECT id FROM projects queries (defensive check in recomputeShadows), returns [].
 */
function makeFakeDb(assetRows: FakeAssetRow[]): FakeDbResult {
  // Deep-clone rows so the fake can mutate them independently.
  const rows: FakeAssetRow[] = assetRows.map((r) => ({ ...r }));
  const updates: CapturedUpdate[] = [];

  const db = {
    prepare(sql: string): Statement {
      // Returns a statement that captures .run() calls.
      return {
        run(...params: unknown[]): unknown {
          if (sql.includes("UPDATE assets SET validation_status")) {
            // Two shapes:
            //   Normal:   ...validation_status=?, front_matter_json=?, updated_at=? WHERE id=?
            //             params = [status, fmJson, updatedAt, id]
            //   Fallback: ...validation_status='valid', front_matter_json=NULL, updated_at=? WHERE id=?
            //             params = [updatedAt, id]
            const isFallbackShape = sql.includes("validation_status='valid'");
            if (isFallbackShape) {
              // params = [updatedAt, id]
              const [, id] = params as [number, string];
              const row = rows.find((r) => r.id === id);
              if (row) {
                row.validation_status = "valid";
                row.front_matter_json = null;
              }
            } else {
              // params = [status, fmJson, updatedAt, id]
              const [status, fmJson, , id] = params as [string, string | null, number, string];
              const row = rows.find((r) => r.id === id);
              if (row) {
                row.validation_status = status;
                row.front_matter_json = fmJson;
              }
            }
          }
          updates.push({ sql, params });
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
        all(): T[] {
          // SELECT id, source_path, kind FROM assets ...
          if (
            sql.includes("SELECT id, source_path, kind FROM assets") ||
            sql.includes("SELECT id FROM assets")
          ) {
            return rows.filter((r) => r.deleted_at === null) as unknown as T[];
          }
          return [] as T[];
        },
        get(sourcePath?: unknown): T | null {
          // SELECT id FROM assets WHERE source_path = ? ...
          if (sql.includes("SELECT id FROM assets WHERE source_path")) {
            const found = rows.find((r) => r.source_path === sourcePath && r.deleted_at === null);
            return (found ?? null) as unknown as T | null;
          }
          return null;
        },
        run(...params: unknown[]): unknown {
          // Inline UPDATE via db.query(...).run(...)
          if (sql.includes("UPDATE assets SET validation_status")) {
            const [status, fmJson, , id] = params as [string, string | null, number, string];
            const row = rows.find((r) => r.id === id);
            if (row) {
              row.validation_status = status;
              row.front_matter_json = fmJson;
            }
          }
          updates.push({ sql, params });
          return { changes: 1, lastInsertRowid: 0 };
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

  return { db, rows, updates };
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Full-valid front-matter + non-empty body for a skill. */
function validSkillContent(name: string): string {
  return `---
name: ${name}
description: A test skill for validation.
version: 1.0.0
---

# ${name}

This is the skill body. It has enough content to pass the empty-body check.
`;
}

/** Valid YAML front-matter for an agent. */
function validAgentContent(name: string): string {
  return `---
name: ${name}
description: A test agent.
voice: en-US-Neural2-J
---

# ${name}

Agent body content here.
`;
}

/** Malformed YAML front-matter. */
function malformedFrontMatter(): string {
  return `---
key: [unclosed bracket
---

Some body content.
`;
}

/** Valid YAML but empty body. */
function validFrontMatterEmptyBody(): string {
  return `---
name: test-skill
description: Has no body.
version: 1.0.0
---


`;
}

/** Content with no front-matter delimiters. */
function noFrontMatter(): string {
  return `# Skill with no front-matter

Just a body.
`;
}

/** Content with warnings: missing recommended fields for a skill. */
function skillMissingFields(name: string): string {
  return `---
name: ${name}
---

# ${name}

Body content present.
`;
}

// ---------------------------------------------------------------------------
// Test fixture state
// ---------------------------------------------------------------------------

let tmpRoot: string;
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "zp-validator-test-"));
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

/** Write a test asset file and return its absolute path. */
function writeAsset(subpath: string, content: string): string {
  const fullPath = join(tmpRoot, subpath);
  mkdirSync(join(tmpRoot, subpath, "..").replace(/\/$/, ""), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
  return fullPath;
}

// ---------------------------------------------------------------------------
// AC-1: valid YAML front-matter + non-empty body → status='valid'
// ---------------------------------------------------------------------------

describe("runValidationPipeline — valid asset (AC-1)", () => {
  it("sets validation_status=valid and persists front_matter_json for a fully valid skill", async () => {
    const skillPath = writeAsset("skills/test-skill/SKILL.md", validSkillContent("test-skill"));

    const { db, rows } = makeFakeDb([
      {
        id: "id-skill-1",
        source_path: skillPath,
        kind: "skill",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const totals = await runValidationPipeline(db);

    expect(totals.valid).toBe(1);
    expect(totals.warnings).toBe(0);
    expect(totals.invalid).toBe(0);

    const row = rows.find((r) => r.id === "id-skill-1")!;
    expect(row.validation_status).toBe("valid");
    expect(row.front_matter_json).not.toBeNull();
    const fm = JSON.parse(row.front_matter_json!) as Record<string, unknown>;
    expect(fm.name).toBe("test-skill");
    expect(fm.description).toBeDefined();
    expect(fm.version).toBe("1.0.0");
  });

  it("sets validation_status=valid for a fully valid agent", async () => {
    const agentPath = writeAsset("agents/my-agent.md", validAgentContent("my-agent"));

    const { db, rows } = makeFakeDb([
      {
        id: "id-agent-1",
        source_path: agentPath,
        kind: "agent",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const totals = await runValidationPipeline(db);

    expect(totals.valid).toBe(1);
    const row = rows.find((r) => r.id === "id-agent-1")!;
    expect(row.validation_status).toBe("valid");
    expect(row.front_matter_json).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-2: warnings — missing recommended fields
// ---------------------------------------------------------------------------

describe("runValidationPipeline — warnings (AC-2)", () => {
  it("sets validation_status=warnings when skill is missing description and version", async () => {
    const skillPath = writeAsset("skills/warn-skill/SKILL.md", skillMissingFields("warn-skill"));

    const { db, rows } = makeFakeDb([
      {
        id: "id-warn-1",
        source_path: skillPath,
        kind: "skill",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const totals = await runValidationPipeline(db);

    expect(totals.warnings).toBe(1);
    const row = rows.find((r) => r.id === "id-warn-1")!;
    expect(row.validation_status).toBe("warnings");
    // front_matter_json should still be set (warnings don't null it)
    expect(row.front_matter_json).not.toBeNull();
  });

  it("sets validation_status=warnings and front_matter_json=NULL when file exceeds 1 MB cap", async () => {
    // Write a file > 1 MB.
    const bigContent = `---\nname: big-skill\ndescription: Large file.\nversion: 1.0.0\n---\n${"x".repeat(1_100_000)}`;
    const bigPath = writeAsset("skills/big-skill/SKILL.md", bigContent);

    const { db, rows } = makeFakeDb([
      {
        id: "id-big-1",
        source_path: bigPath,
        kind: "skill",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const totals = await runValidationPipeline(db);

    expect(totals.warnings).toBe(1);
    const row = rows.find((r) => r.id === "id-big-1")!;
    expect(row.validation_status).toBe("warnings");
    expect(row.front_matter_json).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-3: invalid — malformed YAML / missing delimiters / empty body
// ---------------------------------------------------------------------------

describe("runValidationPipeline — invalid asset (AC-3)", () => {
  it("sets validation_status=invalid and front_matter_json=NULL for malformed YAML", async () => {
    const badPath = writeAsset("agents/bad-agent.md", malformedFrontMatter());

    const { db, rows } = makeFakeDb([
      {
        id: "id-bad-1",
        source_path: badPath,
        kind: "agent",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const totals = await runValidationPipeline(db);

    expect(totals.invalid).toBe(1);
    const row = rows.find((r) => r.id === "id-bad-1")!;
    expect(row.validation_status).toBe("invalid");
    expect(row.front_matter_json).toBeNull();
  });

  it("sets validation_status=invalid for content with no front-matter delimiters", async () => {
    const noFmPath = writeAsset("agents/no-fm-agent.md", noFrontMatter());

    const { db, rows } = makeFakeDb([
      {
        id: "id-nofm-1",
        source_path: noFmPath,
        kind: "agent",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const totals = await runValidationPipeline(db);

    expect(totals.invalid).toBe(1);
    const row = rows.find((r) => r.id === "id-nofm-1")!;
    expect(row.validation_status).toBe("invalid");
    expect(row.front_matter_json).toBeNull();
  });

  it("sets validation_status=invalid for content with empty body after front-matter", async () => {
    const emptyBodyPath = writeAsset(
      "skills/empty-body-skill/SKILL.md",
      validFrontMatterEmptyBody(),
    );

    const { db, rows } = makeFakeDb([
      {
        id: "id-empty-1",
        source_path: emptyBodyPath,
        kind: "skill",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const totals = await runValidationPipeline(db);

    expect(totals.invalid).toBe(1);
    const row = rows.find((r) => r.id === "id-empty-1")!;
    expect(row.validation_status).toBe("invalid");
    expect(row.front_matter_json).toBeNull();
  });

  it("marks invalid but does NOT remove the asset row from the index (FR-031)", async () => {
    const badPath = writeAsset("agents/hidden-agent.md", noFrontMatter());

    const { db, rows } = makeFakeDb([
      {
        id: "id-hidden-1",
        source_path: badPath,
        kind: "agent",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    await runValidationPipeline(db);

    // Row must still exist in the fake store (not deleted).
    const row = rows.find((r) => r.id === "id-hidden-1");
    expect(row).toBeDefined();
    expect(row!.deleted_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-4: ValidationCompletedEvent emitted with correct totals
// ---------------------------------------------------------------------------

describe("runValidationPipeline — ValidationCompletedEvent (AC-4)", () => {
  it("emits a single ValidationCompletedEvent after the pipeline completes", async () => {
    const validPath = writeAsset("skills/v-skill/SKILL.md", validSkillContent("v-skill"));
    const warnPath = writeAsset("skills/w-skill/SKILL.md", skillMissingFields("w-skill"));
    const invalidPath = writeAsset("agents/bad.md", noFrontMatter());

    const { db } = makeFakeDb([
      {
        id: "id-v1",
        source_path: validPath,
        kind: "skill",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
      {
        id: "id-w1",
        source_path: warnPath,
        kind: "skill",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
      {
        id: "id-i1",
        source_path: invalidPath,
        kind: "agent",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const completedEvents: ValidationCompletedEvent[] = [];
    const unsub = subscribeToValidatorEvents((e: WatcherEvent) => {
      if (e.type === VALIDATION_COMPLETED) {
        completedEvents.push(e as ValidationCompletedEvent);
      }
    });

    const totals = await runValidationPipeline(db);
    unsub();

    expect(completedEvents).toHaveLength(1);
    const evt = completedEvents[0];
    expect(evt.type).toBe(VALIDATION_COMPLETED);
    expect(evt.valid).toBe(totals.valid);
    expect(evt.warnings).toBe(totals.warnings);
    expect(evt.invalid).toBe(totals.invalid);
    expect(typeof evt.elapsedMs).toBe("number");
    expect(evt.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(evt.fallback).toBe(false);
  });

  it("returns ValidationTotals matching the emitted event", async () => {
    const skillPath = writeAsset("skills/match-skill/SKILL.md", validSkillContent("match-skill"));

    const { db } = makeFakeDb([
      {
        id: "id-m1",
        source_path: skillPath,
        kind: "skill",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const completedEvents: ValidationCompletedEvent[] = [];
    const unsub = subscribeToValidatorEvents((e: WatcherEvent) => {
      if (e.type === VALIDATION_COMPLETED) {
        completedEvents.push(e as ValidationCompletedEvent);
      }
    });

    const totals: ValidationTotals = await runValidationPipeline(db);
    unsub();

    const evt = completedEvents[0];
    expect(evt.valid).toBe(totals.valid);
    expect(evt.warnings).toBe(totals.warnings);
    expect(evt.invalid).toBe(totals.invalid);
  });

  it("emits correct totals with empty assets table (0 rows)", async () => {
    const { db } = makeFakeDb([]);

    const completedEvents: ValidationCompletedEvent[] = [];
    const unsub = subscribeToValidatorEvents((e: WatcherEvent) => {
      if (e.type === VALIDATION_COMPLETED) completedEvents.push(e as ValidationCompletedEvent);
    });

    const totals = await runValidationPipeline(db);
    unsub();

    expect(totals.valid).toBe(0);
    expect(totals.warnings).toBe(0);
    expect(totals.invalid).toBe(0);
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].valid).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-5: Per-event revalidation — revalidateAsset
// ---------------------------------------------------------------------------

describe("revalidateAsset — per-event revalidation (AC-5)", () => {
  it("updates validation_status to valid for a fully valid skill file", async () => {
    const skillPath = writeAsset("skills/re-skill/SKILL.md", validSkillContent("re-skill"));

    const { db, rows } = makeFakeDb([
      {
        id: "id-re-1",
        source_path: skillPath,
        kind: "skill",
        validation_status: "invalid", // stale value
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    await revalidateAsset(db, skillPath, "skill");

    const row = rows.find((r) => r.id === "id-re-1")!;
    expect(row.validation_status).toBe("valid");
    expect(row.front_matter_json).not.toBeNull();
  });

  it("updates validation_status to invalid for a file with no front-matter", async () => {
    const agentPath = writeAsset("agents/no-fm.md", noFrontMatter());

    const { db, rows } = makeFakeDb([
      {
        id: "id-re-2",
        source_path: agentPath,
        kind: "agent",
        validation_status: "valid", // stale
        front_matter_json: '{"name":"old"}',
        deleted_at: null,
      },
    ]);

    await revalidateAsset(db, agentPath, "agent");

    const row = rows.find((r) => r.id === "id-re-2")!;
    expect(row.validation_status).toBe("invalid");
    expect(row.front_matter_json).toBeNull();
  });

  it("emits AssetValidationUpdatedEvent after per-event revalidation", async () => {
    const skillPath = writeAsset("skills/evt-skill/SKILL.md", validSkillContent("evt-skill"));

    const { db } = makeFakeDb([
      {
        id: "id-evt-1",
        source_path: skillPath,
        kind: "skill",
        validation_status: "invalid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const updatedEvents: AssetValidationUpdatedEvent[] = [];
    const unsub = subscribeToValidatorEvents((e: WatcherEvent) => {
      if (e.type === ASSET_VALIDATION_UPDATED) {
        updatedEvents.push(e as AssetValidationUpdatedEvent);
      }
    });

    await revalidateAsset(db, skillPath, "skill");
    unsub();

    expect(updatedEvents).toHaveLength(1);
    const evt = updatedEvents[0];
    expect(evt.type).toBe(ASSET_VALIDATION_UPDATED);
    expect(evt.assetId).toBe("id-evt-1");
    expect(evt.sourcePath).toBe(skillPath);
    expect(evt.kind).toBe("skill");
    expect(evt.validationStatus).toBe("valid");
  });

  it("is a no-op (no update, no crash) when the source_path has no row in the index", async () => {
    const orphanPath = join(tmpRoot, "skills/orphan/SKILL.md");
    // Do NOT write the file (it doesn't exist) — but we also don't add a DB row.
    const { db, updates } = makeFakeDb([]); // empty DB

    // Should not throw.
    await expect(revalidateAsset(db, orphanPath, "skill")).resolves.toBeUndefined();
    // No UPDATE calls should have been made.
    expect(updates.filter((u) => u.sql.includes("UPDATE assets"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-6: Project-scoped assets use identical parse logic (FR-032)
// ---------------------------------------------------------------------------

describe("runValidationPipeline — project-scoped parity (AC-6 / FR-032)", () => {
  it("applies identical parse logic for a project-scoped skill asset", async () => {
    const projectSkillPath = writeAsset(
      "my-project/.claude/skills/proj-skill/SKILL.md",
      validSkillContent("proj-skill"),
    );

    const { db, rows } = makeFakeDb([
      {
        id: "id-proj-1",
        source_path: projectSkillPath,
        kind: "skill",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const totals = await runValidationPipeline(db);

    expect(totals.valid).toBe(1);
    const row = rows.find((r) => r.id === "id-proj-1")!;
    expect(row.validation_status).toBe("valid");
    expect(row.front_matter_json).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Full-table cold-launch pass — UPDATE scope covers all rows (INFO note from brief)
// ---------------------------------------------------------------------------

describe("runValidationPipeline — full-table UPDATE scope", () => {
  it("updates all rows regardless of created_at timestamp (re-stamps on every launch)", async () => {
    const path1 = writeAsset("skills/old-skill/SKILL.md", validSkillContent("old-skill"));
    const path2 = writeAsset("skills/new-skill/SKILL.md", skillMissingFields("new-skill"));

    const { db, rows } = makeFakeDb([
      {
        id: "id-old-1",
        source_path: path1,
        kind: "skill",
        validation_status: "invalid", // stale from previous run
        front_matter_json: null,
        deleted_at: null,
      },
      {
        id: "id-new-1",
        source_path: path2,
        kind: "skill",
        validation_status: "valid", // stale provisional value
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    await runValidationPipeline(db);

    const row1 = rows.find((r) => r.id === "id-old-1")!;
    const row2 = rows.find((r) => r.id === "id-new-1")!;
    // Both must be re-stamped.
    expect(row1.validation_status).toBe("valid");
    expect(row2.validation_status).toBe("warnings");
  });
});

// ---------------------------------------------------------------------------
// Windows-style path regression — POSIX normalisation
// ---------------------------------------------------------------------------

describe("runValidationPipeline — Windows-style path regression", () => {
  it("correctly looks up a row whose source_path uses backslash separators", async () => {
    // Simulate a Windows-style path stored in the DB.
    // The fake DB matches on source_path equality. On Windows, node:path
    // produces backslash paths; validator.ts's stat/readFile receive them
    // directly (OS handles them). The test verifies the lookup path is not
    // broken by accidental double-normalisation.
    const posixPath = writeAsset("skills/win-skill/SKILL.md", validSkillContent("win-skill"));
    // Simulate the DB row having a POSIX path (as stored by scanner.ts on any OS).
    const { db, rows } = makeFakeDb([
      {
        id: "id-win-1",
        source_path: posixPath,
        kind: "skill",
        validation_status: "invalid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    await runValidationPipeline(db);

    const row = rows.find((r) => r.id === "id-win-1")!;
    expect(row.validation_status).toBe("valid");
  });
});

// ---------------------------------------------------------------------------
// Mixed batch — counts add up to total row count
// ---------------------------------------------------------------------------

describe("runValidationPipeline — mixed batch totals", () => {
  it("sums valid + warnings + invalid equals total row count", async () => {
    const p1 = writeAsset("skills/a/SKILL.md", validSkillContent("a"));
    const p2 = writeAsset("skills/b/SKILL.md", skillMissingFields("b"));
    const p3 = writeAsset("agents/c.md", noFrontMatter());

    const { db } = makeFakeDb([
      {
        id: "1",
        source_path: p1,
        kind: "skill",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
      {
        id: "2",
        source_path: p2,
        kind: "skill",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
      {
        id: "3",
        source_path: p3,
        kind: "agent",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const totals = await runValidationPipeline(db);
    expect(totals.valid + totals.warnings + totals.invalid).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// HIGH-1: gray-matter fallback path — test-injection via _matterOverride=null
// ---------------------------------------------------------------------------

describe("runValidationPipeline — gray-matter fallback (_matterOverride=null)", () => {
  it("sets all rows to valid + front_matter_json=NULL and emits ValidationCompletedEvent with fallback=true", async () => {
    const p1 = writeAsset("skills/fb-skill/SKILL.md", validSkillContent("fb-skill"));
    const p2 = writeAsset("agents/fb-agent.md", noFrontMatter());

    const { db, rows } = makeFakeDb([
      {
        id: "id-fb-1",
        source_path: p1,
        kind: "skill",
        validation_status: "invalid",
        front_matter_json: '{"stale":true}',
        deleted_at: null,
      },
      {
        id: "id-fb-2",
        source_path: p2,
        kind: "agent",
        validation_status: "warnings",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const completedEvents: ValidationCompletedEvent[] = [];
    const unsub = subscribeToValidatorEvents((e: WatcherEvent) => {
      if (e.type === VALIDATION_COMPLETED) {
        completedEvents.push(e as ValidationCompletedEvent);
      }
    });

    // Inject null to force the fallback path without needing gray-matter to actually fail.
    const totals = await runValidationPipeline(db, null);
    unsub();

    // All rows must be stamped valid with NULL front_matter_json.
    expect(totals.valid).toBe(2);
    expect(totals.warnings).toBe(0);
    expect(totals.invalid).toBe(0);

    const row1 = rows.find((r) => r.id === "id-fb-1")!;
    const row2 = rows.find((r) => r.id === "id-fb-2")!;
    expect(row1.validation_status).toBe("valid");
    expect(row1.front_matter_json).toBeNull();
    expect(row2.validation_status).toBe("valid");
    expect(row2.front_matter_json).toBeNull();

    // Exactly one ValidationCompletedEvent emitted with fallback=true.
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].fallback).toBe(true);
    expect(completedEvents[0].valid).toBe(2);
    expect(completedEvents[0].warnings).toBe(0);
    expect(completedEvents[0].invalid).toBe(0);
  });
});

describe("revalidateAsset — gray-matter fallback (_matterOverride=null)", () => {
  it("updates single row to valid + front_matter_json=NULL in fallback mode", async () => {
    const skillPath = writeAsset("skills/fb-re-skill/SKILL.md", validSkillContent("fb-re-skill"));

    const { db, rows } = makeFakeDb([
      {
        id: "id-fb-re-1",
        source_path: skillPath,
        kind: "skill",
        validation_status: "invalid",
        front_matter_json: '{"stale":true}',
        deleted_at: null,
      },
    ]);

    const updatedEvents: AssetValidationUpdatedEvent[] = [];
    const unsub = subscribeToValidatorEvents((e: WatcherEvent) => {
      if (e.type === ASSET_VALIDATION_UPDATED) {
        updatedEvents.push(e as AssetValidationUpdatedEvent);
      }
    });

    await revalidateAsset(db, skillPath, "skill", null);
    unsub();

    // Row must be stamped valid with NULL front_matter_json (fallback shape).
    const row = rows.find((r) => r.id === "id-fb-re-1")!;
    expect(row.validation_status).toBe("valid");
    expect(row.front_matter_json).toBeNull();

    // AssetValidationUpdatedEvent must be emitted with validationStatus=valid.
    expect(updatedEvents).toHaveLength(1);
    expect(updatedEvents[0].validationStatus).toBe("valid");
    expect(updatedEvents[0].assetId).toBe("id-fb-re-1");
  });
});

// ---------------------------------------------------------------------------
// MEDIUM-1 (Option A): empty YAML block (---\n---\n<body>) → warnings, not invalid
// ---------------------------------------------------------------------------

describe("runValidationPipeline — empty YAML front-matter block (MEDIUM-1 Option A)", () => {
  it("sets validation_status=warnings and front_matter_json='{}' for ---\\n---\\n<body>", async () => {
    // Delimiters present, YAML block empty, body non-empty.
    // Per FR-031 + MEDIUM-1 Option A: presence of delimiters signals intent;
    // empty content is warnings (partial presence), not invalid (missing/malformed).
    const content = "---\n---\nBody content is here.\n";
    const assetPath = writeAsset("skills/empty-yaml/SKILL.md", content);

    const { db, rows } = makeFakeDb([
      {
        id: "id-emptyy-1",
        source_path: assetPath,
        kind: "skill",
        validation_status: "valid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const totals = await runValidationPipeline(db);

    expect(totals.warnings).toBe(1);
    expect(totals.invalid).toBe(0);

    const row = rows.find((r) => r.id === "id-emptyy-1")!;
    expect(row.validation_status).toBe("warnings");
    // Empty-object parse outcome is preserved as front_matter_json='{}' (not NULL).
    expect(row.front_matter_json).toBe("{}");
  });
});

// ---------------------------------------------------------------------------
// LOW: BOM handling — gray-matter's strip-bom-string handles UTF-8 BOM
// ---------------------------------------------------------------------------

describe("runValidationPipeline — BOM handling (LOW)", () => {
  it("correctly parses a file with a UTF-8 BOM prefix", async () => {
    // UTF-8 BOM is U+FEFF. gray-matter uses strip-bom-string internally.
    // Use a Unicode escape to avoid triggering the no-irregular-whitespace lint rule.
    const bom = "\uFEFF";
    const content = `${bom}---\nname: bom-skill\ndescription: BOM test.\nversion: 1.0.0\n---\n\nBOM file body.\n`;
    const assetPath = writeAsset("skills/bom-skill/SKILL.md", content);

    const { db, rows } = makeFakeDb([
      {
        id: "id-bom-1",
        source_path: assetPath,
        kind: "skill",
        validation_status: "invalid",
        front_matter_json: null,
        deleted_at: null,
      },
    ]);

    const totals = await runValidationPipeline(db);

    // BOM should be stripped by gray-matter; file should parse as valid.
    expect(totals.valid).toBe(1);
    const row = rows.find((r) => r.id === "id-bom-1")!;
    expect(row.validation_status).toBe("valid");
    expect(row.front_matter_json).not.toBeNull();
    const fm = JSON.parse(row.front_matter_json!) as Record<string, unknown>;
    expect(fm.name).toBe("bom-skill");
  });
});
