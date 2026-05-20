/**
 * Epic 06 — Library Views shared types.
 *
 * Locked surface per ADR-009 §7 (SemVer commitment through v1.0.0).
 * Adding optional fields is a minor version bump.
 * Renaming or removing any current field is a major version bump.
 *
 * Story: 6.2 — Agent Library + AgentCard
 */

// ============================================================
// GET /assets response shape (ADR-009 §2)
// ============================================================

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
