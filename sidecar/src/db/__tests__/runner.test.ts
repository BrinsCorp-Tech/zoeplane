// @vitest-environment node
//
// Migration runner — duplicate-version rejection guard.
//
// Background: macOS iCloud Drive (and Dropbox / OneDrive) create sibling files
// like "002_asset_index 2.sql" alongside "002_asset_index.sql" when sync
// conflicts arise.  Both filenames parse to version 2 under the runner's
// `/^(\d+)_.+\.sql$/` regex.  Before this guard, the runner would apply one
// (success), then crash on the second with SQLITE_ERROR ("table already
// exists"), exiting the sidecar with code 1 on every clean-state boot.
//
// This test pins the loud-failure contract: on duplicate versions the runner
// MUST exit(1) at discovery time — before any DDL runs — so the operator sees
// a clear diagnostic instead of a generic SQLite error.
//
// Note: vitest runs on Node, not Bun, so bun:sqlite is unavailable.  The runner
// only touches the database through three methods (exec / query / transaction);
// a structural fake covers the discovery path the guard runs on.

import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import { runMigrations } from "../runner";

function makeTmpMigrationsDir(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "zoeplane-runner-test-"));
  const migrationsDir = join(root, "migrations");
  mkdirSync(migrationsDir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(migrationsDir, name), body, "utf-8");
  }
  return migrationsDir;
}

interface ExecCall {
  sql: string;
}

/**
 * Minimal fake Database covering the surface the runner touches on the
 * discovery path.  Records every exec/query for assertions.
 */
function makeFakeDb(): { db: Database; execCalls: ExecCall[]; queryCalls: string[] } {
  const execCalls: ExecCall[] = [];
  const queryCalls: string[] = [];
  const db = {
    exec(sql: string): void {
      execCalls.push({ sql });
    },
    query(sql: string): { all: () => unknown[]; run: (...args: unknown[]) => void } {
      queryCalls.push(sql);
      return {
        all: () => [],
        run: () => {
          /* no-op */
        },
      };
    },
    transaction<T extends (...args: unknown[]) => unknown>(fn: T): T {
      return fn;
    },
  } as unknown as Database;
  return { db, execCalls, queryCalls };
}

describe("runMigrations — duplicate-version guard", () => {
  it("exits(1) when two files share the same numeric version prefix", () => {
    const migrationsDir = makeTmpMigrationsDir({
      "001_init.sql": "CREATE TABLE t (id INTEGER PRIMARY KEY);",
      "002_real.sql": "CREATE TABLE assets (id INTEGER PRIMARY KEY);",
      // Cloud-sync conflict copy — same version 2, different filename.
      "002_real 2.sql": "CREATE TABLE assets (id INTEGER PRIMARY KEY);",
    });
    const { db, execCalls } = makeFakeDb();

    // process.exit doesn't return; spy throws so the runner unwinds instead of
    // killing the test process.
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${String(code)})`);
    });

    expect(() => runMigrations(db, migrationsDir, false)).toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);

    // Critical invariant: the guard fires BEFORE any per-migration DDL runs.
    // Only the bootstrap CREATE TABLE __migrations should have executed.
    const ddlExecs = execCalls.filter((c) => !c.sql.includes("__migrations"));
    expect(ddlExecs).toEqual([]);

    exitSpy.mockRestore();
    rmSync(migrationsDir, { recursive: true, force: true });
  });

  it("passes discovery when version numbers are unique", () => {
    const migrationsDir = makeTmpMigrationsDir({
      "001_init.sql": "CREATE TABLE t1 (id INTEGER PRIMARY KEY);",
      "002_real.sql": "CREATE TABLE t2 (id INTEGER PRIMARY KEY);",
    });
    const { db, execCalls } = makeFakeDb();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${String(code)})`);
    });

    // No exit expected.  The fake transaction passes through, so each
    // migration's exec(sql) is recorded.
    expect(() => runMigrations(db, migrationsDir, false)).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();

    const ddlExecs = execCalls.filter((c) => !c.sql.includes("__migrations"));
    expect(ddlExecs).toHaveLength(2);

    exitSpy.mockRestore();
    rmSync(migrationsDir, { recursive: true, force: true });
  });
});
