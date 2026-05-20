/**
 * derivePluginSource — derive a provenance display label from AssetProvenanceSummary.
 *
 * Three branches:
 *   1. null/undefined provenance  → { label: "User-authored", variant: "user-authored", hostname: null }
 *   2. parseable URL sourceUrl    → { label: "From {hostname}", variant: "plugin", hostname }
 *      - file:// URLs with empty hostname → fall back to "User-authored"
 *      - hostname truncated to 24 chars with trailing ellipsis if longer
 *   3. non-URL sourceUrl string   → { label: "From {truncated}", variant: "plugin", hostname: null }
 *      - empty string → fall back to "User-authored"
 *
 * Never throws — URL parse failures are caught and handled gracefully.
 *
 * Per UX Design Handoff §Provenance label rendering (Story 6.3, 2026-05-19).
 */

import type { AssetProvenanceSummary } from "@zoeplane/shared-types";

// Maximum display length for hostname / opaque identifier labels.
const MAX_DISPLAY_LENGTH = 24;

/** Truncate a string to at most MAX_DISPLAY_LENGTH chars with a trailing ellipsis. */
function truncate(s: string): string {
  return s.length > MAX_DISPLAY_LENGTH ? s.slice(0, MAX_DISPLAY_LENGTH - 1) + "…" : s;
}

export interface PluginSourceResult {
  /** Human-readable label to display on the card provenance chip. */
  label: string;
  /**
   * "user-authored" — plain text label, no chip chrome.
   * "plugin" — chip with link icon + accent colours.
   */
  variant: "user-authored" | "plugin";
  /**
   * Raw parsed hostname when variant === "plugin" AND the sourceUrl was a valid URL.
   * null when variant === "user-authored" OR when sourceUrl was a non-URL opaque identifier.
   */
  hostname: string | null;
}

/**
 * Derive a provenance display label from an AssetProvenanceSummary (or null).
 *
 * @param provenance - LEFT-JOINed provenance row from GET /assets, or null when no row exists.
 */
export function derivePluginSource(
  provenance: AssetProvenanceSummary | null | undefined,
): PluginSourceResult {
  // Branch 1: null or undefined provenance (AC #5 default)
  if (provenance === null || provenance === undefined) {
    return { label: "User-authored", variant: "user-authored", hostname: null };
  }

  const url = provenance.sourceUrl?.trim() ?? "";

  // Branch 1 (continued): empty sourceUrl — treat as user-authored
  if (url === "") {
    return { label: "User-authored", variant: "user-authored", hostname: null };
  }

  // Branch 2: attempt URL parse
  try {
    const parsed = new URL(url);

    // file:// URLs have an empty hostname — treat as user-authored
    if (parsed.hostname === "") {
      return { label: "User-authored", variant: "user-authored", hostname: null };
    }

    const hostname = parsed.hostname;
    const truncated = truncate(hostname);
    return { label: `From ${truncated}`, variant: "plugin", hostname };
  } catch {
    // Branch 3: non-URL opaque identifier (e.g., "claude-code-marketplace")
    const truncated = truncate(url);
    return { label: `From ${truncated}`, variant: "plugin", hostname: null };
  }
}
