-- Migration 004: Performance indexes
-- Story: 6.2 — Agent Library + AgentCard (CR-4 carryover from Sprint 3)
-- Purpose: Add the asset_provenance.asset_id index required by the
--          GET /assets LEFT JOIN (ADR-009 §3). This index was deferred from
--          Story 6.3 to its actual first consumer (Story 6.2 is the first
--          Epic 06 story to execute the provenance LEFT JOIN).
--
-- Idempotency: CREATE INDEX IF NOT EXISTS — safe to re-run against a DB
--              that already has this index. Consistent with migration runner
--              contract (forward-only for domain tables, idempotent for indexes).
--
-- Date: 2026-05-19

CREATE INDEX IF NOT EXISTS idx_asset_provenance_asset_id
    ON asset_provenance (asset_id);
