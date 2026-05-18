-- Migration 003: User preferences key-value store
-- Story: 3.7 — Project-switch state persistence + target rescan + FB-015 + fs.rs dual-emit cleanup (FR-040)
-- Purpose: Create the user_preferences table for app-level key-value state
--          (e.g., active_project_id). App-local user state — NOT workspace-shared;
--          intentionally omits FR-068 sync-friendly fields.
--
-- Timestamp convention: Unix epoch milliseconds stored as INTEGER (bun:sqlite
--   integer affinity). Consistent with 002_asset_index.sql convention.
--
-- Design rationale: this table is a flat key-value store rather than typed rows
-- because user preferences are heterogeneous, sparse, and expand over time without
-- requiring schema migrations for each new key. Consumers read by key and parse
-- value as appropriate for their type (string, JSON, etc.).

CREATE TABLE user_preferences (
    key        TEXT    NOT NULL PRIMARY KEY,
    value      TEXT    NOT NULL,
    updated_at INTEGER NOT NULL  -- Unix epoch ms
);
