# Data Model — ZoePlane

## Storage Layer

ZoePlane uses a single SQLite database for derived state. The database is opened via `bun:sqlite` in the sidecar process (`sidecar/src/db/client.ts`) and is the only persistent store ZoePlane owns. It is not the primary source of truth.

**Database path**: `<appDataDir>/zoeplane.db`

Platform-resolved paths:

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/com.brinscorp.zoeplane/zoeplane.db` |
| Windows | `%APPDATA%\com.brinscorp.zoeplane\zoeplane.db` |
| Linux | `~/.local/share/com.brinscorp.zoeplane/zoeplane.db` |

The database path is resolved by the Tauri shell at spawn time using `app.path().app_data_dir()` (derived from the bundle identifier `com.brinscorp.zoeplane`) and passed to the sidecar as `--db-path <path>`. The sidecar does not derive this path itself. Source: `src-tauri/src/lib.rs:173-179`.

## Source-of-Truth Split

| Data | Authoritative store | ZoePlane's role |
|---|---|---|
| Skills, agents, teams, workflows, hooks | `~/.claude/` (Claude Code data dir) | Read-only consumer. Never writes to `~/.claude/`. |
| Session transcripts and history | `~/.claude/` | Read-only consumer in Sprint 1. |
| Derived asset index (names, paths, validity) | SQLite | ZoePlane builds and maintains this index from `~/.claude/` content (Epic 03+). |
| Evaluator results | SQLite | Produced by the Skill Safety Evaluator (Epic 05+). |
| User preferences | SQLite | ZoePlane owns this (theme, sidebar state, etc.). |
| Plugin-scoped storage | SQLite (partitioned by plugin ID) | Written by the plugin host on behalf of plugins that declare `pluginStorage` (Epic 04+). |

**Key invariant**: the SQLite database can be deleted at any time and rebuilt from `~/.claude/` content (plus re-running evaluations and re-applying user preferences). No user data that does not already exist in `~/.claude/` is permanently stored in SQLite.

## Schema

### Sprint 1 Tables

#### `__migrations`

The migration tracking table, bootstrapped by the migration runner before any migration files are applied. Idempotent (`CREATE TABLE IF NOT EXISTS`).

```sql
CREATE TABLE IF NOT EXISTS __migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    applied_at TEXT    NOT NULL  -- ISO-8601 UTC timestamp
);
```

Source: `sidecar/src/db/migrations/001_init.sql`.

This is the only table created in Sprint 1. Domain tables (asset index, evaluator results, preferences) are defined in later epics.

### Planned Tables (Future Epics)

| Table | Target epic | Purpose |
|---|---|---|
| Asset index tables | Epic 03 | FS-watched index of skills, agents, commands, teams, workflows, hooks |
| Evaluator results | Epic 05 | Skill Safety Evaluator verdicts per resource + version |
| User preferences | Epic 02 | Theme, sidebar state, command palette history |
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

In Sprint 1 the only queries are migration bookkeeping:

```sql
-- Check which migrations have been applied
SELECT version FROM __migrations ORDER BY version ASC;

-- Record a migration as applied
INSERT INTO __migrations (version, name, applied_at) VALUES (?, ?, ?);
```

Domain queries (asset lookup, evaluator result reads, preference reads/writes) are defined in later epics.

---

*Last reviewed: 2026-05-09 by tech-writer agent against Sprint 1.*
