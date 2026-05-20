# Data Model — ZoePlane

## Storage Layer

ZoePlane uses a single SQLite database for derived state. The database is opened via `bun:sqlite` in the sidecar process (`sidecar/src/db/client.ts`) and is the only persistent store ZoePlane owns. It is not the primary source of truth.

**Database path**: `<appDataDir>/zoeplane.db`

Platform-resolved paths:

| Platform | Path                                                               |
| -------- | ------------------------------------------------------------------ |
| macOS    | `~/Library/Application Support/com.brinscorp.zoeplane/zoeplane.db` |
| Windows  | `%APPDATA%\com.brinscorp.zoeplane\zoeplane.db`                     |
| Linux    | `~/.local/share/com.brinscorp.zoeplane/zoeplane.db`                |

The database path is resolved by the Tauri shell at spawn time using `app.path().app_data_dir()` (derived from the bundle identifier `com.brinscorp.zoeplane`) and passed to the sidecar as `--db-path <path>`. The sidecar does not derive this path itself. Source: `src-tauri/src/lib.rs:173-179`.

## Source-of-Truth Split

| Data                                         | Authoritative store                 | ZoePlane's role                                                                          |
| -------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| Skills, agents, teams, workflows, hooks      | `~/.claude/` (Claude Code data dir) | Read-only consumer. Never writes to `~/.claude/`.                                        |
| Session transcripts and history              | `~/.claude/`                        | Read-only consumer in Sprint 1.                                                          |
| Derived asset index (names, paths, validity) | SQLite                              | ZoePlane builds and maintains this index from `~/.claude/` content (Epic 03+).           |
| Evaluator results                            | SQLite                              | Produced by the Skill Safety Evaluator (Epic 05+).                                       |
| User preferences                             | SQLite                              | ZoePlane owns this (theme, sidebar state, etc.).                                         |
| Plugin-scoped storage                        | SQLite (partitioned by plugin ID)   | Written by the plugin host on behalf of plugins that declare `pluginStorage` (Epic 04+). |

**Key invariant**: the SQLite database can be deleted at any time and rebuilt from `~/.claude/` content (plus re-running evaluations and re-applying user preferences). No user data that does not already exist in `~/.claude/` is permanently stored in SQLite.

## Schema

Four migrations have been applied. Migration files live at `sidecar/src/db/migrations/`. The highest-numbered migration applied is `004_indexes.sql` (Sprint 5).

### Migration 001 — `__migrations` tracking table (Sprint 1)

Bootstrapped by the migration runner before any migration files are applied. Idempotent (`CREATE TABLE IF NOT EXISTS`).

```sql
CREATE TABLE IF NOT EXISTS __migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    applied_at TEXT    NOT NULL  -- ISO-8601 UTC timestamp
);
```

Source: `sidecar/src/db/migrations/001_init.sql`.

### Migration 002 — Asset index tables (Sprint 3, Story 3.1)

Seven domain tables for the FS-watched asset index. All integer timestamps are Unix epoch milliseconds. All seven tables carry FR-068 sync-friendly fields (`workspace_id`, `author_id`, `visibility`, `created_at`, `updated_at`, `deleted_at`) for eventual multi-workspace support. Source: `sidecar/src/db/migrations/002_asset_index.sql`.

#### `assets`

One row per indexed skill / agent / command / team / workflow. Primary writer: `sidecar/src/indexer/scanner.ts` (cold-launch scan) and `indexer/event-router.ts` (watcher-triggered upserts).

Key columns:

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `kind` | TEXT | CHECK: `skill\|agent\|command\|team\|workflow` |
| `name` | TEXT | Asset name (filename stem) |
| `scope` | TEXT | CHECK: `global\|project\|local` |
| `project_id` | TEXT | NULL for global scope; NOT NULL for project/local |
| `source_path` | TEXT | Absolute path to the `.md` file |
| `validation_status` | TEXT | CHECK: `valid\|warnings\|invalid` |
| `shadowed_by_project_id` | TEXT | NULL = active; non-NULL = this global row is shadowed by a project-scoped row (FR-074) |
| `front_matter_json` | TEXT | Parsed YAML front-matter as JSON string; NULL on parse failure; Story 3.5 is writer |
| `body_excerpt` | TEXT | First ~500 chars of markdown body |
| `last_modified_at` | INTEGER | Unix epoch ms |
| `last_modified_by` | TEXT | CHECK: `in_app\|external` |
| `deleted_at` | INTEGER | NULL = active; soft-delete tombstone |

**FR-074 overlay indexes**: Two partial UNIQUE indexes enforce at-most-one row per `(kind, name, scope, project_id)`:

```sql
CREATE UNIQUE INDEX uq_assets_overlay
    ON assets (kind, name, scope, project_id)
    WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX uq_assets_overlay_global
    ON assets (kind, name, scope)
    WHERE project_id IS NULL;
```

SQLite treats two NULLs as distinct in a standard UNIQUE index; the `WHERE project_id IS NULL` partial index closes that gap for global-scope rows. Source: `002_asset_index.sql`.

**Scope coherence constraint** (table-level CHECK):

```sql
CHECK (
    (scope = 'global' AND project_id IS NULL) OR
    (scope IN ('project', 'local') AND project_id IS NOT NULL)
)
```

#### `asset_provenance`

Provenance metadata for imported assets. Epic 05 (Skill Safety Evaluator) is the primary writer; v1 rows are structural-only (most fields NULL/empty until Epic 05 ships).

Key columns: `asset_id` (FK to `assets.id`, not enforced by SQLite constraint), `source_url`, `source_hash` (SHA-256 hex), `imported_at`, `evaluator_report_id` (NULL in v1), `last_evaluated_at` (NULL in v1).

#### `hook_index`

One row per discovered hook entry from `~/.claude/settings.json` and per-project settings files. Business key: `hook_id` (SHA-256 of `(scope, event, matcher, command)`). Epic 09 (Strict-Mode flow) populates `quarantine_reason`.

Key columns: `hook_id` (SHA-256 business key, UNIQUE), `scope`, `source_path`, `event`, `matcher`, `command`, `disabled`, `quarantine_reason`, `user_disabled`.

Non-unique index on `scope` for Library-view scope filtering.

#### `projects`

One row per tracked project path (app-derived state). Key columns: `path`, `display_name`, `last_opened_at`.

#### `recent_files`

Per-project file history. Key columns: `project_id` (FK to `projects.id`), `path`, `last_opened_at`, `pin_order` (NULL = not pinned; lower integer = higher priority).

#### `route_stacks`

Per-tab navigation session restore. Key columns: `tab_id`, `stack_json` (JSON array), `active_index`.

#### `window_layouts`

Host-shell layout persistence. Key columns: `layout_name`, `layout_json` (JSON descriptor).

### Migration 003 — `user_preferences` (Sprint 4, Story 3.7)

Flat key-value store for app-level user state. Intentionally omits FR-068 sync-friendly fields (user preferences are machine-local, not workspace-shared). Source: `sidecar/src/db/migrations/003_user_prefs.sql`.

```sql
CREATE TABLE user_preferences (
    key        TEXT    NOT NULL PRIMARY KEY,
    value      TEXT    NOT NULL,
    updated_at INTEGER NOT NULL  -- Unix epoch ms
);
```

### Migration 004 — Performance indexes (Sprint 5, Story 6.2 — CR-4 paydown)

Adds the `idx_asset_provenance_asset_id` index required by the `GET /assets` LEFT JOIN (ADR-009 §3). This index was identified as a carryover (CR-4) in Sprint 3 and shipped when Story 6.2 became its first consumer. Source: `sidecar/src/db/migrations/004_indexes.sql`.

```sql
CREATE INDEX IF NOT EXISTS idx_asset_provenance_asset_id
    ON asset_provenance (asset_id);
```

### Planned Tables (Future Epics)

| Table | Target epic | Purpose |
|---|---|---|
| `evaluator_reports` | Epic 05 | Skill Safety Evaluator verdicts per resource + version |
| Plugin storage | Epic 04 | Scoped key-value storage per plugin |

## Migration Philosophy

The migration runner (`sidecar/src/db/runner.ts`) applies forward-only migrations. There is no rollback mechanism — a failed migration causes the sidecar to exit with code 1 (`process.exit(1)`), which surfaces as an unexpected sidecar termination logged to the `sidecar-lifecycle` tracing channel.

**Conventions**:

- Migration files live in `sidecar/src/db/migrations/`. At runtime they are read from the Tauri-bundled resource path passed via `--migrations-dir`.
- Filenames must follow `NNN_description.sql` (e.g., `001_init.sql`, `002_asset_index.sql`). Files that do not match `^\d+_.*\.sql$` are skipped with a WARN log.
- Migrations are applied in ascending numeric order.
- Each migration runs inside a single `bun:sqlite` transaction. On failure the transaction is rolled back and the process exits with code 1.
- The `__migrations` table is bootstrapped before the migrations directory is read, so `001_init.sql` (which also creates `__migrations`) will record its own application after the table exists.

Source: `sidecar/src/db/runner.ts:1-244`.

## Query Patterns

### Migration bookkeeping

```sql
-- Check which migrations have been applied
SELECT version FROM __migrations ORDER BY version ASC;

-- Record a migration as applied
INSERT INTO __migrations (version, name, applied_at) VALUES (?, ?, ?);
```

### Library asset query (GET /assets — ADR-009 §3)

The primary read query executed by `sidecar/src/routes/assets.ts::handleGetAssets()`. Parameters are bound dynamically based on the `kind`, `scope`, and `projectId` query params. `LIMIT 501` detects the 500-row soft cap without an additional COUNT query.

```sql
SELECT
  a.id, a.kind, a.name, a.scope, a.project_id,
  a.source_path, a.validation_status,
  a.last_modified_at, a.last_modified_by,
  a.front_matter_json, a.body_excerpt,
  p.id           AS provenance_id,
  p.source_url   AS provenance_source_url,
  p.source_hash  AS provenance_source_hash,
  p.imported_at  AS provenance_imported_at,
  p.evaluator_report_id AS provenance_evaluator_report_id,
  p.last_evaluated_at   AS provenance_last_evaluated_at
FROM assets a
LEFT JOIN asset_provenance p
  ON p.asset_id = a.id
  AND p.deleted_at IS NULL
WHERE a.deleted_at IS NULL
  AND a.shadowed_by_project_id IS NULL
  AND a.kind = ?
  [AND a.scope = ?]          -- optional
  [AND a.project_id = ?]     -- optional
ORDER BY a.kind ASC, a.scope ASC, a.name ASC
LIMIT 501
```

The `idx_asset_provenance_asset_id` index (`migration 004`) is required for this LEFT JOIN to avoid a full table scan on `asset_provenance`.

### User preference read/write (Epic 03, Story 3.7)

```sql
-- Read a preference value
SELECT value FROM user_preferences WHERE key = ?;

-- Upsert a preference value
INSERT INTO user_preferences (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
```

### Project soft-delete (Epic 03, Story 3.7)

When a project is removed via `POST /projects/:id/remove`, associated rows are tombstoned in a single transaction:

```sql
UPDATE assets       SET deleted_at = ? WHERE project_id = ? AND deleted_at IS NULL;
UPDATE hook_index   SET deleted_at = ? WHERE scope LIKE 'project:%' AND ...;
UPDATE route_stacks SET deleted_at = ? WHERE ... ;
UPDATE recent_files SET deleted_at = ? WHERE project_id = ?;
UPDATE projects     SET deleted_at = ? WHERE id = ?;
```

---

_Last reviewed: 2026-05-20 by tech-writer agent (Sprint 3 schema introduction + Sprint 4 user_preferences + Sprint 5 CR-4 performance index)._
