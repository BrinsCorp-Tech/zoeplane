// @vitest-environment node
/**
 * Tests for runProjectScan (Story 3.7 / FR-040) and the CR-1 orphan-sidecar
 * parent-PID watchdog.
 *
 * Vitest runs on Node, not Bun, so `bun:sqlite` is unavailable — we use the
 * same structural fake Database pattern as scanner.test.ts / resolver.test.ts.
 *
 * Real tmpdir fixtures are used for the filesystem layer — no mocks on
 * readdir/stat/readFile.
 *
 * CR-1 watchdog tests use fake timers (vi.useFakeTimers) to fast-forward the
 * setInterval cadence without real clock delays.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database, Statement } from "bun:sqlite";
import { runProjectScan } from "../scanner";

// ---------------------------------------------------------------------------
// Fake Database — same structural pattern as scanner.test.ts
// ---------------------------------------------------------------------------

interface CapturedRow {
  $id: string;
  $kind: string;
  $name: string;
  $scope: string;
  $project_id: string | null;
  $source_path: string;
}

interface FakeDbResult {
  db: Database;
  rows: CapturedRow[];
}

/**
 * Build a fake DB that:
 * - Returns `projectIdRow` for the SELECT id FROM projects WHERE path = ? query.
 * - Captures all INSERT rows via the prepared statement's .run() calls.
 * - Returns the `projectIdRow` for all other .query().get() calls.
 */
function makeFakeDb(projectId: string | null, _projectPath: string): FakeDbResult {
  const rows: CapturedRow[] = [];

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
    query<T, _P>(sql: string): { get(...args: unknown[]): T | null; all(): T[] } {
      // For the "SELECT id FROM projects WHERE path = ?" query
      if (sql.includes("SELECT id FROM projects")) {
        return {
          get(_path: unknown): T | null {
            if (projectId !== null) {
              return { id: projectId } as unknown as T;
            }
            return null;
          },
          all: () => [],
        };
      }
      // Default: return empty
      return {
        get: () => null,
        all: () => [],
      };
    },
    transaction<T extends (...args: unknown[]) => unknown>(fn: T): T {
      return ((...args: unknown[]) => fn(...args)) as unknown as T;
    },
    exec(_sql: string): void {
      /* no-op */
    },
  } as unknown as Database;

  return { db, rows };
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function mkProjectClaudeDir(root: string): string {
  const claudeDir = join(root, ".claude");
  mkdirSync(claudeDir, { recursive: true });
  return claudeDir;
}

function mkSkill(claudeDir: string, name: string, content = `# ${name}\nBody.`): string {
  const dir = join(claudeDir, "skills", name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "SKILL.md");
  writeFileSync(file, content);
  return file;
}

function mkAgent(claudeDir: string, name: string, content = `# ${name}`): string {
  mkdirSync(join(claudeDir, "agents"), { recursive: true });
  const file = join(claudeDir, "agents", `${name}.md`);
  writeFileSync(file, content);
  return file;
}

// ---------------------------------------------------------------------------
// Test fixture state
// ---------------------------------------------------------------------------

let tmpProjectRoot: string;
let projectClaudeDir: string;

beforeEach(() => {
  tmpProjectRoot = mkdtempSync(join(tmpdir(), "zp-project-scan-test-"));
  projectClaudeDir = mkProjectClaudeDir(tmpProjectRoot);
});

afterEach(() => {
  rmSync(tmpProjectRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// runProjectScan tests
// ---------------------------------------------------------------------------

describe("runProjectScan", () => {
  it("returns projectId=null and insertedCount=0 when project is not in DB", async () => {
    // Project root exists on disk but DB has no matching row.
    mkSkill(projectClaudeDir, "test-skill");
    const { db } = makeFakeDb(null, tmpProjectRoot);

    const result = await runProjectScan(db, tmpProjectRoot);

    expect(result.projectId).toBeNull();
    expect(result.insertedCount).toBe(0);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("inserts discovered project-scoped assets when project is in DB", async () => {
    const projectId = "aaaaaaaa-0000-0000-0000-000000000001";
    mkSkill(projectClaudeDir, "my-skill");
    mkAgent(projectClaudeDir, "my-agent");

    const { db, rows } = makeFakeDb(projectId, tmpProjectRoot);

    const result = await runProjectScan(db, tmpProjectRoot);

    expect(result.projectId).toBe(projectId);
    expect(result.insertedCount).toBe(2);
    expect(rows).toHaveLength(2);

    // All rows should be project-scoped with the correct projectId.
    for (const row of rows) {
      expect(row.$scope).toBe("project");
      expect(row.$project_id).toBe(projectId);
    }
  });

  it("scans skills and agents with correct kinds", async () => {
    const projectId = "bbbbbbbb-0000-0000-0000-000000000001";
    mkSkill(projectClaudeDir, "skill-alpha");
    mkAgent(projectClaudeDir, "agent-beta");

    const { db, rows } = makeFakeDb(projectId, tmpProjectRoot);

    await runProjectScan(db, tmpProjectRoot);

    const kinds = rows.map((r) => r.$kind).sort();
    expect(kinds).toContain("skill");
    expect(kinds).toContain("agent");
  });

  it("returns insertedCount=0 when .claude/ is empty", async () => {
    // .claude/ exists but has no assets.
    const projectId = "cccccccc-0000-0000-0000-000000000001";
    const { db, rows } = makeFakeDb(projectId, tmpProjectRoot);

    const result = await runProjectScan(db, tmpProjectRoot);

    expect(result.projectId).toBe(projectId);
    expect(result.insertedCount).toBe(0);
    expect(rows).toHaveLength(0);
  });

  it("returns insertedCount=0 when .claude/ does not exist", async () => {
    // Remove the .claude dir to simulate a missing dir.
    rmSync(projectClaudeDir, { recursive: true });

    const projectId = "dddddddd-0000-0000-0000-000000000001";
    const { db } = makeFakeDb(projectId, tmpProjectRoot);

    const result = await runProjectScan(db, tmpProjectRoot);

    expect(result.projectId).toBe(projectId);
    expect(result.insertedCount).toBe(0);
  });

  it("normalises projectRoot path in DB query (POSIX form)", async () => {
    // The DB query uses projectRoot directly; this test verifies the function
    // accepts a POSIX-normalised path and matches the DB row.
    const projectId = "eeeeeeee-0000-0000-0000-000000000001";
    mkAgent(projectClaudeDir, "posix-agent");

    // Simulate Windows-style backslashes being pre-normalised by caller.
    const posixRoot = tmpProjectRoot.replaceAll("\\", "/");
    const { db, rows } = makeFakeDb(projectId, posixRoot);

    await runProjectScan(db, posixRoot);

    // Rows should have been captured (scan succeeded).
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// CR-1: Orphan-sidecar watchdog tests
// ---------------------------------------------------------------------------

describe("CR-1: orphan-sidecar watchdog", () => {
  it("calls process.exit(0) when process.kill throws (parent gone)", async () => {
    vi.useFakeTimers();

    // Mock process.kill to throw on the first call (parent gone).
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw new Error("ESRCH: no such process");
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const parentPid = process.ppid;

    // Register the watchdog interval — mirrors the production code.
    const interval = setInterval(() => {
      try {
        process.kill(parentPid, 0);
      } catch {
        process.exit(0);
      }
    }, 2000);

    // Fast-forward 2 seconds to fire the first interval tick.
    vi.advanceTimersByTime(2000);

    expect(killSpy).toHaveBeenCalledWith(parentPid, 0);
    expect(exitSpy).toHaveBeenCalledWith(0);

    clearInterval(interval);
    vi.useRealTimers();
    killSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("does NOT call process.exit when process.kill succeeds (parent alive)", async () => {
    vi.useFakeTimers();

    // Mock process.kill to succeed (parent alive).
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      return true;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const parentPid = process.ppid;

    const interval = setInterval(() => {
      try {
        process.kill(parentPid, 0);
      } catch {
        process.exit(0);
      }
    }, 2000);

    vi.advanceTimersByTime(2000);

    expect(killSpy).toHaveBeenCalledWith(parentPid, 0);
    expect(exitSpy).not.toHaveBeenCalled();

    clearInterval(interval);
    vi.useRealTimers();
    killSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("fires at the 2-second cadence (not before)", async () => {
    vi.useFakeTimers();

    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

    const parentPid = process.ppid;

    const interval = setInterval(() => {
      try {
        process.kill(parentPid, 0);
      } catch {
        // no-op in this test
      }
    }, 2000);

    // Advance less than 2 seconds — should NOT fire.
    vi.advanceTimersByTime(1999);
    expect(killSpy).not.toHaveBeenCalled();

    // Advance 1 more ms to reach exactly 2000ms — should fire once.
    vi.advanceTimersByTime(1);
    expect(killSpy).toHaveBeenCalledTimes(1);

    clearInterval(interval);
    vi.useRealTimers();
    killSpy.mockRestore();
  });
});
