// ZoePlane Sidecar — SQLite migration runner
//
// Applies ordered .sql migration files to the database on every sidecar startup.
// Each migration runs inside a single transaction; any failure rolls back the
// transaction and terminates the process with exit code 1 (AC5).
//
// Conventions:
//   - Migration files live in `./migrations/` relative to this file in source.
//     At runtime (compiled sidecar) the migrations directory path is passed in
//     explicitly via `runMigrations(db, migrationsDir)`.
//   - Filenames must follow the numeric-prefix convention: NNN_description.sql
//     (e.g. 001_init.sql, 002_assets.sql).  Any file that does not match
//     /^\d+_.*\.sql$/ is silently skipped with a warning.
//   - Migrations are applied in ascending numeric order.
//   - The tracking table `__migrations` is bootstrapped by the runner before
//     reading the migrations directory, so 001_init.sql (which also creates it)
//     will record its own application after the table exists.
//
// Story: 1.3 — SQLite Migration Runner Skeleton

import type { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MigrationRow {
  version: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all pending migrations against `db`.
 *
 * @param db            Open bun:sqlite Database instance.
 * @param migrationsDir Absolute path to the directory containing .sql files.
 * @param isFallback    True when the path was synthesised by the dev fallback
 *                      (--migrations-dir was NOT supplied). False when the
 *                      Tauri shell passed the explicit bundled resource path.
 *                      An unreadable directory is only fatal when isFallback
 *                      is false (production path — misconfigured bundle).
 *
 * Exits the process with code 1 if any migration fails (AC4, AC5).
 */
export function runMigrations(db: Database, migrationsDir: string, isFallback: boolean): void {
  // Step 1: Ensure the tracking table exists before we read any migration files.
  bootstrapTrackingTable(db);

  // Step 2: Discover migration files.
  const pending = discoverPendingMigrations(db, migrationsDir, isFallback);

  if (pending.length === 0) {
    console.error(
      JSON.stringify({
        level: "INFO",
        message: "Migration runner: no pending migrations",
      })
    );
    return;
  }

  console.error(
    JSON.stringify({
      level: "INFO",
      message: "Migration runner: applying migrations",
      count: pending.length,
      versions: pending.map((m) => m.version),
    })
  );

  // Step 3: Apply each pending migration inside its own transaction.
  for (const migration of pending) {
    applyMigration(db, migration);
  }

  console.error(
    JSON.stringify({
      level: "INFO",
      message: "Migration runner: all migrations applied",
      count: pending.length,
    })
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface PendingMigration {
  version: number;
  name: string;
  filePath: string;
}

/**
 * Bootstraps the `__migrations` tracking table.
 * Called before any migration files are read so the table always exists when
 * we try to record a migration.
 *
 * Uses CREATE TABLE IF NOT EXISTS so it is idempotent on subsequent startups.
 */
function bootstrapTrackingTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS __migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT    NOT NULL,
      applied_at TEXT    NOT NULL
    );
  `);
}

/**
 * Reads the migrations directory, filters to .sql files matching the naming
 * convention, excludes already-applied versions, and returns the pending list
 * sorted in ascending order.
 *
 * @param isFallback  When false (explicit --migrations-dir from Tauri shell),
 *                    an unreadable directory is a fatal misconfiguration and
 *                    the process exits with code 1.  When true (dev fallback),
 *                    an unreadable directory is tolerated with a WARN.
 */
function discoverPendingMigrations(
  db: Database,
  migrationsDir: string,
  isFallback: boolean
): PendingMigration[] {
  // Read the highest applied version (or -1 if none).
  const applied = db
    .query<MigrationRow, []>("SELECT version FROM __migrations ORDER BY version ASC")
    .all();
  const appliedSet = new Set(applied.map((row) => row.version));

  let files: string[];
  try {
    files = readdirSync(migrationsDir);
  } catch (err) {
    if (isFallback) {
      // Dev-fallback path: directory may simply not exist yet (e.g. fresh checkout
      // with no local migrations). Warn and continue — the runner is still
      // operational with zero migrations.
      console.error(
        JSON.stringify({
          level: "WARN",
          message: "Migration runner: migrations directory not readable — skipping (dev fallback)",
          migrationsDir,
          error: String(err),
        })
      );
      return [];
    }
    // Explicit production path (--migrations-dir was supplied by the Tauri shell).
    // An unreadable directory means a misconfigured bundle — fail loudly so the
    // problem surfaces immediately rather than producing a half-initialised DB.
    console.error(
      JSON.stringify({
        level: "ERROR",
        message:
          "Migration runner: explicit --migrations-dir is not readable — " +
          "this indicates a misconfigured bundle. Aborting.",
        migrationsDir,
        error: String(err),
      })
    );
    process.exit(1);
  }

  const MIGRATION_RE = /^(\d+)_(.+)\.sql$/;
  const pending: PendingMigration[] = [];

  for (const file of files) {
    const match = MIGRATION_RE.exec(file);
    if (match === null) {
      console.error(
        JSON.stringify({
          level: "WARN",
          message: "Migration runner: skipping non-conforming file",
          file,
        })
      );
      continue;
    }

    const version = parseInt(match[1], 10);

    // Guard against version numbers outside JS safe-integer range.  A filename
    // like 9007199254740992_foo.sql would parse to MAX_SAFE_INTEGER + 1, which
    // fails equality checks against appliedSet and causes silent re-runs on every
    // startup.  Treat such filenames as malformed dev-side artifacts and skip.
    if (!Number.isSafeInteger(version) || version < 1) {
      console.error(
        JSON.stringify({
          level: "WARN",
          message: "Migration runner: skipping file with out-of-range version number",
          file,
          parsedVersion: version,
        })
      );
      continue;
    }

    const name = file; // full filename serves as the canonical name

    if (appliedSet.has(version)) {
      // Already applied — skip.
      continue;
    }

    pending.push({ version, name, filePath: join(migrationsDir, file) });
  }

  // Sort ascending by version number.
  pending.sort((a, b) => a.version - b.version);
  return pending;
}

/**
 * Applies a single migration inside a transaction.
 *
 * If the migration SQL or the tracking-table INSERT fails, the transaction is
 * rolled back and the process exits with code 1 (AC5).
 */
function applyMigration(db: Database, migration: PendingMigration): void {
  let sql: string;
  try {
    sql = readFileSync(migration.filePath, "utf-8");
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "Migration runner: failed to read migration file",
        migration: migration.name,
        filePath: migration.filePath,
        error: String(err),
      })
    );
    process.exit(1);
  }

  console.error(
    JSON.stringify({
      level: "INFO",
      message: "Migration runner: applying migration",
      version: migration.version,
      name: migration.name,
    })
  );

  // Wrap the migration SQL and the tracking INSERT in a single transaction.
  // bun:sqlite's `transaction()` creates a deferred transaction; on error it
  // automatically rolls back.
  const apply = db.transaction(() => {
    // Execute the migration SQL (may contain multiple statements).
    db.exec(sql);

    // Record the migration as applied.
    // db.query().run() finalizes the compiled Statement internally, unlike
    // db.prepare().run() which leaves the Statement object open.
    db.query(
      "INSERT INTO __migrations (version, name, applied_at) VALUES (?, ?, ?)"
    ).run(migration.version, migration.name, new Date().toISOString());
  });

  try {
    apply();
  } catch (err) {
    // Transaction was automatically rolled back by bun:sqlite on throw.
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "Migration runner: migration failed — transaction rolled back",
        version: migration.version,
        name: migration.name,
        error: String(err),
      })
    );
    process.exit(1);
  }

  console.error(
    JSON.stringify({
      level: "INFO",
      message: "Migration runner: migration applied successfully",
      version: migration.version,
      name: migration.name,
    })
  );
}
