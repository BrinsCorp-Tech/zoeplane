-- Migration 002: Asset-index schema
-- Story: 3.1 — SQLite asset-index schema migration
-- Purpose: Create the seven domain tables consumed by Epic 03 (filesystem watchers
--          and asset indexing) and all downstream epics (04–09). Every authored-asset
--          table carries FR-068 sync-friendly fields so v2 multi-workspace lands
--          without a schema migration.
--
-- Timestamp convention: Unix epoch milliseconds stored as INTEGER (bun:sqlite
--   integer affinity).  Do NOT use TEXT ISO-8601 timestamps in this file.
--
-- FR-068 sync-friendly fields applied to all seven tables per AC-5:
--   workspace_id TEXT NOT NULL
--   author_id    TEXT NOT NULL
--   visibility   TEXT NOT NULL CHECK (visibility IN ('private','workspace'))
--   created_at   INTEGER NOT NULL
--   updated_at   INTEGER NOT NULL
--   deleted_at   INTEGER          -- NULL = not deleted (soft-delete tombstone)
--
-- Insert-time defaults for v1 single-workspace (Story 3.3 / 3.5 writers, NOT schema
-- DEFAULT clauses — keeps schema platform-agnostic per Technical Notes):
--   workspace_id = '00000000-0000-0000-0000-000000000001'
--   author_id    = '00000000-0000-0000-0000-000000000001'
--   visibility   = 'private'
--
-- Idempotency: lives in the __migrations tracker, NOT in these DDL statements.
-- Re-running against a DB that already has these tables will fail with a clear
-- "table already exists" error (AC-8 forward-only contract).

-- ---------------------------------------------------------------------------
-- 1. assets
--    One row per indexed skill / agent / command / team / workflow.
--    Story 3.3 (indexer) is the primary writer.
-- ---------------------------------------------------------------------------

CREATE TABLE assets (
    -- FR-068 sync-friendly fields
    id                    TEXT    NOT NULL PRIMARY KEY,   -- UUID v4 string
    workspace_id          TEXT    NOT NULL,
    author_id             TEXT    NOT NULL,
    visibility            TEXT    NOT NULL CHECK (visibility IN ('private','workspace')),
    created_at            INTEGER NOT NULL,               -- Unix epoch ms
    updated_at            INTEGER NOT NULL,               -- Unix epoch ms
    deleted_at            INTEGER,                        -- NULL = active; non-NULL = soft-deleted

    -- Indexing fields (AC-2)
    kind                  TEXT    NOT NULL CHECK (kind IN ('skill','agent','command','team','workflow')),
    name                  TEXT    NOT NULL,
    scope                 TEXT    NOT NULL CHECK (scope IN ('global','project','local')),
    project_id            TEXT,                           -- NULL for global scope
    source_path           TEXT    NOT NULL,
    validation_status     TEXT    NOT NULL CHECK (validation_status IN ('valid','warnings','invalid')),
    shadowed_by_project_id TEXT,                          -- NULL = active; non-NULL = global shadowed by project row (FR-074)
    last_modified_by      TEXT    NOT NULL CHECK (last_modified_by IN ('in_app','external')),
    last_modified_at      INTEGER NOT NULL,               -- Unix epoch ms
    front_matter_json     TEXT,                           -- Parsed YAML front-matter blob; Story 3.5 is writer
    body_excerpt          TEXT,                           -- First ~500 chars of markdown body; length cap at insert time (Story 3.3)

    -- Table-level constraint: enforce scope/project_id coherence (M-1 code-review fix)
    CHECK (
        (scope = 'global' AND project_id IS NULL) OR
        (scope IN ('project', 'local') AND project_id IS NOT NULL)
    )
);

-- FR-074 overlay invariant: at most one row per (kind, name, scope, project_id) tuple.
-- SQLite treats two NULLs as distinct in a UNIQUE INDEX by default; to enforce
-- "NULL IS NULL" equality for global scope we use a partial index covering the
-- NULL case and a standard UNIQUE covering the non-NULL case.
--
-- Approach: single UNIQUE INDEX on all four columns. SQLite's UNIQUE INDEX treats
-- each NULL as distinct from every other NULL, so two global rows (project_id IS NULL)
-- with the same (kind, name, scope) would NOT conflict. To close that gap we add a
-- partial UNIQUE INDEX that covers only the NULL-project_id rows.
CREATE UNIQUE INDEX uq_assets_overlay
    ON assets (kind, name, scope, project_id)
    WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX uq_assets_overlay_global
    ON assets (kind, name, scope)
    WHERE project_id IS NULL;

-- ---------------------------------------------------------------------------
-- 2. asset_provenance
--    Provenance metadata schema. Epic 05 is the primary writer; v1 rows are
--    structural-only (empty/NULL where indicated).
-- ---------------------------------------------------------------------------

CREATE TABLE asset_provenance (
    -- FR-068 sync-friendly fields
    id                    TEXT    NOT NULL PRIMARY KEY,   -- UUID v4 string
    workspace_id          TEXT    NOT NULL,
    author_id             TEXT    NOT NULL,
    visibility            TEXT    NOT NULL CHECK (visibility IN ('private','workspace')),
    created_at            INTEGER NOT NULL,               -- Unix epoch ms
    updated_at            INTEGER NOT NULL,               -- Unix epoch ms
    deleted_at            INTEGER,                        -- NULL = active

    -- Provenance fields (AC-4)
    asset_kind            TEXT    NOT NULL,
    asset_id              TEXT    NOT NULL,               -- FK to assets.id (not enforced by SQLite FK constraint in v1)
    source_url            TEXT    NOT NULL,
    source_hash           TEXT    NOT NULL,               -- SHA-256 hex
    imported_at           INTEGER NOT NULL,               -- Unix epoch ms
    evaluator_report_id   TEXT,                           -- NULL in v1; Epic 05 populates
    last_evaluated_at     INTEGER,                        -- NULL in v1; populated after first evaluation
    scope                 TEXT    NOT NULL
);

-- ---------------------------------------------------------------------------
-- 3. hook_index
--    PRD §3.10 column reference verbatim (AC-3).
--    Epic 09 Strict-Mode flow populates quarantine_reason.
-- ---------------------------------------------------------------------------

CREATE TABLE hook_index (
    -- Core hook fields (PRD §3.10)
    id                    TEXT    NOT NULL PRIMARY KEY,   -- UUID v4 string (row identity)
    hook_id               TEXT    NOT NULL,               -- SHA-256 of (scope, event, matcher, command) — business key
    scope                 TEXT    NOT NULL,               -- 'user' | 'project:<id>' | 'local:<id>'
    source_path           TEXT    NOT NULL,
    source_hash           TEXT    NOT NULL,               -- SHA-256 hex of the hook definition file
    event                 TEXT    NOT NULL,
    matcher               TEXT,                           -- NULL allowed (hooks without a matcher)
    command               TEXT    NOT NULL,
    disabled              INTEGER NOT NULL DEFAULT 0,     -- BOOLEAN (0/1); SQLite has no native BOOLEAN
    quarantine_reason     TEXT,                           -- NULL initially; populated by Epic 09 Strict-Mode flow
    user_disabled         INTEGER NOT NULL DEFAULT 0,     -- BOOLEAN (0/1); user override via UI
    discovered_at         INTEGER NOT NULL,               -- Unix epoch ms
    last_modified_at      INTEGER NOT NULL,               -- Unix epoch ms
    last_modified_by      TEXT    NOT NULL,
    evaluator_report_id   TEXT,                           -- NULL allowed; links to evaluator result
    import_source         TEXT,                           -- NULL allowed; set when hook was imported

    -- FR-068 sync-friendly fields
    workspace_id          TEXT    NOT NULL,
    author_id             TEXT    NOT NULL,
    visibility            TEXT    NOT NULL CHECK (visibility IN ('private','workspace')),
    created_at            INTEGER NOT NULL,               -- Unix epoch ms
    updated_at            INTEGER NOT NULL,               -- Unix epoch ms
    deleted_at            INTEGER                         -- NULL = active
);

-- PRD §3.10: unique index on hook_id (the SHA-256 business key for dedup).
CREATE UNIQUE INDEX uq_hook_index_hook_id
    ON hook_index (hook_id);

-- Non-unique index on scope for Library-view scope filtering (AC-7).
CREATE INDEX idx_hook_index_scope
    ON hook_index (scope);

-- ---------------------------------------------------------------------------
-- 4. projects
--    Tracked project paths (app-derived state; sync-friendly fields per AC-5).
-- ---------------------------------------------------------------------------

CREATE TABLE projects (
    -- FR-068 sync-friendly fields
    id                    TEXT    NOT NULL PRIMARY KEY,   -- UUID v4 string
    workspace_id          TEXT    NOT NULL,
    author_id             TEXT    NOT NULL,
    visibility            TEXT    NOT NULL CHECK (visibility IN ('private','workspace')),
    created_at            INTEGER NOT NULL,               -- Unix epoch ms
    updated_at            INTEGER NOT NULL,               -- Unix epoch ms
    deleted_at            INTEGER,                        -- NULL = active

    -- PRD §3.2 key columns (AC-5)
    path                  TEXT    NOT NULL,
    display_name          TEXT    NOT NULL,
    last_opened_at        INTEGER NOT NULL                -- Unix epoch ms
);

-- ---------------------------------------------------------------------------
-- 5. recent_files
--    Per-project file history (app-derived state; sync-friendly fields per AC-5).
-- ---------------------------------------------------------------------------

CREATE TABLE recent_files (
    -- FR-068 sync-friendly fields
    id                    TEXT    NOT NULL PRIMARY KEY,   -- UUID v4 string
    workspace_id          TEXT    NOT NULL,
    author_id             TEXT    NOT NULL,
    visibility            TEXT    NOT NULL CHECK (visibility IN ('private','workspace')),
    created_at            INTEGER NOT NULL,               -- Unix epoch ms
    updated_at            INTEGER NOT NULL,               -- Unix epoch ms
    deleted_at            INTEGER,                        -- NULL = active

    -- PRD §3.2 key columns (AC-5)
    project_id            TEXT    NOT NULL,               -- FK to projects.id
    path                  TEXT    NOT NULL,
    last_opened_at        INTEGER NOT NULL,               -- Unix epoch ms
    pin_order             INTEGER                         -- NULL = not pinned; lower integer = higher pin priority
);

-- ---------------------------------------------------------------------------
-- 6. route_stacks
--    Per-tab navigation session restore (app-derived state; sync-friendly
--    fields per AC-5).
-- ---------------------------------------------------------------------------

CREATE TABLE route_stacks (
    -- FR-068 sync-friendly fields
    id                    TEXT    NOT NULL PRIMARY KEY,   -- UUID v4 string
    workspace_id          TEXT    NOT NULL,
    author_id             TEXT    NOT NULL,
    visibility            TEXT    NOT NULL CHECK (visibility IN ('private','workspace')),
    created_at            INTEGER NOT NULL,               -- Unix epoch ms
    updated_at            INTEGER NOT NULL,               -- Unix epoch ms
    deleted_at            INTEGER,                        -- NULL = active

    -- PRD §3.2 key columns (AC-5)
    tab_id                TEXT    NOT NULL,
    stack_json            TEXT    NOT NULL,               -- JSON-serialized route stack array
    active_index          INTEGER NOT NULL                -- Index of the currently active route in stack_json
);

-- ---------------------------------------------------------------------------
-- 7. window_layouts
--    Host shell layout persistence (app-derived state; sync-friendly fields
--    per AC-5).
-- ---------------------------------------------------------------------------

CREATE TABLE window_layouts (
    -- FR-068 sync-friendly fields
    id                    TEXT    NOT NULL PRIMARY KEY,   -- UUID v4 string
    workspace_id          TEXT    NOT NULL,
    author_id             TEXT    NOT NULL,
    visibility            TEXT    NOT NULL CHECK (visibility IN ('private','workspace')),
    created_at            INTEGER NOT NULL,               -- Unix epoch ms
    updated_at            INTEGER NOT NULL,               -- Unix epoch ms
    deleted_at            INTEGER,                        -- NULL = active

    -- PRD §3.2 key columns (AC-5)
    layout_name           TEXT    NOT NULL,
    layout_json           TEXT    NOT NULL               -- JSON-serialized layout descriptor
);
