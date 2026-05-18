// ZoePlane Sidecar — Cold-launch asset scanner
//
// Enumerates ~/.claude/{skills,agents,commands,teams,workflows}/ and each
// tracked project's equivalent subtrees, then hydrates the `assets` SQLite
// table with one row per discovered asset file.
//
// Story: 3.3 — Cold-launch asset scan + index hydration (FR-001, FR-068, FR-032 partial)
//
// === Per-kind canonical file conventions (verified against live ~/.claude/) ===
//
//   skills/    → subdirectory per skill, canonical file is <subdir>/SKILL.md
//   agents/    → direct .md files (e.g. architect.md); name = basename without ext
//   commands/  → direct .md files (e.g. code-audit.md) OR subdirectories of .md
//                files (e.g. consider/first-principles.md); both are indexed with
//                name = relative path without ext (e.g. "consider/first-principles")
//   teams/     → subdirectory per team, canonical file is <subdir>/TEAM.md
//                (directory may not exist in fresh installs — skipped without error)
//   workflows/ → subdirectory per workflow, canonical file is <subdir>/WORKFLOW.md
//                (directory may not exist in fresh installs — skipped without error)
//
// The story AC specifies a subdir/<KIND>.md pattern for all five kinds; agents
// and commands use direct .md files in practice. The scanner reflects actual disk
// layout per the story instruction: "if a kind uses a different convention,
// document in story implementation notes and reflect in the scanner."
//
// === Idempotency ===
// `ON CONFLICT DO NOTHING` against the dual partial unique index from Story 3.1
// makes re-launch safe — re-scanning after a restart never duplicates rows.
//
// === Transaction shape ===
// A single bun:sqlite transaction wraps all INSERTs across all kinds and all
// project roots. One prepared statement per kind is reused for each row.
//
// === Performance ===
// Kind-root enumeration runs concurrently via Promise.all (AC-6 / 1000 ms target).
// The transaction commits once after all inserts are collected.

import { Database } from "bun:sqlite";
import { homedir } from "node:os";
import { join, resolve, extname } from "node:path";
import { readdir, readFile, stat, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { log } from "../log";
import { pathToAssetIdentifier } from "./naming";
import {
  ASSET_INDEX_HYDRATED,
  type AssetIndexHydratedEvent,
  type WatcherEvent,
} from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// FR-068 v1 single-workspace defaults
// ---------------------------------------------------------------------------

const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_AUTHOR_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_VISIBILITY = "private" as const;

// ---------------------------------------------------------------------------
// Kind definitions
// ---------------------------------------------------------------------------

/** How a kind's asset files are laid out on disk. */
type KindLayout = "subdir-canonical" | "direct-md";

interface KindDef {
  kind: "skill" | "agent" | "command" | "team" | "workflow";
  /** Directory name under ~/.claude/ (or <project>/.claude/). */
  dirName: string;
  /** Disk layout convention. */
  layout: KindLayout;
  /**
   * Canonical filename for `subdir-canonical` layout (e.g. "SKILL.md").
   * Unused for `direct-md` layout.
   */
  canonicalFile?: string;
}

const KIND_DEFS: KindDef[] = [
  { kind: "skill", dirName: "skills", layout: "subdir-canonical", canonicalFile: "SKILL.md" },
  { kind: "agent", dirName: "agents", layout: "direct-md" },
  { kind: "command", dirName: "commands", layout: "direct-md" },
  { kind: "team", dirName: "teams", layout: "subdir-canonical", canonicalFile: "TEAM.md" },
  {
    kind: "workflow",
    dirName: "workflows",
    layout: "subdir-canonical",
    canonicalFile: "WORKFLOW.md",
  },
];

// ---------------------------------------------------------------------------
// Body excerpt helpers
// ---------------------------------------------------------------------------

/**
 * Strip YAML front-matter from markdown content and return the body.
 *
 * Front-matter is `---\n…content…\n---\n` (or `---\r\n…\r\n---\r\n`)
 * at the very start of the file. If present, returns everything after
 * the closing `---` line. If absent, returns the full content unchanged.
 *
 * No YAML parsing occurs — Story 3.5 owns parsing. This is a fast-path
 * lexer for the cold-launch perf budget.
 */
function stripFrontMatter(content: string): string {
  if (!content.startsWith("---")) {
    return content;
  }
  // Find the newline after the opening ---
  const firstNewline = content.indexOf("\n");
  if (firstNewline === -1) {
    return content;
  }
  // Find the closing --- on its own line.
  // The search string is "\n---" (LF prefix) even for CRLF files because the
  // opening `---` check consumed only the three hyphens; any preceding \r
  // became part of the front-matter body and the next \n is always present.
  // CRLF files still match because the \n is the canonical line-boundary
  // character — the optional \r is handled in the body-start calculation below.
  const closingMarker = "\n---";
  const closingIdx = content.indexOf(closingMarker, firstNewline);
  if (closingIdx === -1) {
    return content;
  }
  // Skip past the closing --- line (and any trailing \r\n or \n)
  const afterClosing = closingIdx + closingMarker.length;
  if (afterClosing >= content.length) {
    return "";
  }
  const nextChar = content[afterClosing];
  const bodyStart =
    nextChar === "\r" && content[afterClosing + 1] === "\n"
      ? afterClosing + 2
      : nextChar === "\n"
        ? afterClosing + 1
        : afterClosing;
  return content.slice(bodyStart);
}

/**
 * Extract the first 500 characters of a file's body (front-matter stripped).
 * Truncation is at JS string character boundary (safe for UTF-16 / Unicode BMP).
 * Surrogate pairs (emoji etc.) are not split because JS `.slice()` operates on
 * code-unit boundaries — acceptable for an excerpt field.
 */
function bodyExcerpt(content: string): string {
  const body = stripFrontMatter(content);
  return body.slice(0, 500);
}

// ---------------------------------------------------------------------------
// Per-kind enumeration
// ---------------------------------------------------------------------------

/** A single asset file discovered on disk. */
interface AssetFile {
  kind: "skill" | "agent" | "command" | "team" | "workflow";
  name: string; // Asset name (used as assets.name column)
  sourcePath: string; // Absolute path to the canonical file
}

/**
 * Enumerate all asset files under a single kind root directory.
 *
 * Returns an empty array if the root directory does not exist (AC: skip
 * without error if kind dir is missing).
 */
async function enumerateKindRoot(rootDir: string, def: KindDef): Promise<AssetFile[]> {
  // Check if the root directory exists — absence is not an error (AC-9).
  try {
    await access(rootDir, fsConstants.R_OK);
  } catch {
    return [];
  }

  const results: AssetFile[] = [];

  if (def.layout === "subdir-canonical") {
    // Pattern: <rootDir>/<assetName>/<canonicalFile>
    let dirents;
    try {
      dirents = await readdir(rootDir, { withFileTypes: true });
    } catch (err) {
      log("WARN", "Scanner: failed to readdir kind root", {
        rootDir,
        kind: def.kind,
        error: String(err),
      });
      return [];
    }

    for (const dirent of dirents) {
      if (!dirent.isDirectory()) {
        continue;
      }
      const assetName = dirent.name;
      const canonicalPath = join(rootDir, assetName, def.canonicalFile!);

      // Verify the canonical file exists — missing is not an error (AC-7).
      try {
        await access(canonicalPath, fsConstants.R_OK);
        const absolutePath = resolve(canonicalPath);
        // Use the shared naming helper to derive the canonical (kind, name) pair.
        // This ensures the name stored in the DB matches what resolver.ts looks up.
        const identifier = pathToAssetIdentifier(absolutePath, resolve(join(rootDir, "..")));
        const name = identifier?.name ?? assetName; // fallback to dirName (should never differ)
        results.push({ kind: def.kind, name, sourcePath: absolutePath });
      } catch {
        // AC-7: skip silently — user-in-progress directory creation is legitimate.
      }
    }
  } else {
    // layout === "direct-md"
    // Pattern: <rootDir>/<name>.md  (flat .md files; subdirs of .md files also indexed)
    await enumerateDirectMd(rootDir, rootDir, def.kind, results);
  }

  return results;
}

/**
 * Recursively enumerate direct .md files under `dir`.
 *
 * `rootDir` is the kind root (used to compute the relative name for nested files).
 * Subdirectories are traversed one level deep (commands/consider/*.md pattern).
 * Entries that are directories trigger a single level of recursion so that
 * `commands/consider/first-principles.md` gets name `consider/first-principles`.
 */
async function enumerateDirectMd(
  dir: string,
  rootDir: string,
  kind: "skill" | "agent" | "command" | "team" | "workflow",
  results: AssetFile[],
  depth = 0,
): Promise<void> {
  let dirents;
  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    log("WARN", "Scanner: failed to readdir for direct-md enumeration", {
      dir,
      kind,
      error: String(err),
    });
    return;
  }

  for (const dirent of dirents) {
    if (dirent.isDirectory() && depth === 0) {
      // One level of subdirectory recursion (e.g. commands/consider/).
      await enumerateDirectMd(join(dir, dirent.name), rootDir, kind, results, depth + 1);
    } else if (dirent.isFile() && extname(dirent.name) === ".md") {
      const absolutePath = resolve(join(dir, dirent.name));
      // Use the shared naming helper to derive the canonical (kind, name) pair.
      // This ensures the name stored in the DB matches what resolver.ts looks up.
      // The claudeRoot for the helper is the parent of the kind root directory.
      // E.g. rootDir=~/.claude/commands → claudeRoot=~/.claude/
      //   absolutePath=~/.claude/commands/consider/first-principles.md
      //   → identifier.name = "consider/first-principles"
      const claudeRoot = resolve(join(rootDir, ".."));
      const identifier = pathToAssetIdentifier(absolutePath, claudeRoot);
      if (identifier === null) {
        // Path didn't match any known kind (shouldn't happen here — defensive).
        continue;
      }
      const name = identifier.name;

      // Verify readability before adding — permission denied is a WARN + skip (AC-8).
      // Note: this path does not exercise symlinks at the individual-file level
      // because PAI does not currently symlink individual agent or command files
      // (it symlinks entire kind *directories* instead, which is covered by the
      // `followSymlinks: true` setting on the chokidar watcher in Story 3.2).
      try {
        await access(absolutePath, fsConstants.R_OK);
        results.push({ kind, name, sourcePath: absolutePath });
      } catch (err) {
        log("WARN", "Scanner: cannot read asset file — skipping", {
          path: absolutePath,
          kind,
          error: String(err),
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// File metadata + body
// ---------------------------------------------------------------------------

interface FileMetadata {
  mtimeMs: number;
  bodyExcerptText: string;
}

async function readFileMetadata(filePath: string): Promise<FileMetadata | null> {
  try {
    const [stats, content] = await Promise.all([stat(filePath), readFile(filePath, "utf-8")]);
    return {
      mtimeMs: Math.round(stats.mtimeMs),
      bodyExcerptText: bodyExcerpt(content),
    };
  } catch (err) {
    log("WARN", "Scanner: failed to read asset file metadata — skipping", {
      path: filePath,
      error: String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Event emission — mirrors the watcher.ts subscriber pattern
// ---------------------------------------------------------------------------

const eventSubscribers = new Set<(event: WatcherEvent) => void>();

/**
 * Register a subscriber to receive scanner events (AssetIndexHydratedEvent).
 * Returns an unsubscribe function. Same API as watcher's subscribeToWatcherEvents.
 */
export function subscribeToScannerEvents(callback: (event: WatcherEvent) => void): () => void {
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
      log("WARN", "Scanner: subscriber threw during event emission", {
        eventType: event.type,
        error: String(err),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Row building + INSERT
// ---------------------------------------------------------------------------

interface AssetRow {
  id: string;
  workspace_id: string;
  author_id: string;
  visibility: string;
  created_at: number;
  updated_at: number;
  deleted_at: null;
  kind: string;
  name: string;
  scope: string;
  project_id: string | null;
  source_path: string;
  validation_status: string;
  shadowed_by_project_id: null;
  last_modified_by: string;
  last_modified_at: number;
  front_matter_json: null;
  body_excerpt: string;
}

const INSERT_SQL = `
  INSERT OR IGNORE INTO assets (
    id, workspace_id, author_id, visibility,
    created_at, updated_at, deleted_at,
    kind, name, scope, project_id, source_path,
    validation_status, shadowed_by_project_id,
    last_modified_by, last_modified_at,
    front_matter_json, body_excerpt
  ) VALUES (
    $id, $workspace_id, $author_id, $visibility,
    $created_at, $updated_at, $deleted_at,
    $kind, $name, $scope, $project_id, $source_path,
    $validation_status, $shadowed_by_project_id,
    $last_modified_by, $last_modified_at,
    $front_matter_json, $body_excerpt
  )
`;

// ---------------------------------------------------------------------------
// Public API — insertAssetRow (single-file INSERT helper for event-router)
// ---------------------------------------------------------------------------

/**
 * Insert a single asset row into the `assets` table.
 *
 * Uses `INSERT OR IGNORE` for idempotency — if a row already exists for the
 * given `source_path` (e.g., the cold-launch scan already indexed it), this
 * is a silent no-op. Callers that need UPDATE semantics should use the
 * validation pipeline's `revalidateAsset` instead.
 *
 * Called by the event-router (Story 3.8) when an AssetIndexUpdatedEvent
 * arrives with eventKind "created" for a path that has no existing assets row.
 *
 * @param db         Open bun:sqlite Database instance.
 * @param sourcePath Absolute POSIX path to the asset file.
 * @param scope      "global" | "project" | "local"
 * @param projectId  UUID of the owning project, or null for global-scope assets.
 * @returns          The UUID allocated for the new row, or null if the INSERT
 *                   was a no-op (row already existed).
 */
export async function insertAssetRow(
  db: Database,
  sourcePath: string,
  scope: "global" | "project" | "local",
  projectId: string | null,
): Promise<string | null> {
  // Derive (kind, name) from the path using the shared naming helper.
  // claudeRoot is the parent of the kind directory
  //   global: ~/.claude/
  //   project: <projectRoot>/.claude/
  // For simplicity we walk up the path to find the .claude parent.
  const posixPath = sourcePath.replaceAll("\\", "/");
  const claudeIdx = posixPath.lastIndexOf("/.claude/");
  if (claudeIdx === -1) {
    log("WARN", "Scanner.insertAssetRow: cannot derive claudeRoot from path — skipping", {
      sourcePath,
    });
    return null;
  }
  const claudeRoot = posixPath.slice(0, claudeIdx + "/.claude".length);
  const identifier = pathToAssetIdentifier(sourcePath, claudeRoot);
  if (identifier === null) {
    log("WARN", "Scanner.insertAssetRow: pathToAssetIdentifier returned null — skipping", {
      sourcePath,
      claudeRoot,
    });
    return null;
  }

  const meta = await readFileMetadata(sourcePath);
  if (meta === null) {
    // readFileMetadata already logged the failure.
    return null;
  }

  const now = Date.now();
  const newId = crypto.randomUUID();

  const row: AssetRow = {
    id: newId,
    workspace_id: DEFAULT_WORKSPACE_ID,
    author_id: DEFAULT_AUTHOR_ID,
    visibility: DEFAULT_VISIBILITY,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    kind: identifier.kind,
    name: identifier.name,
    scope,
    project_id: projectId,
    source_path: sourcePath,
    validation_status: "valid",
    shadowed_by_project_id: null,
    last_modified_by: "external",
    last_modified_at: meta.mtimeMs,
    front_matter_json: null,
    body_excerpt: meta.bodyExcerptText,
  };

  const stmt = db.prepare(INSERT_SQL);
  // bun:sqlite returns the number of rows changed. INSERT OR IGNORE returns 0
  // changed rows when the unique constraint fires (no-op case).
  const result = stmt.run({
    $id: row.id,
    $workspace_id: row.workspace_id,
    $author_id: row.author_id,
    $visibility: row.visibility,
    $created_at: row.created_at,
    $updated_at: row.updated_at,
    $deleted_at: row.deleted_at,
    $kind: row.kind,
    $name: row.name,
    $scope: row.scope,
    $project_id: row.project_id,
    $source_path: row.source_path,
    $validation_status: row.validation_status,
    $shadowed_by_project_id: row.shadowed_by_project_id,
    $last_modified_by: row.last_modified_by,
    $last_modified_at: row.last_modified_at,
    $front_matter_json: row.front_matter_json,
    $body_excerpt: row.body_excerpt,
  });

  if (result.changes === 0) {
    // Row already existed — INSERT OR IGNORE was a no-op.
    log("INFO", "Scanner.insertAssetRow: row already exists (INSERT OR IGNORE no-op)", {
      sourcePath,
    });
    return null;
  }

  log("INFO", "Scanner.insertAssetRow: inserted new asset row", {
    sourcePath,
    kind: identifier.kind,
    name: identifier.name,
    scope,
    projectId,
    id: newId,
  });

  return newId;
}

// ---------------------------------------------------------------------------
// Public API — runColdLaunchScan
// ---------------------------------------------------------------------------

/** Counts per global kind returned from runColdLaunchScan. */
export interface ScanTotals {
  skills: number;
  agents: number;
  commands: number;
  teams: number;
  workflows: number;
  projectScopedCount: number;
  elapsedMs: number;
}

/**
 * Run the cold-launch asset scan and hydrate the `assets` table.
 *
 * Call sequence in index.ts: runMigrations() → runColdLaunchScan() → startWatcher()
 *
 * Emits AssetIndexHydratedEvent over SSE once the transaction commits.
 * All inserts are wrapped in a single bun:sqlite transaction for performance.
 *
 * @param db      Open Database instance (from db/client.ts).
 * @returns       Scan totals (also contained in the emitted event).
 */
export async function runColdLaunchScan(db: Database): Promise<ScanTotals> {
  const startMs = Date.now();

  log("INFO", "Scanner: cold-launch scan starting");

  const claudeDir = join(homedir(), ".claude");

  // -------------------------------------------------------------------------
  // Phase 1: Enumerate global roots concurrently (AC-1, AC-2, AC-9)
  // -------------------------------------------------------------------------
  const globalEnumResults = await Promise.all(
    KIND_DEFS.map((def) => enumerateKindRoot(join(claudeDir, def.dirName), def)),
  );

  const globalByKind = new Map<string, AssetFile[]>();
  for (let i = 0; i < KIND_DEFS.length; i++) {
    globalByKind.set(KIND_DEFS[i].kind, globalEnumResults[i]);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Enumerate project roots (AC-3)
  // -------------------------------------------------------------------------
  interface ProjectRow {
    id: string;
    path: string;
  }

  let projectRows: ProjectRow[] = [];
  try {
    projectRows = db
      .query<ProjectRow, []>("SELECT id, path FROM projects WHERE deleted_at IS NULL")
      .all();
  } catch (err) {
    log("WARN", "Scanner: failed to query projects table — project-scope scan skipped", {
      error: String(err),
    });
  }

  if (projectRows.length === 0) {
    log("INFO", "Scanner: 0 project roots found — project-scope scan skipped");
  }

  // Enumerate all project roots concurrently.
  const projectAssets: Array<{ projectId: string; files: AssetFile[] }> = [];

  await Promise.all(
    projectRows.map(async (project) => {
      const projectClaudeDir = join(project.path, ".claude");
      const kindResults = await Promise.all(
        KIND_DEFS.map((def) => enumerateKindRoot(join(projectClaudeDir, def.dirName), def)),
      );
      const files = kindResults.flat();
      projectAssets.push({ projectId: project.id, files });
    }),
  );

  // -------------------------------------------------------------------------
  // Phase 3: Read metadata concurrently, then INSERT in a single transaction
  // -------------------------------------------------------------------------
  const now = Date.now();

  // Flatten global assets with metadata reads.
  const globalInsertRows: AssetRow[] = [];
  // Local to each invocation — no shared mutable state (CR-6: confirmed-no-op 2026-05-18, already block-scoped)
  const globalKindCounts: Record<string, number> = {
    skill: 0,
    agent: 0,
    command: 0,
    team: 0,
    workflow: 0,
  };

  await Promise.all(
    KIND_DEFS.map(async (def) => {
      const files = globalByKind.get(def.kind) ?? [];
      for (const file of files) {
        const meta = await readFileMetadata(file.sourcePath);
        if (meta === null) continue; // AC-8: skip on read failure (already logged)
        globalInsertRows.push({
          id: crypto.randomUUID(),
          workspace_id: DEFAULT_WORKSPACE_ID,
          author_id: DEFAULT_AUTHOR_ID,
          visibility: DEFAULT_VISIBILITY,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          kind: file.kind,
          name: file.name,
          scope: "global",
          project_id: null,
          source_path: file.sourcePath,
          validation_status: "valid",
          shadowed_by_project_id: null,
          last_modified_by: "external",
          last_modified_at: meta.mtimeMs,
          front_matter_json: null,
          body_excerpt: meta.bodyExcerptText,
        });
        globalKindCounts[file.kind]++;
      }
    }),
  );

  // Flatten project assets with metadata reads.
  const projectInsertRows: AssetRow[] = [];
  let projectScopedCount = 0;

  await Promise.all(
    projectAssets.map(async ({ projectId, files }) => {
      for (const file of files) {
        const meta = await readFileMetadata(file.sourcePath);
        if (meta === null) continue;
        projectInsertRows.push({
          id: crypto.randomUUID(),
          workspace_id: DEFAULT_WORKSPACE_ID,
          author_id: DEFAULT_AUTHOR_ID,
          visibility: DEFAULT_VISIBILITY,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          kind: file.kind,
          name: file.name,
          scope: "project",
          project_id: projectId,
          source_path: file.sourcePath,
          validation_status: "valid",
          shadowed_by_project_id: null,
          last_modified_by: "external",
          last_modified_at: meta.mtimeMs,
          front_matter_json: null,
          body_excerpt: meta.bodyExcerptText,
        });
        projectScopedCount++;
      }
    }),
  );

  const allRows = [...globalInsertRows, ...projectInsertRows];

  // -------------------------------------------------------------------------
  // Phase 4: Single transaction — INSERT OR IGNORE (idempotent on re-launch)
  // -------------------------------------------------------------------------
  const stmt = db.prepare(INSERT_SQL);
  const insertMany = db.transaction((rows: AssetRow[]) => {
    for (const row of rows) {
      stmt.run({
        $id: row.id,
        $workspace_id: row.workspace_id,
        $author_id: row.author_id,
        $visibility: row.visibility,
        $created_at: row.created_at,
        $updated_at: row.updated_at,
        $deleted_at: row.deleted_at,
        $kind: row.kind,
        $name: row.name,
        $scope: row.scope,
        $project_id: row.project_id,
        $source_path: row.source_path,
        $validation_status: row.validation_status,
        $shadowed_by_project_id: row.shadowed_by_project_id,
        $last_modified_by: row.last_modified_by,
        $last_modified_at: row.last_modified_at,
        $front_matter_json: row.front_matter_json,
        $body_excerpt: row.body_excerpt,
      });
    }
  });

  insertMany(allRows);

  const elapsedMs = Date.now() - startMs;

  const totals: ScanTotals = {
    skills: globalKindCounts.skill,
    agents: globalKindCounts.agent,
    commands: globalKindCounts.command,
    teams: globalKindCounts.team,
    workflows: globalKindCounts.workflow,
    projectScopedCount,
    elapsedMs,
  };

  log("INFO", "Scanner: cold-launch scan complete", { ...totals });

  // -------------------------------------------------------------------------
  // Phase 5: Emit AssetIndexHydratedEvent (AC-4)
  // -------------------------------------------------------------------------
  const hydratedEvent: AssetIndexHydratedEvent = {
    type: ASSET_INDEX_HYDRATED,
    ...totals,
  };
  emit(hydratedEvent);

  return totals;
}

// ---------------------------------------------------------------------------
// Public API — runProjectScan (Story 3.7 / FR-040)
// ---------------------------------------------------------------------------

/**
 * Run a targeted asset scan scoped to a single project root.
 *
 * Called by the sidecar's POST /indexer/scan/project endpoint (triggered from
 * the Tauri `switch_project` command). Uses the same enumeration and INSERT
 * logic as `runColdLaunchScan` but restricts enumeration to one project's
 * .claude/ subtrees and uses `INSERT OR IGNORE` for idempotency.
 *
 * Note: CR-6 (`globalKindCounts` refactor) was evaluated in Batch 2 and confirmed
 * a no-op — `globalKindCounts` in runColdLaunchScan() is already block-scoped (line 475).
 * No shared mutable state existed; no refactor was needed.
 *
 * @param db          Open Database instance.
 * @param projectRoot Absolute path to the project root (e.g., "/Users/zeke/MyProject").
 *                    Must be normalised to POSIX separators by the caller.
 * @returns           Count of assets inserted/skipped.
 */
export async function runProjectScan(
  db: Database,
  projectRoot: string,
): Promise<{ projectId: string | null; insertedCount: number; elapsedMs: number }> {
  const startMs = Date.now();

  log("INFO", "Scanner: project scan starting", { projectRoot });

  // Look up the project_id for this root.
  interface ProjectIdRow {
    id: string;
  }
  const projectRow = db
    .query<
      ProjectIdRow,
      [string]
    >("SELECT id FROM projects WHERE path = ? AND deleted_at IS NULL LIMIT 1")
    .get(projectRoot);

  if (projectRow === null) {
    log("WARN", "Scanner: runProjectScan — projectRoot not found in projects table, scan skipped", {
      projectRoot,
    });
    return { projectId: null, insertedCount: 0, elapsedMs: Date.now() - startMs };
  }

  const projectId = projectRow.id;
  const projectClaudeDir = join(projectRoot, ".claude");

  // Enumerate all kind roots for this project concurrently.
  const kindResults = await Promise.all(
    KIND_DEFS.map((def) => enumerateKindRoot(join(projectClaudeDir, def.dirName), def)),
  );
  const files = kindResults.flat();

  if (files.length === 0) {
    log("INFO", "Scanner: project scan found 0 asset files", { projectRoot, projectId });
    return { projectId, insertedCount: 0, elapsedMs: Date.now() - startMs };
  }

  const now = Date.now();
  const insertRows: AssetRow[] = [];

  await Promise.all(
    files.map(async (file) => {
      const meta = await readFileMetadata(file.sourcePath);
      if (meta === null) return; // skip on read failure (already logged in readFileMetadata)
      insertRows.push({
        id: crypto.randomUUID(),
        workspace_id: DEFAULT_WORKSPACE_ID,
        author_id: DEFAULT_AUTHOR_ID,
        visibility: DEFAULT_VISIBILITY,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        kind: file.kind,
        name: file.name,
        scope: "project",
        project_id: projectId,
        source_path: file.sourcePath,
        validation_status: "valid",
        shadowed_by_project_id: null,
        last_modified_by: "external",
        last_modified_at: meta.mtimeMs,
        front_matter_json: null,
        body_excerpt: meta.bodyExcerptText,
      });
    }),
  );

  const stmt = db.prepare(INSERT_SQL);
  const insertMany = db.transaction((rows: AssetRow[]) => {
    for (const row of rows) {
      stmt.run({
        $id: row.id,
        $workspace_id: row.workspace_id,
        $author_id: row.author_id,
        $visibility: row.visibility,
        $created_at: row.created_at,
        $updated_at: row.updated_at,
        $deleted_at: row.deleted_at,
        $kind: row.kind,
        $name: row.name,
        $scope: row.scope,
        $project_id: row.project_id,
        $source_path: row.source_path,
        $validation_status: row.validation_status,
        $shadowed_by_project_id: row.shadowed_by_project_id,
        $last_modified_by: row.last_modified_by,
        $last_modified_at: row.last_modified_at,
        $front_matter_json: row.front_matter_json,
        $body_excerpt: row.body_excerpt,
      });
    }
  });

  insertMany(insertRows);

  const elapsedMs = Date.now() - startMs;

  log("INFO", "Scanner: project scan complete", {
    projectRoot,
    projectId,
    insertedCount: insertRows.length,
    elapsedMs,
  });

  return { projectId, insertedCount: insertRows.length, elapsedMs };
}
