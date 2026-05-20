/**
 * asset-search — shared search predicate for asset library views.
 *
 * Provides a single, reusable predicate that both AgentLibraryView and
 * SkillLibraryView pass to LibraryShell. Extracted to eliminate duplicate
 * logic and give tests a direct import target.
 *
 * Story: 6.14 — Asset Search Predicate Extraction
 */

import type { AssetSummary } from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// Search predicate
// ---------------------------------------------------------------------------

/**
 * Default search predicate for asset library views. Matches the asset's
 * front-matter name (when present) or its file name, case-insensitively,
 * as a substring of the search term.
 *
 * Designed to be passed directly to `LibraryShell.searchPredicate` — stable
 * module-scope reference, no new object created per render.
 */
export function assetNameSearchPredicate(item: AssetSummary, term: string): boolean {
  const lc = term.toLowerCase();
  const name = (
    typeof item.frontMatter?.name === "string" ? item.frontMatter.name : item.name
  ).toLowerCase();
  return name.includes(lc);
}
