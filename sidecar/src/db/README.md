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

`{app-data-dir}/zoeplane/zoeplane.db`
- macOS: `~/Library/Application Support/com.brinscorp.zoeplane/zoeplane.db`
- Windows: `%APPDATA%\com.brinscorp.zoeplane\zoeplane.db`
- Linux: `~/.config/com.brinscorp.zoeplane/zoeplane.db`

## Migration strategy

Schema migrations run at sidecar startup before any IPC handlers register.
Migrations are numbered sequentially; no migration is ever deleted.

## TODO (Epic 03, Sprint 2)

Implement:
- `client.ts` — SQLite client factory (using `bun:sqlite` or `better-sqlite3`)
- `migrations/001_initial_schema.ts` — asset_index, evaluator_results, user_preferences tables
- `repositories/assets.ts` — asset index CRUD
- `repositories/preferences.ts` — user preferences CRUD
- `repositories/evaluator.ts` — evaluator results CRUD
