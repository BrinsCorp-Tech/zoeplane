# SQLite Derived-State (`sidecar/src/db/`)

ZoePlane's SQLite database holds DERIVED state only. It is NOT the source of truth.
The source of truth is always `~/.claude/` on disk.

## What SQLite holds

- Asset index (parsed/normalized representations of files in `~/.claude/`)
- Evaluator results (risk findings, approval decisions per skill/agent/hook)
- User preferences (theme, sidebar state, per-library view-mode)
- Task history (completed task metadata — not the full stream, just structured metadata)
- Scheduled job definitions (Epic 08)

## What SQLite NEVER holds

- Raw skill/agent/command/team/workflow file content (read from disk on demand)
- Claude session telemetry (per PRD §1.2 — ZoePlane never captures telemetry)
- Plugin proprietary state (plugins manage their own storage via declared capabilities)
- Any credential secrets (stored in system keychain via OS credential APIs, never SQLite)

## Database location

Resolved at runtime via Tauri's `appDataDir()` API (identifier: `com.brinscorp.zoeplane`).
File: `<appDataDir>/zoeplane.db`. Reference paths per platform:

- macOS: `~/Library/Application Support/com.brinscorp.zoeplane/zoeplane.db`
- Windows: `%APPDATA%\com.brinscorp.zoeplane\zoeplane.db`
- Linux: `~/.local/share/com.brinscorp.zoeplane/zoeplane.db` (`$XDG_DATA_HOME/com.brinscorp.zoeplane/zoeplane.db`)

Do not hardcode these paths in code — use Tauri's path API.

## Migration strategy

Schema migrations run at sidecar startup before any IPC handlers register.
Migrations are numbered sequentially; no migration is ever deleted.

## SQLite client

`bun:sqlite` (Bun's built-in). Locked for Sprint 1 to avoid native-module compile risk under `bun build --compile`.

## Migration files

Plain `.sql` files (raw SQL, executed via `bun:sqlite`), numeric-prefix convention, placed under `sidecar/src/db/migrations/`. Each migration runs inside a single transaction. Tracking table: `__migrations(version INTEGER PK, name TEXT, applied_at TEXT)`.

## Implemented (Story 1.3, Sprint 1)

- `client.ts` — SQLite client factory using `bun:sqlite`; opens/creates the DB at the path
  supplied by the Tauri shell via `--db-path`; enables WAL mode and foreign-key enforcement.
- `runner.ts` — Migration orchestrator; bootstraps `__migrations`, discovers pending `.sql` files,
  applies each in a transaction, records version + name + applied_at on success, exits(1) on failure.
- `migrations/001_init.sql` — Documents the `__migrations` schema; idempotent via `IF NOT EXISTS`.

The runner is invoked from `sidecar/src/index.ts` before the HTTP server starts.
The DB path is always resolved by Rust (`app.path().app_data_dir().join("zoeplane.db")`) and
passed to the sidecar as `--db-path <absolute-path>`.

## TODO (Epic 03, Sprint 2)

- `migrations/002_initial_schema.sql` — asset_index, evaluator_results, user_preferences tables
- `repositories/assets.ts` — asset index CRUD
- `repositories/preferences.ts` — user preferences CRUD
- `repositories/evaluator.ts` — evaluator results CRUD
