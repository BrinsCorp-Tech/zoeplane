/**
 * GET /assets route handler — Epic 06 Library Views (Story 6.2 / ADR-009).
 *
 * Extracted to its own module so the query logic can be unit-tested without
 * spinning up the full Bun.serve instance or its side-effecting startup code.
 *
 * Contract: ADR-009 §1/§2/§3/§6 (locked through v1.0.0 per §7).
 */

import type { Database } from "bun:sqlite";
import { log } from "../log";

// ---------------------------------------------------------------------------
// Enum allowlists (ADR-009 §1)
// ---------------------------------------------------------------------------

const VALID_KINDS = ["skill", "agent", "command", "team", "workflow"] as const;
const VALID_SCOPES = ["global", "project", "local"] as const;

type AssetKind = (typeof VALID_KINDS)[number];
type AssetScope = (typeof VALID_SCOPES)[number];

// ---------------------------------------------------------------------------
// DB row shape returned by the LEFT JOIN query (ADR-009 §3)
// ---------------------------------------------------------------------------

interface AssetRow {
  id: string;
  kind: string;
  name: string;
  scope: string;
  project_id: string | null;
  source_path: string;
  validation_status: string;
  last_modified_at: number;
  last_modified_by: string;
  front_matter_json: string | null;
  body_excerpt: string | null;
  provenance_id: string | null;
  provenance_source_url: string | null;
  provenance_source_hash: string | null;
  provenance_imported_at: number | null;
  provenance_evaluator_report_id: string | null;
  provenance_last_evaluated_at: number | null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handle GET /assets requests.
 *
 * @param searchParams - URL search params from the incoming request
 * @param db           - Open bun:sqlite Database instance
 * @returns Response with AssetsResponse body (ADR-009 §2) or a 400/500 error envelope.
 */
export function handleGetAssets(searchParams: URLSearchParams, db: Database): Response {
  const kind = searchParams.get("kind");
  const scope = searchParams.get("scope");
  const projectId = searchParams.get("projectId");

  // Validate kind (required)
  if (kind === null || kind === "") {
    return Response.json(
      { error: "Bad Request", message: "Query param 'kind' is required" },
      { status: 400 },
    );
  }
  if (!(VALID_KINDS as readonly string[]).includes(kind)) {
    return Response.json(
      {
        error: "Bad Request",
        message: `Query param 'kind' must be one of: ${VALID_KINDS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Validate scope (optional)
  if (scope !== null && !(VALID_SCOPES as readonly string[]).includes(scope)) {
    return Response.json(
      {
        error: "Bad Request",
        message: `Query param 'scope' must be one of: ${VALID_SCOPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Validate projectId requirement when scope=project|local
  if ((scope === "project" || scope === "local") && !projectId) {
    return Response.json(
      {
        error: "Bad Request",
        message: "Query param 'projectId' is required when scope is 'project' or 'local'",
      },
      { status: 400 },
    );
  }

  // Build SQL dynamically — ADR-009 §3 exact query + conditional WHERE clauses.
  // LIMIT 501: lets us detect >500 truncation without an extra COUNT query.
  const whereClauses: string[] = [
    "a.deleted_at IS NULL",
    "a.shadowed_by_project_id IS NULL",
    "a.kind = ?",
  ];
  const params: (string | null)[] = [kind as AssetKind];

  if (scope !== null) {
    whereClauses.push("a.scope = ?");
    params.push(scope as AssetScope);
  }

  if (projectId !== null && projectId !== "") {
    whereClauses.push("a.project_id = ?");
    params.push(projectId);
  }

  const sql = `
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
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY a.kind ASC, a.scope ASC, a.name ASC
    LIMIT 501
  `;

  let rows: AssetRow[];
  try {
    rows = db.query<AssetRow, (string | null)[]>(sql).all(...params);
  } catch (err) {
    log("ERROR", "Sidecar: GET /assets query failed", { kind, scope, error: String(err) });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }

  // Soft cap logic: >500 rows → truncated, slice to 500
  const truncated = rows.length > 500;
  // totalCount = actual row count returned by DB (before slicing)
  const totalCount = rows.length;
  const slicedRows = truncated ? rows.slice(0, 500) : rows;

  const assets = slicedRows.map((row) => {
    // Server-side JSON.parse of front_matter_json; null on failure per ADR-009 §2
    let frontMatter: Record<string, unknown> | null = null;
    if (row.front_matter_json !== null && row.front_matter_json !== "") {
      try {
        const parsed: unknown = JSON.parse(row.front_matter_json);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          frontMatter = parsed as Record<string, unknown>;
        }
      } catch {
        // Parse failure → frontMatter stays null per ADR-009 §2
      }
    }

    const provenance =
      row.provenance_id !== null
        ? {
            id: row.provenance_id,
            sourceUrl: row.provenance_source_url ?? "",
            sourceHash: row.provenance_source_hash ?? "",
            importedAt: row.provenance_imported_at ?? 0,
            evaluatorReportId: row.provenance_evaluator_report_id,
            lastEvaluatedAt: row.provenance_last_evaluated_at,
          }
        : null;

    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      scope: row.scope,
      projectId: row.project_id,
      sourcePath: row.source_path,
      validationStatus: row.validation_status,
      lastModifiedAt: row.last_modified_at,
      lastModifiedBy: row.last_modified_by,
      frontMatter,
      bodyExcerpt: row.body_excerpt,
      provenance,
    };
  });

  return Response.json({ assets, truncated, totalCount }, { status: 200 });
}
