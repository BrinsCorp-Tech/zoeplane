// ZoePlane Sidecar — SQLite client factory
//
// Wraps `bun:sqlite` (Bun's built-in, no npm dependency) and returns a ready-to-use
// Database instance for the given file path.
//
// Design decisions:
//   - The DB path is ALWAYS resolved by the Tauri shell (Rust) and passed in as a
//     CLI argument -- never resolved or hardcoded here.  This keeps the sidecar
//     platform-agnostic and eliminates drift between TypeScript and Tauri's own
//     path-resolver logic.
//   - WAL mode is enabled immediately so concurrent reads do not block writes.
//     This is safe for a single-writer, multi-reader workload (one sidecar process).
//   - Foreign keys are enforced per connection (SQLite default is off).
//   - If the database file cannot be opened (e.g. path does not exist, permission
//     denied) bun:sqlite throws synchronously and the caller must let it propagate
//     so startup fails loudly (Acceptance Criteria 4).
//
// Story: 1.3 — SQLite Migration Runner Skeleton

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Open (or create) the SQLite database at `dbPath`.
 *
 * Ensures the parent directory exists before opening — Tauri will have created
 * appDataDir, but we guard defensively in case of unusual process ordering.
 *
 * Throws on any I/O failure so the sidecar terminates with a non-zero exit code
 * and a diagnostic message (AC4).
 */
export function openDatabase(dbPath: string): Database {
  // Ensure parent directory exists (idempotent).
  const dir = dirname(dbPath);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    throw new Error(
      `[db/client] Failed to create database directory "${dir}": ${String(err)}`,
      { cause: err }
    );
  }

  // Open or create the database file.  bun:sqlite throws a native error if the
  // file cannot be created / opened (e.g. permission denied).
  let db: Database;
  try {
    db = new Database(dbPath, { create: true });
  } catch (err) {
    throw new Error(
      `[db/client] Failed to open SQLite database at "${dbPath}": ${String(err)}`,
      { cause: err }
    );
  }

  // Enable WAL journal mode for better read concurrency.
  db.exec("PRAGMA journal_mode = WAL;");

  // Enforce foreign-key constraints (SQLite disables them by default).
  db.exec("PRAGMA foreign_keys = ON;");

  return db;
}
