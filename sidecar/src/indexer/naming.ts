// ZoePlane Sidecar — Asset identifier naming helper
//
// Shared path-to-(kind, name) extraction logic used by both the cold-launch
// scanner (scanner.ts) and the project-overlay resolver (resolver.ts).
//
// This module is the single source of truth for converting an absolute asset
// file path into the (kind, name) pair stored in the `assets` table. Both the
// scanner (which inserts rows) and the resolver (which looks up rows by name)
// MUST agree on the name form — importing this helper guarantees consistency.
//
// Story: 3.4 — Project-overlay resolution + shadow marking (FR-074, FR-075)
//
// === Name conventions per kind (mirrors scanner.ts KindDef layout) ===
//
//   skill     → <root>/skills/<name>/SKILL.md       → name = <name>
//   agent     → <root>/agents/<name>.md             → name = <name>  (no ext)
//   command   → <root>/commands/<name>.md           → name = <name>  (no ext, relative)
//               <root>/commands/<sub>/<name>.md     → name = <sub>/<name>
//   team      → <root>/teams/<name>/TEAM.md         → name = <name>
//   workflow  → <root>/workflows/<name>/WORKFLOW.md → name = <name>

import { extname, join } from "node:path";

/**
 * Normalize a path string to POSIX "/" separators. Always replaces "\\" with
 * "/" regardless of host platform — backslash is not a meaningful path
 * separator in practice for the file kinds this helper indexes (skills,
 * agents, commands, teams, workflows under `~/.claude/`), and always-replace
 * makes the helper truly platform-agnostic. The helper accepts inputs from:
 *   1. Production code: paths from node:path (platform-native on Windows).
 *   2. Test fixtures and cross-platform sync code: POSIX-literal paths.
 *   3. Windows-style literals tested on POSIX hosts (regression tests).
 */
function toPosix(p: string): string {
  return p.replaceAll("\\", "/");
}

// ---------------------------------------------------------------------------
// Supported asset kinds (mirrors scanner.ts — keep in sync)
// ---------------------------------------------------------------------------

export type AssetKind = "skill" | "agent" | "command" | "team" | "workflow";

/** Directory name under ~/.claude/ (or <project>/.claude/) for each kind. */
const KIND_DIR_NAME: Record<AssetKind, string> = {
  skill: "skills",
  agent: "agents",
  command: "commands",
  team: "teams",
  workflow: "workflows",
};

/** Canonical filename for subdir-canonical layouts. */
const SUBDIR_CANONICAL_FILE: Partial<Record<AssetKind, string>> = {
  skill: "SKILL.md",
  team: "TEAM.md",
  workflow: "WORKFLOW.md",
};

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface AssetIdentifier {
  kind: AssetKind;
  /** Asset name exactly as stored in assets.name column. */
  name: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert an absolute asset file path into the `(kind, name)` identifier pair
 * used in the `assets` table.
 *
 * Returns `null` if the path cannot be attributed to any known kind under the
 * given `claudeRoot`. This happens when the path is outside all known kind
 * directories, is a directory rather than a file, or does not match the
 * canonical file convention for its kind (e.g., a non-SKILL.md file inside a
 * skills/ subdirectory).
 *
 * @param absolutePath  Absolute path to the candidate asset file.
 * @param claudeRoot    Absolute path to the `.claude/` root being scanned
 *                      (e.g., `~/.claude/` for global scope, or
 *                      `<project>/.claude/` for project scope).
 */
export function pathToAssetIdentifier(
  absolutePath: string,
  claudeRoot: string,
): AssetIdentifier | null {
  // Normalize both inputs to POSIX so a single string-comparison code path
  // works regardless of caller style (platform-native via node:path on Windows
  // vs POSIX-literal in test fixtures).
  const normPath = toPosix(absolutePath);
  const normRoot = toPosix(claudeRoot);

  for (const [kindStr, dirName] of Object.entries(KIND_DIR_NAME)) {
    const kind = kindStr as AssetKind;
    const kindRoot = `${normRoot}/${dirName}`;

    // Ensure the path starts with the kind root + "/" so we don't accidentally
    // match a prefix (e.g., `skills2/` treated as `skills/`).
    if (!normPath.startsWith(kindRoot + "/")) {
      continue;
    }

    // Compute the path relative to the kind root. Since startsWith just passed,
    // simple slicing is correctness-equivalent to posix.relative() here.
    const relFromKindRoot = normPath.slice(kindRoot.length + 1);

    const canonicalFile = SUBDIR_CANONICAL_FILE[kind];

    if (canonicalFile !== undefined) {
      // subdir-canonical layout: <kindRoot>/<assetName>/<canonicalFile>
      // Only match the canonical file; ignore other files inside the subdir.
      const segments = relFromKindRoot.split("/");
      if (segments.length !== 2) {
        return null; // Too deep or at root — not a canonical asset file.
      }
      const [assetName, fileName] = segments;
      if (fileName !== canonicalFile) {
        return null; // Not the canonical file for this kind.
      }
      return { kind, name: assetName };
    } else {
      // direct-md layout: <kindRoot>/<name>.md  or  <kindRoot>/<sub>/<name>.md
      const segments = relFromKindRoot.split("/");

      if (segments.length === 1) {
        // Flat: agents/architect.md → name = "architect"
        const fileName = segments[0];
        if (extname(fileName) !== ".md") {
          return null; // Not a .md file.
        }
        const name = fileName.slice(0, fileName.length - extname(fileName).length);
        return { kind, name };
      } else if (segments.length === 2) {
        // Nested: commands/consider/first-principles.md → name = "consider/first-principles"
        // Output name uses POSIX "/" regardless of platform — asset.name is a
        // canonical cross-platform identifier, not a filesystem path.
        const [subdir, fileName] = segments;
        if (extname(fileName) !== ".md") {
          return null; // Not a .md file.
        }
        const baseName = fileName.slice(0, fileName.length - extname(fileName).length);
        return { kind, name: `${subdir}/${baseName}` };
      } else {
        // Depth > 2 — not indexed (mirrors scanner.ts depth guard).
        return null;
      }
    }
  }

  // Path is not under any known kind directory.
  return null;
}

/**
 * Build the absolute path to the kind-root directory for a given kind under a
 * `.claude/` root. Convenience helper for callers that need to construct the
 * kind root without duplicating the KIND_DIR_NAME mapping.
 *
 * @example
 *   kindRootForClaudeDir("/home/user/.claude", "skill")
 *   // → "/home/user/.claude/skills"  (POSIX)
 *   // → "C:\\Users\\u\\.claude\\skills"  (Windows, with native separator)
 */
export function kindRootForClaudeDir(claudeRoot: string, kind: AssetKind): string {
  return join(claudeRoot, KIND_DIR_NAME[kind]);
}

// Re-export the mapping for callers that iterate over all kinds.
export { KIND_DIR_NAME };
