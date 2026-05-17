// ZoePlane Sidecar — Validation pipeline
//
// Parses YAML front-matter + markdown body for every asset in the `assets`
// table and persists the parse outcome to `validation_status` and
// `front_matter_json`.
//
// Story: 3.5 — Validation pipeline (FR-031, FR-032)
//
// === Architecture ===
//
//   runValidationPipeline(db) — cold-launch full-table UPDATE pass.
//     Called from index.ts after runColdLaunchScan() resolves.
//     Wraps all UPDATEs in a single SQLite transaction for performance.
//     Emits ValidationCompletedEvent over IPC when done.
//
//   revalidateAsset(db, sourcePath, kind) — per-event single-row UPDATE.
//     Called from index.ts when an AssetIndexUpdatedEvent arrives for a
//     created or modified asset. Removed events are a NO-OP (guard below).
//     Emits AssetValidationUpdatedEvent over IPC.
//
// === Parse semantics ===
//
//   "valid"    — YAML front-matter present + parses to object + non-empty body
//   "warnings" — front-matter parses OK but recommended fields are missing,
//                OR file size > 1 MB (defense against pathological inputs)
//   "invalid"  — malformed YAML, missing delimiters, or zero body content
//
//   Parse failures are non-blocking: the row stays in the index (FR-031).
//   Project-scoped assets use identical parse logic (FR-032).
//
// === Parser dependency fallback ===
//
//   If gray-matter cannot be loaded at runtime (import error), the pipeline
//   falls back: every row is set to validation_status='valid' with
//   front_matter_json=NULL and a ValidationFallbackWarning event is emitted.

import { Database } from "bun:sqlite";
import { stat, readFile } from "node:fs/promises";
import { log } from "../log";
import {
  VALIDATION_COMPLETED,
  ASSET_VALIDATION_UPDATED,
  type ValidationCompletedEvent,
  type AssetValidationUpdatedEvent,
  type WatcherEvent,
} from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum file size in bytes before parsing is skipped (1 MB). */
const MAX_FILE_SIZE_BYTES = 1_048_576;

// ---------------------------------------------------------------------------
// Per-kind recommended field warning rules
// ---------------------------------------------------------------------------

type ResourceKind = "skill" | "agent" | "command" | "team" | "workflow";

interface WarningRule {
  /** Field name in front-matter. */
  field: string;
  /** Human-readable warning category string stored in logs. */
  category: string;
}

/** Recommended fields per kind. Absence produces a `warnings` status. */
const KIND_WARNING_RULES: Record<ResourceKind, WarningRule[]> = {
  skill: [
    { field: "description", category: "missing-description" },
    { field: "version", category: "missing-version" },
  ],
  agent: [
    { field: "description", category: "missing-description" },
    { field: "voice", category: "missing-voice" },
  ],
  command: [
    { field: "description", category: "missing-description" },
    { field: "triggers", category: "missing-triggers" },
    { field: "execution_mode", category: "missing-execution-mode" },
  ],
  team: [{ field: "members", category: "missing-members" }],
  workflow: [{ field: "steps", category: "missing-steps" }],
};

// ---------------------------------------------------------------------------
// Parse result
// ---------------------------------------------------------------------------

type ValidationStatus = "valid" | "warnings" | "invalid";

interface ParseResult {
  status: ValidationStatus;
  frontMatterJson: string | null;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Event emission — mirrors scanner.ts subscriber pattern
// ---------------------------------------------------------------------------

const eventSubscribers = new Set<(event: WatcherEvent) => void>();

/**
 * Register a subscriber to receive validator events
 * (ValidationCompletedEvent, AssetValidationUpdatedEvent).
 * Returns an unsubscribe function. Same API as subscribeToScannerEvents.
 */
export function subscribeToValidatorEvents(callback: (event: WatcherEvent) => void): () => void {
  eventSubscribers.add(callback);
  return () => {
    eventSubscribers.delete(callback);
  };
}

function emit(event: WatcherEvent): void {
  for (const sub of eventSubscribers) {
    try {
      sub(event);
    } catch (err) {
      log("WARN", "Validator: subscriber threw during event emission", {
        eventType: event.type,
        error: String(err),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// gray-matter dynamic import + fallback
// ---------------------------------------------------------------------------

type MatterFn = (content: string) => { data: Record<string, unknown>; content: string };

let matterFn: MatterFn | null = null;
let grayMatterLoadAttempted = false;

/**
 * Lazily load gray-matter. Returns the matter() function on success, or null
 * if the module cannot be imported (triggers fallback mode in callers).
 */
async function loadGrayMatter(): Promise<MatterFn | null> {
  if (grayMatterLoadAttempted) {
    return matterFn;
  }
  grayMatterLoadAttempted = true;
  try {
    // gray-matter ships its own .d.ts — the default export is the matter() function.
    const mod = await import("gray-matter");
    // gray-matter exports itself as a CJS default; dynamic import wraps it in `.default`.
    matterFn = (mod.default ?? mod) as unknown as MatterFn;
    return matterFn;
  } catch (err) {
    log("ERROR", "Validator: failed to import gray-matter — falling back to passthrough mode", {
      error: String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core parse logic
// ---------------------------------------------------------------------------

/**
 * Parse a single asset file's front-matter and body.
 *
 * Returns a ParseResult with:
 *   - status: "valid" | "warnings" | "invalid"
 *   - frontMatterJson: JSON string or null
 *   - warnings: list of warning category strings
 *
 * Size cap: files > 1 MB return status="warnings" immediately without parsing.
 */
async function parseAssetFile(
  sourcePath: string,
  kind: ResourceKind,
  matter: MatterFn,
): Promise<ParseResult> {
  // --- Size guard (1 MB cap) ---
  let fileSize: number;
  try {
    const stats = await stat(sourcePath);
    fileSize = stats.size;
  } catch (err) {
    log("WARN", "Validator: failed to stat asset file — treating as invalid", {
      path: sourcePath,
      error: String(err),
    });
    return { status: "invalid", frontMatterJson: null, warnings: ["stat-failed"] };
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    log("WARN", "Validator: asset file exceeds 1 MB cap — skipping parse", {
      path: sourcePath,
      kind,
      sizeBytes: fileSize,
    });
    return {
      status: "warnings",
      frontMatterJson: null,
      warnings: ["file-too-large"],
    };
  }

  // --- Read file ---
  let content: string;
  try {
    content = await readFile(sourcePath, "utf-8");
  } catch (err) {
    log("WARN", "Validator: failed to read asset file — treating as invalid", {
      path: sourcePath,
      error: String(err),
    });
    return { status: "invalid", frontMatterJson: null, warnings: ["read-failed"] };
  }

  // --- Parse with gray-matter ---
  let parsed: { data: Record<string, unknown>; content: string };
  try {
    parsed = matter(content);
  } catch (err) {
    log("INFO", "Validator: gray-matter parse failure — marking invalid", {
      path: sourcePath,
      error: String(err),
    });
    return { status: "invalid", frontMatterJson: null, warnings: ["yaml-parse-error"] };
  }

  // --- Validate front-matter presence ---
  // gray-matter returns an empty object for `data` when no front-matter delimiters
  // are found. We distinguish three cases:
  //   1. No opening --- delimiter at all → "invalid" (missing front-matter).
  //   2. Delimiters present but YAML block is empty (---\n---\n<body>) → "warnings"
  //      (author signalled intent to add front-matter but left it blank; FR-031
  //      maps this to warnings, not invalid, because the delimiters are not malformed).
  //   3. Delimiters present AND YAML parsed to a non-empty object → continue.
  const hasDelimiters = content.trimStart().startsWith("---");
  if (!hasDelimiters) {
    // Case 1: no front-matter at all → invalid.
    log("INFO", "Validator: asset file has no front-matter delimiters — marking invalid", {
      path: sourcePath,
      kind,
    });
    return { status: "invalid", frontMatterJson: null, warnings: ["no-front-matter"] };
  }
  if (Object.keys(parsed.data).length === 0) {
    // Case 2: delimiters present but empty YAML block → warnings.
    // Preserve the empty-object parse outcome as front_matter_json='{}' so callers
    // know delimiters were detected. Treating this as warnings (not invalid) aligns
    // with FR-031: "invalid" is reserved for malformed YAML or missing delimiters.
    log("INFO", "Validator: asset file has empty front-matter block — marking warnings", {
      path: sourcePath,
      kind,
    });
    return { status: "warnings", frontMatterJson: "{}", warnings: ["empty-front-matter"] };
  }

  // --- Validate body content ---
  const trimmedBody = parsed.content.trim();
  if (trimmedBody.length === 0) {
    log("INFO", "Validator: asset file has empty body — marking invalid", {
      path: sourcePath,
      kind,
    });
    return { status: "invalid", frontMatterJson: null, warnings: ["empty-body"] };
  }

  // --- Name-match check ---
  // Warning if front-matter `name` field doesn't match the directory name.
  // For direct-md kinds (agent, command) the name may include a subdir prefix
  // (e.g. "consider/first-principles"); we compare only the basename segment.
  const warnings: string[] = [];
  const fmData = parsed.data;

  // Check name mismatch for skills and agents where the name is a single token.
  if (typeof fmData.name === "string" && fmData.name.length > 0) {
    // Derive the expected name from the source path. We use the last path
    // component before the canonical file (for subdir-canonical) or the
    // basename-without-ext (for direct-md). Since this is cosmetic, we
    // do a simple basename extraction.
    const parts = sourcePath.replaceAll("\\", "/").split("/");
    let expectedName: string;
    if (kind === "skill" || kind === "team" || kind === "workflow") {
      // subdir-canonical: path ends with <name>/<CANONICAL_FILE>
      expectedName = parts[parts.length - 2] ?? "";
    } else {
      // direct-md: path ends with <name>.md
      const basename = parts[parts.length - 1] ?? "";
      expectedName = basename.endsWith(".md") ? basename.slice(0, -3) : basename;
    }
    if (expectedName && fmData.name !== expectedName) {
      warnings.push("name-mismatch");
    }
  }

  // --- Per-kind recommended field checks ---
  const rules = KIND_WARNING_RULES[kind] ?? [];
  for (const rule of rules) {
    const value = fmData[rule.field];
    const isMissing =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    if (isMissing) {
      warnings.push(rule.category);
    }
  }

  const frontMatterJson = JSON.stringify(fmData);

  if (warnings.length > 0) {
    log("INFO", "Validator: asset parsed with warnings", {
      path: sourcePath,
      kind,
      warnings,
    });
    return { status: "warnings", frontMatterJson, warnings };
  }

  log("INFO", "Validator: asset parsed as valid", { path: sourcePath, kind });
  return { status: "valid", frontMatterJson, warnings: [] };
}

// ---------------------------------------------------------------------------
// DB row type for validation pass
// ---------------------------------------------------------------------------

interface AssetValidationRow {
  id: string;
  source_path: string;
  kind: string;
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export interface ValidationTotals {
  valid: number;
  warnings: number;
  invalid: number;
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// Public API — runValidationPipeline (cold-launch full-table pass)
// ---------------------------------------------------------------------------

/**
 * Run the full validation pipeline over every row in the `assets` table.
 *
 * Called from index.ts after runColdLaunchScan() resolves. Updates
 * `validation_status` and `front_matter_json` for every row regardless of
 * `created_at` — re-stamps on every launch (cold-launch rows may have been
 * inserted by a previous run via INSERT OR IGNORE, so we cannot filter by
 * created_at=now).
 *
 * All UPDATEs run inside a single SQLite transaction. Emits
 * ValidationCompletedEvent when done.
 *
 * @param db              Open bun:sqlite Database instance.
 * @param _matterOverride Test-only injection. Pass `null` to force the
 *                        gray-matter fallback path. Pass `undefined` (default)
 *                        to use the normal lazy loader. Never pass a value in
 *                        production code.
 */
export async function runValidationPipeline(
  db: Database,
  _matterOverride?: MatterFn | null,
): Promise<ValidationTotals> {
  const startMs = Date.now();

  log("INFO", "Validator: cold-launch validation pipeline starting");

  // Load gray-matter (lazy, cached). If it fails, emit fallback warning and return.
  // Test-only: _matterOverride === null forces the fallback path; undefined = normal load.
  const matter = _matterOverride === undefined ? await loadGrayMatter() : _matterOverride;

  if (matter === null) {
    // Fallback mode: set all rows to valid + NULL front_matter_json.
    log("WARN", "Validator: gray-matter unavailable — emitting fallback warning, skipping parse");

    let rowCount = 0;
    try {
      const rows = db
        .query<{ id: string }, []>("SELECT id FROM assets WHERE deleted_at IS NULL")
        .all();
      rowCount = rows.length;

      const fallbackStmt = db.prepare(
        "UPDATE assets SET validation_status='valid', front_matter_json=NULL, updated_at=? WHERE id=?",
      );
      const fallbackTx = db.transaction((assetRows: { id: string }[]) => {
        const now = Date.now();
        for (const row of assetRows) {
          fallbackStmt.run(now, row.id);
        }
      });
      fallbackTx(rows);
    } catch (err) {
      log("ERROR", "Validator: fallback mode — failed to update rows", { error: String(err) });
    }

    // Emit ValidationFallbackWarning (uses ValidationCompletedEvent channel with fallback flag).
    const fallbackEvent = {
      type: VALIDATION_COMPLETED,
      valid: rowCount,
      warnings: 0,
      invalid: 0,
      elapsedMs: Date.now() - startMs,
      fallback: true,
    } as ValidationCompletedEvent;
    emit(fallbackEvent);

    return { valid: rowCount, warnings: 0, invalid: 0, elapsedMs: Date.now() - startMs };
  }

  // --- Fetch all asset rows needing validation ---
  let assetRows: AssetValidationRow[] = [];
  try {
    assetRows = db
      .query<
        AssetValidationRow,
        []
      >("SELECT id, source_path, kind FROM assets WHERE deleted_at IS NULL")
      .all();
  } catch (err) {
    log("ERROR", "Validator: failed to query assets table", { error: String(err) });
    const elapsedMs = Date.now() - startMs;
    const event: ValidationCompletedEvent = {
      type: VALIDATION_COMPLETED,
      valid: 0,
      warnings: 0,
      invalid: 0,
      elapsedMs,
      fallback: false,
    };
    emit(event);
    return { valid: 0, warnings: 0, invalid: 0, elapsedMs };
  }

  log("INFO", "Validator: parsing asset rows", { count: assetRows.length });

  // --- Parse all files concurrently ---
  const parseResults = await Promise.all(
    assetRows.map(async (row) => {
      const kind = row.kind as ResourceKind;
      const result = await parseAssetFile(row.source_path, kind, matter);
      return { id: row.id, result };
    }),
  );

  // --- Batch UPDATE inside a single transaction ---
  const updateStmt = db.prepare(
    "UPDATE assets SET validation_status=?, front_matter_json=?, updated_at=? WHERE id=?",
  );

  const totals = { valid: 0, warnings: 0, invalid: 0 };

  // Synchronous transaction closure — bun:sqlite transactions are not async.
  // Mutating `totals` from inside the closure is safe because the transaction
  // runs to completion before the outer function resumes.
  const updateTx = db.transaction((rows: Array<{ id: string; result: ParseResult }>) => {
    const now = Date.now();
    for (const { id, result } of rows) {
      updateStmt.run(result.status, result.frontMatterJson, now, id);
      totals[result.status]++;
    }
  });

  updateTx(parseResults);

  const elapsedMs = Date.now() - startMs;

  log("INFO", "Validator: cold-launch validation pipeline complete", { ...totals, elapsedMs });

  // --- Emit ValidationCompletedEvent ---
  const completedEvent: ValidationCompletedEvent = {
    type: VALIDATION_COMPLETED,
    valid: totals.valid,
    warnings: totals.warnings,
    invalid: totals.invalid,
    elapsedMs,
    fallback: false,
  };
  emit(completedEvent);

  return { ...totals, elapsedMs };
}

// ---------------------------------------------------------------------------
// Public API — revalidateAsset (per-event single-row UPDATE)
// ---------------------------------------------------------------------------

/**
 * Asset kinds accepted by revalidateAsset. Hooks live in hook_index, not in
 * the assets table, so they are explicitly excluded here to prevent silent
 * misrouting at compile time.
 */
type AssetKind = Exclude<ResourceKind, never>; // all ResourceKind values are already non-hook

/**
 * Re-parse a single asset file and update its `validation_status` and
 * `front_matter_json` in the `assets` table.
 *
 * Called from the watcher event subscriber in index.ts when an
 * AssetIndexUpdatedEvent arrives with eventKind "created" or "modified".
 *
 * REMOVED events MUST NOT call this function — the guard belongs in the
 * subscriber in index.ts. If called for a removed path the stat() will fail
 * and the row will be marked "invalid" (defensive, but avoid the call).
 *
 * Emits AssetValidationUpdatedEvent over IPC after the UPDATE.
 *
 * @param db              Open bun:sqlite Database instance.
 * @param sourcePath      Absolute path to the asset file (from AssetIndexUpdatedEvent.path).
 * @param kind            Asset kind (from pathToAssetIdentifier result). Must not be "hook" —
 *                        hooks are stored in hook_index, not assets.
 * @param _matterOverride Test-only injection. Pass `null` to force the fallback path.
 *                        Pass `undefined` (default) to use the normal lazy loader.
 */
export async function revalidateAsset(
  db: Database,
  sourcePath: string,
  kind: AssetKind,
  _matterOverride?: MatterFn | null,
): Promise<void> {
  log("INFO", "Validator: per-event revalidation triggered", { sourcePath, kind });

  // Load gray-matter (lazy, cached).
  // Test-only: _matterOverride === null forces the fallback path; undefined = normal load.
  const matter = _matterOverride === undefined ? await loadGrayMatter() : _matterOverride;

  let status: ValidationStatus;
  let frontMatterJson: string | null;

  if (matter === null) {
    // Fallback: mark valid, no front-matter data.
    status = "valid";
    frontMatterJson = null;
    log("WARN", "Validator: gray-matter unavailable — per-event revalidation in fallback mode", {
      sourcePath,
    });
  } else {
    const result = await parseAssetFile(sourcePath, kind, matter);
    status = result.status;
    frontMatterJson = result.frontMatterJson;
  }

  // Look up the row by source_path to get its ID for the event payload.
  interface AssetIdRow {
    id: string;
  }
  const assetRow = db
    .query<
      AssetIdRow,
      [string]
    >("SELECT id FROM assets WHERE source_path = ? AND deleted_at IS NULL LIMIT 1")
    .get(sourcePath);

  if (assetRow === null) {
    log("WARN", "Validator: per-event revalidation — no row found for source_path (removed?)", {
      sourcePath,
    });
    return;
  }

  // UPDATE the row.
  const now = Date.now();
  db.query(
    "UPDATE assets SET validation_status=?, front_matter_json=?, updated_at=? WHERE id=?",
  ).run(status, frontMatterJson, now, assetRow.id);

  log("INFO", "Validator: per-event revalidation complete", {
    sourcePath,
    kind,
    status,
    assetId: assetRow.id,
  });

  // Emit AssetValidationUpdatedEvent.
  const updatedEvent: AssetValidationUpdatedEvent = {
    type: ASSET_VALIDATION_UPDATED,
    assetId: assetRow.id,
    sourcePath,
    kind,
    validationStatus: status,
  };
  emit(updatedEvent);
}
