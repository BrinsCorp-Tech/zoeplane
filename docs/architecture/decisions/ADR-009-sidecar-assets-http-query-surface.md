# ADR-009: Sidecar `/assets` HTTP Query Surface for Epic 06 Library Views

**Status:** Accepted (2026-05-19)
**Date:** 2026-05-19
**Decision drivers:** Story 6.2 Phase 0.5b FAIL C (no `/assets` route exists in sidecar despite Stories 6.2 / 6.3 / 6.6 assuming a TanStack Query fetch against it); Epic 06 Library views need a single query primitive against the shipped `assets` table; ADR-007 (Epic 03 IPC contract — locked event shapes); ADR-005 (sidecar watcher layer); FR-002 / FR-010 / FR-011 (1000 ms render targets for library views of ≤100 cards).

## Context

Epic 06 introduces four Library / Detail surfaces that all read from the same shipped `assets` table (002_asset_index.sql):

| Story | View                   | Filter                                                    |
| ----- | ---------------------- | --------------------------------------------------------- |
| 6.2   | Agent Library          | `kind = 'agent' AND scope = 'global'`                     |
| 6.3   | Skill Library          | `kind = 'skill' AND scope = 'global'`                     |
| 6.6   | Commands Library       | `kind = 'command'` (both global + project scopes)         |
| 6.10  | Cross-reference panels | `assets` joined with `hook_index` (Epic 09 — empty in v1) |

Sprint 4 shipped seven HTTP routes on the sidecar (`/health`, `/events`, `/projects`, `/watcher/...`, `/indexer/scan/project`, `/state/...`, `/preferences/...`, `/editor/...`) but **no route returns asset rows**. The UI in Stories 6.2 / 6.3 / 6.6 assumes a fetch keyed `['assets', kind, scope]` against the sidecar HTTP loopback that does not exist. Without this contract locked, every Library story re-litigates the query shape and risks divergent client-side parsing of `front_matter_json`.

This ADR locks the route, response, JOIN strategy, parsing locus, and invalidation contract before sprint-programmer touches any of the four downstream stories.

### Audit findings (Phase 0.5b on Story 6.2)

- **FAIL C:** Story 6.2 Technical Notes assume TanStack Query fetch of `['assets', 'agent', 'global']` against the sidecar — no such route exists.
- **Latent gap C2:** Story 6.3 LEFT JOINs against `evaluator_reports` — that table does not exist in any shipped migration; it appears only in ux-spec design text. Epic 05 is the future writer.
- **Latent gap C3:** `front_matter_json` is stored as TEXT containing JSON. Parsing locus (server vs. client) was implied but never written down. Two clients (Agent + Skill cards) parsing independently would duplicate the work 100× per library and risk subtle divergence.

## Decision

**Lock a single `GET /assets` HTTP route on the sidecar as the query primitive for all Epic 06 Library views.** Server-side parses `front_matter_json` into a nested object; server-side LEFT JOINs `asset_provenance`; defers `evaluator_reports` JOIN behind an explicit additive seam pending Epic 05.

### 1. Route specification

```
GET /assets?kind=<kind>&scope=<scope>&projectId=<uuid>&include=<comma-separated>
```

| Query param | Required | Allowed values                                          | Default      | Notes                                                                                                        |
| ----------- | -------- | ------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------ |
| `kind`      | yes      | `skill` \| `agent` \| `command` \| `team` \| `workflow` | —            | Maps to `assets.kind` CHECK enum.                                                                            |
| `scope`     | no       | `global` \| `project` \| `local`                        | (all scopes) | Omit to get rows across all scopes (Story 6.6 case).                                                         |
| `projectId` | no       | UUID v4                                                 | none         | Required if `scope=project` or `scope=local`; ignored if `scope=global`.                                     |
| `include`   | no       | `provenance` (default-on for v1)                        | `provenance` | Reserved for future fan-out: `provenance,evaluator,cross_refs`. v1 ignores anything other than `provenance`. |

**Soft cap:** 500 rows. Response includes `truncated: true` if `assets` would have returned more — caller learns to add filters. FR-002 / FR-010 cap real-world libraries at 100; the 500 ceiling is a safety net.

**Excluded by default:**

- Rows where `deleted_at IS NOT NULL` (soft-deleted).
- Rows where `shadowed_by_project_id IS NOT NULL` (FR-074 overlay invariant — shadowed global rows are hidden from Library views).

### 2. Response schema

```typescript
// To be moved to packages/shared-types/src/epic-06.ts in Phase 1 (sprint-programmer).

/** Response envelope for GET /assets. */
export interface AssetsResponse {
  /** Matching asset rows, post-overlay-filter, post-soft-delete-filter. */
  assets: AssetSummary[];
  /** True when the soft cap (500) truncated the result set. */
  truncated: boolean;
  /** Total row count BEFORE the soft cap was applied. */
  totalCount: number;
}

/** One row per asset, with server-side-parsed front-matter and LEFT-JOINed provenance. */
export interface AssetSummary {
  /** UUID v4. Matches assets.id. */
  id: string;
  /** Asset kind. Matches assets.kind CHECK enum. */
  kind: "skill" | "agent" | "command" | "team" | "workflow";
  /** Asset name. Matches assets.name. */
  name: string;
  /** Scope. Matches assets.scope. */
  scope: "global" | "project" | "local";
  /** Project UUID for project / local scope; null for global. */
  projectId: string | null;
  /** Absolute canonical path on disk. */
  sourcePath: string;
  /** Validation status. Matches assets.validation_status. */
  validationStatus: "valid" | "warnings" | "invalid";
  /** Unix epoch milliseconds. */
  lastModifiedAt: number;
  /** "in_app" | "external" — drives FR-006 banner eligibility. */
  lastModifiedBy: "in_app" | "external";
  /**
   * Parsed front-matter as a nested object. Server-side `JSON.parse` of
   * `assets.front_matter_json`. `null` when front-matter parse failed
   * (in which case `validationStatus === 'invalid'`) OR when the validator
   * ran in fallback mode (gray-matter unavailable, see ADR-008).
   */
  frontMatter: Record<string, unknown> | null;
  /** First ~500 chars of markdown body. Matches assets.body_excerpt. */
  bodyExcerpt: string | null;
  /**
   * LEFT-JOINed asset_provenance row, or null if no provenance row exists.
   * `include=provenance` is the v1 default.
   */
  provenance: AssetProvenanceSummary | null;
}

/** Subset of asset_provenance needed by Library views. */
export interface AssetProvenanceSummary {
  /** UUID v4 of the asset_provenance row. */
  id: string;
  /** Source URL of the original asset. */
  sourceUrl: string;
  /** SHA-256 hex of the source content. */
  sourceHash: string;
  /** Unix epoch milliseconds. */
  importedAt: number;
  /** Linked evaluator_reports.id (Epic 05); null in v1. */
  evaluatorReportId: string | null;
  /** Unix epoch milliseconds; null in v1. */
  lastEvaluatedAt: number | null;
}
```

#### Front-matter parsing locus (decision: SERVER)

`assets.front_matter_json` is already TEXT containing pre-parsed JSON (Story 3.5 validator writes it). The sidecar runs `JSON.parse` once per row before returning, so each client receives a typed nested object instead of N clients each parsing N strings. This:

- Keeps the four downstream stories (6.2 / 6.3 / 6.6 / 6.10) consuming a single canonical shape.
- Concentrates JSON.parse failure handling in one server-side place (parse failure → `frontMatter: null`).
- Avoids `unknown` typing fan-out into every card component.

Cost: ~100 `JSON.parse` calls per Library view query, on the sidecar process — negligible against the 1000 ms FR budget.

### 3. JOIN strategy (decision: SERVER-SIDE, single query)

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
WHERE a.kind = ?
  AND a.deleted_at IS NULL
  AND a.shadowed_by_project_id IS NULL
  -- AND a.scope = ?           -- bound conditionally if scope param present
  -- AND a.project_id = ?      -- bound conditionally if projectId param present
ORDER BY a.kind ASC, a.scope ASC, a.name ASC
LIMIT 500;
```

**Why server-side, not client-side:**

- Single round-trip per Library view vs. N+1 (one per card to fetch provenance).
- Meets the 1000 ms FR budget at 100 cards × LEFT JOIN on indexed `asset_provenance.asset_id`.
- Story 6.10's cross-reference panels query a different surface (`hook_index`) — those panels get their own future route; this route owns the asset+provenance join only.

**Index requirement:** `idx_asset_provenance_asset_id` on `asset_provenance(asset_id)`. This is the **CR-4 deferred index** previously scoped to Story 6.3. Migration `004_indexes.sql` lands as a foundational artifact of Story 6.2 because Story 6.2 is the first consumer of the provenance LEFT JOIN. Story 6.3 (and any later provenance consumer) inherits the index without re-shipping it.

### 4. Evaluator JOIN seam (decision: DEFER behind ADR-009-additive contract)

`evaluator_reports` does not exist as a shipped table in any of `001_init.sql`, `002_asset_index.sql`, or `003_user_prefs.sql`. It appears only in `docs/design/ux-spec.md` and Story 6.3 text. Epic 05 is the future writer.

**v1 behaviour:** the `/assets` route does NOT join `evaluator_reports`. Story 6.3's Technical Notes reference to "LEFT JOIN `evaluator_reports`" is **incorrect at v1** and must be amended to read "evaluator status sourced from a future Epic 05 column — render zero-state in v1 per ADR-009 §4 seam."

**Future additive seam:** When Epic 05 ships the table, this route accepts the additive change:

1. New optional response field `evaluator: EvaluatorReportSummary | null` on `AssetSummary` (additive — non-breaking per ADR-007 §5 SemVer).
2. New default behaviour: `include=evaluator` becomes default-on; opt-out via `include=provenance` (without evaluator).
3. No route URL change.
4. Bumps `@zoeplane/shared-types` minor version per ADR-007 §5.

### 5. Cache invalidation contract

Library views subscribe to the SSE stream at `GET /events` and consume `LibraryRefreshEvent` (ADR-007 §1, shipped Story 3.8). The event already carries `kind`, `name`, `scope`, `projectId`, `action` — sufficient for TanStack Query to invalidate `['assets', kind]` or `['assets', kind, scope]`.

**Invalidation strategy for v1:**

- On `LibraryRefreshEvent.action === 'inserted' | 'updated' | 'removed'`: invalidate the cache key `['assets', kind]`.
- On `AssetExternallyModifiedWhileOpenEvent`: the editor renders the FR-006 banner; the Library cache is also invalidated (the underlying row was updated silently per Story 3.8 contract).

**No round-trip on event:** the Library view re-fetches via the cache key — the SSE event itself does not carry asset data. This keeps SSE payload small and avoids divergence between the SSE shape and the `/assets` response.

### 6. Error envelope

Reuse the established sidecar response shape from existing routes:

- `400 Bad Request`: `{ "error": "Bad Request", "message": "<reason>" }` — missing required `kind`, invalid `kind` enum value, invalid `scope` enum value, `scope=project|local` without `projectId`.
- `500 Internal Server Error`: `{ "error": "Internal Server Error" }` — DB query failure (logged via `log("ERROR", ...)` per existing pattern).
- `200 OK` with `truncated: true` rather than a 413 — caller can still render the first 500 rows usefully.

This matches the existing `/projects`, `/preferences`, `/editor/*` routes (see `sidecar/src/index.ts:248-260, 332-336, 598-606`).

### 7. SemVer commitment

Per ADR-007 §5, the `/assets` route shape is locked through v1.0:

- Adding new optional response fields → minor version bump.
- Adding `include=evaluator` (§4 seam) → minor version bump.
- Renaming or removing any current field → major version bump + Story 6.x amendment coordination.
- The Story 6.3 LEFT-JOIN-on-`evaluator_reports` text is corrected to reference this seam (see §Consequences).

## Consequences

**Positive:**

- All four Epic 06 stories (6.2 / 6.3 / 6.6 / 6.10) consume one route with one response shape.
- `front_matter_json` parsing is centralised; client components receive typed objects.
- The Epic 05 evaluator JOIN has a documented additive landing path — no rework when it ships.
- CR-4 carryover (`asset_provenance.asset_id` index) lands as part of Story 6.2 — the actual first consumer — rather than orphan-deferred to Story 6.3.
- Story 6.3 Technical Notes correction unblocks its Phase 0.5b on the same shape.

**Negative:**

- Story 6.3's existing LEFT-JOIN-on-`evaluator_reports` Technical Note is incorrect at v1 and must be amended. This ADR is the binding correction.
- `/assets` returns the full row set (no pagination). At >500 rows the response is truncated; we accept this trade-off for v1 because FR-002 / FR-010 cap real libraries at 100.

**Neutral:**

- The SSE event surface (ADR-007 §1) is unchanged. `LibraryRefreshEvent` payload is sufficient for TanStack invalidation without any new IPC event.
- `IPC-API.md` (OSS public doc) gains a new `/assets` section at the next `/code-doc` run.

## Risks

**R-1: `evaluator_reports` schema lock-in.**
Until Epic 05 lands, we do not know the exact `evaluator_reports` column set. The §4 seam commits to `evaluator: EvaluatorReportSummary | null` as an additive field — but the exact shape of `EvaluatorReportSummary` is TBD. Mitigation: when Epic 05 design completes, write a follow-up ADR that defines the type, and verify it can be added without breaking the §2 response shape.

**R-2: `front_matter_json` shape variance across kinds.**
Skills, agents, commands have different front-matter contracts (different required fields). `frontMatter: Record<string, unknown> | null` is intentionally loose — clients narrow per kind. This is the same pattern as the `payload: unknown` discriminated union in `RunEvent`. Risk: clients pass the raw object into render code without runtime validation. Mitigation: each Library card component validates its own required fields and renders the warning indicator when fields are missing (FR-002 / FR-010 already require this).

**R-3: Truncation visibility.**
At >500 rows the response truncates. A user with 600 commands sees only 500 cards. The UI should surface `response.truncated === true` as a banner ("Showing first 500 of N. Add filters to narrow."). Sprint-programmer should add this to Story 6.6's brief (commands cross both scopes and could plausibly grow large in long-lived projects).

## Relationship to Prior ADRs

- **ADR-005** (Watcher Layer): The watcher emits the `LibraryRefreshEvent` that invalidates the `/assets` cache. Complementary — ADR-005 owns the event-emission layer, ADR-009 owns the query layer.
- **ADR-007** (Epic 03 IPC Contract): Locks the SSE event shapes. ADR-009 is the read-side counterpart — it locks the HTTP query shape. The two together define Epic 06's full data contract. ADR-009 inherits ADR-007's SemVer policy.
- **ADR-008** (Front-matter Parsing Strategy): Owns the `front_matter_json` text format. ADR-009 owns the server-side parse of that text into the response object — i.e. it consumes ADR-008's output.
- **ADR-001 through ADR-004, ADR-006**: Orthogonal.
