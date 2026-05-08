-- Migration 001: Bootstrap migrations tracking table
-- Story: 1.3 — SQLite Migration Runner Skeleton
-- Purpose: Create the __migrations tracking table that the runner uses to
--          record which migrations have been applied. This is the sole table
--          created in Sprint 1; domain tables (asset_index, evaluator_results,
--          etc.) arrive in Epic 03.
--
-- NOTE: The runner bootstraps __migrations before reading this directory, so
-- this file will only run after the tracking table already exists. Its role
-- is to serve as the canonical in-repo documentation of the schema and to
-- establish the numeric-prefix versioning convention. It is idempotent via
-- IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS __migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    applied_at TEXT    NOT NULL  -- ISO-8601 UTC timestamp (e.g. "2026-05-08T00:00:00.000Z")
);
