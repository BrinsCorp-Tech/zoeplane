/**
 * deriveArchetype — priority-chain archetype derivation for AgentCard.
 *
 * WARN F resolution (UX Design Handoff, 2026-05-19):
 * `archetype` is not a real front-matter key in the operator's agent corpus.
 * AgentCard treats it as a UX-layer label for a derived value resolved in
 * the following priority order:
 *
 *   1. frontMatter.archetype (non-empty string) → source='archetype'
 *   2. frontMatter.traits.personality[0] title-cased → source='trait-personality'
 *   3. frontMatter.description first 60 chars word-boundary truncated → source='description'
 *   4. em-dash placeholder "—" → source='missing' (triggers AC #4 warning indicator)
 *
 * The `source` discriminant is the single source of truth for warning logic.
 * AgentCard uses `source === 'missing'` to decide whether to render the warning indicator.
 *
 * Story: 6.2 — Agent Library + AgentCard
 */

export type ArchetypeSource = "archetype" | "trait-personality" | "description" | "missing";

export interface DerivedArchetype {
  value: string;
  source: ArchetypeSource;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Title-case a string: "empathy" → "Empathy", "systems_thinking" → "Systems_thinking". */
function titleCase(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate a string to at most `maxChars` characters, breaking at a word boundary.
 * Appends "…" if truncated.
 */
function truncateAtWordBoundary(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str;

  // Find the last space at or before maxChars
  const slice = str.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");

  if (lastSpace > 0) {
    return slice.slice(0, lastSpace) + "…";
  }

  // No space found — hard cut
  return slice + "…";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive the archetype value and its source from a parsed front-matter object.
 *
 * Priority chain per UX Design Handoff §WARN F resolution:
 *   1. frontMatter.archetype (non-empty string)
 *   2. frontMatter.traits.personality[0] (non-empty string array, title-cased)
 *   3. frontMatter.description first 60 chars, word-boundary truncated
 *   4. "—" (placeholder, triggers AC #4 warning)
 */
export function deriveArchetype(frontMatter: Record<string, unknown> | null): DerivedArchetype {
  // Guard: null frontMatter skips all priority levels
  if (frontMatter === null) {
    return { value: "—", source: "missing" };
  }

  // Priority 1: explicit archetype field
  const archetype = frontMatter.archetype;
  if (typeof archetype === "string" && archetype.trim().length > 0) {
    return { value: archetype.trim(), source: "archetype" };
  }

  // Priority 2: traits.personality[0] title-cased
  const traits = frontMatter.traits;
  if (typeof traits === "object" && traits !== null && !Array.isArray(traits)) {
    const personality = (traits as Record<string, unknown>).personality;
    if (Array.isArray(personality) && personality.length > 0) {
      const first = personality[0];
      if (typeof first === "string" && first.trim().length > 0) {
        return { value: titleCase(first.trim()), source: "trait-personality" };
      }
    }
  }

  // Priority 3: description, first 60 chars word-boundary truncated
  const description = frontMatter.description;
  if (typeof description === "string" && description.trim().length > 0) {
    return { value: truncateAtWordBoundary(description.trim(), 60), source: "description" };
  }

  // Priority 4: placeholder
  return { value: "—", source: "missing" };
}
