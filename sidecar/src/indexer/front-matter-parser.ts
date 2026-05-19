// ZoePlane Sidecar — Front-Matter Parsing Strategy
//
// Implements ADR-008: three-tier parsing that matches Claude Code's native
// behavior (BC1 pre-processor algorithm, Bun.YAML.parse engine).
//
// Story: 6.1 — Front-Matter Parsing Strategy (FR-031, FR-032)
// ADR: ADR-008 (Accepted 2026-05-19)
// Claude Code version reference: 2.1.143 (decompiled 2026-05-19)
//
// === Three-tier strategy ===
//
//   Tier 1 (raw)         — parse front-matter YAML block as-is via Bun.YAML.parse.
//                          Covers 21/21 skills + 20/20 commands in the operator corpus.
//   Tier 2 (preprocessed) — escape pre-processor matching Claude Code's BC1 function,
//                           then re-attempt Bun.YAML.parse.
//                           Covers 14/14 agent files in the operator corpus.
//   Tier 3 (fallback)    — per-field regex extraction for a known field allowlist.
//                           Graceful degradation: at least one field → warnings,
//                           no fields → failed.
//
// === Exported API ===
//
//   parseFrontMatter(raw: string): ParseFrontMatterResult
//     raw — the YAML block content extracted from between the --- delimiters
//           (not the full file content; caller is responsible for delimiting).
//
// === Constants (source-of-truth per story Technical Notes + ADR-008 §Context) ===
//
//   DANGEROUS_CHARS_RE  — /[{}[\]*&#!|>%@`]|: /   (pC1 in Claude Code binary)
//   KEY_VALUE_LINE_RE   — /^([a-zA-Z_-]+):\s+(.+)$/ (BC1 line pattern)
//   TIER_3_FIELD_ALLOWLIST — fields extractable by per-field regex fallback

// ---------------------------------------------------------------------------
// YAML parser injection
//
// Defaults to Bun.YAML.parse in production (sidecar runs under Bun per ADR-005).
// Tests inject a Node-compatible parser via setYamlParser() so that Vitest/Node
// workers can import this module without a ReferenceError on `Bun`.
// ---------------------------------------------------------------------------

type YamlParser = (s: string) => unknown;

let _yamlParse: YamlParser = (s: string) => {
  // Guard with typeof check so the module is importable in Node test runners
  // even before setYamlParser() is called. Production never hits the throw —
  // Bun is always available per ADR-005 baseline.
  if (typeof Bun === "undefined" || typeof Bun.YAML?.parse !== "function") {
    throw new Error(
      "Bun.YAML.parse unavailable; setYamlParser() must be called in non-Bun runtimes",
    );
  }
  return Bun.YAML.parse(s);
};

export function setYamlParser(fn: YamlParser): void {
  _yamlParse = fn;
}

export function resetYamlParser(): void {
  _yamlParse = (s: string) => {
    if (typeof Bun === "undefined" || typeof Bun.YAML?.parse !== "function") {
      throw new Error(
        "Bun.YAML.parse unavailable; setYamlParser() must be called in non-Bun runtimes",
      );
    }
    return Bun.YAML.parse(s);
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Characters that, when present in an unquoted YAML value, trigger quoting
 * during the BC1 escape pre-processor pass (Tier 2).
 *
 * Reproduced verbatim from Claude Code 2.1.143 binary (variable pC1).
 * The `: ` bigram (colon-space) is included as an alternation to catch the
 * most common cause of parse failures in agent description fields.
 */
const DANGEROUS_CHARS_RE = /[{}[\]*&#!|>%@`]|: /;

/**
 * Pattern for a top-level YAML key-value line that the pre-processor
 * can inspect. Keys consist of letters, underscores, and hyphens only;
 * value must be non-empty and separated by `: ` (colon + at least one space).
 *
 * Reproduced verbatim from Claude Code 2.1.143 binary (BC1 loop pattern).
 */
const KEY_VALUE_LINE_RE = /^([a-zA-Z_-]+):\s+(.+)$/;

/**
 * Fields that Tier 3 (per-field regex fallback) will attempt to extract.
 * Any field outside this list is silently dropped in Tier 3 mode.
 */
const TIER_3_FIELD_ALLOWLIST: readonly string[] = [
  "name",
  "description",
  "voice_id",
  "voice_name",
  "color",
  "model",
  "version",
];

/**
 * Pattern that matches the opening `---` … closing `---` front-matter block.
 * Capture group 1 is the raw YAML content between the delimiters.
 * Used by extractRawYamlBlock to scope Tier 3 extraction to the YAML region only.
 */
const FM_DELIMITER_RE = /^---\s*\n([\s\S]*?)---\s*\n?/;

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type ParseMode = "raw" | "preprocessed" | "fallback" | "failed";

export interface ParseFrontMatterResult {
  /** Parsed fields, or null when all tiers fail. */
  data: Record<string, unknown> | null;
  /**
   * Which tier produced the result:
   *   "raw"          — Tier 1 succeeded (Bun.YAML.parse on raw block)
   *   "preprocessed" — Tier 2 succeeded (BC1 escape pre-processor + Bun.YAML.parse)
   *   "fallback"     — Tier 3 extracted ≥1 field from the allowlist
   *   "failed"       — All three tiers failed; data is null
   */
  mode: ParseMode;
  /**
   * Warning codes emitted by the parser itself (distinct from per-kind field
   * warning rules in validator.ts). Currently only "front-matter-fallback-extraction"
   * is emitted (when Tier 3 produces ≥1 field).
   */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Tier 2: BC1 escape pre-processor
// ---------------------------------------------------------------------------

/**
 * Run the BC1 escape pre-processor over a raw YAML block.
 *
 * For each line matching KEY_VALUE_LINE_RE:
 *   - If the value is already wrapped in matching "..." or '...', leave it alone.
 *   - If the value contains any DANGEROUS_CHARS_RE character or bigram, wrap
 *     the value in double quotes, escaping internal \ → \\ and " → \".
 *
 * Lines that do not match (indented content, list items, blank lines) are
 * passed through unchanged, preserving nested structures.
 *
 * Algorithm matches Claude Code 2.1.143 BC1 function exactly.
 */
export function preprocess(s: string): string {
  const lines = s.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    const m = line.match(KEY_VALUE_LINE_RE);
    if (m) {
      const key = m[1];
      const value = m[2];

      if (!key || !value) {
        out.push(line);
        continue;
      }

      // Already quoted — leave alone (Claude Code's BC1 does the same check).
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        out.push(line);
        continue;
      }

      if (DANGEROUS_CHARS_RE.test(value)) {
        // Escape internal backslashes first, then double quotes.
        const escaped = value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
        out.push(`${key}: "${escaped}"`);
        continue;
      }
    }

    out.push(line);
  }

  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Tier 3: per-field line-level extraction
// ---------------------------------------------------------------------------

/**
 * Extract a small set of well-known fields from a YAML block using per-line
 * regex matching. No nested-structure support — arrays and mappings are NOT
 * extracted; only scalar string values.
 *
 * Returns an object containing only the fields present in TIER_3_FIELD_ALLOWLIST
 * that could be parsed as `key: value` lines. May return an empty object if no
 * allowlisted fields are found.
 */
export function extractFields(s: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = s.split("\n");

  for (const line of lines) {
    const m = line.match(KEY_VALUE_LINE_RE);
    if (!m) continue;

    const key = m[1];
    const value = m[2];

    if (!key || !value) continue;
    if (!TIER_3_FIELD_ALLOWLIST.includes(key)) continue;

    // Strip surrounding quotes if the value happens to be quoted.
    let cleaned = value.trim();
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.slice(1, -1);
    }

    result[key] = cleaned;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract the raw YAML content from between the opening and closing `---`
 * delimiters of a file. Returns null if no front-matter block is present.
 *
 * Used by validator.ts's Tier 3 catch block to scope per-field regex extraction
 * to the front-matter region only, preventing body prose from being scanned.
 */
export function extractRawYamlBlock(content: string): string | null {
  // Normalize CRLF → LF at entry. Windows CI checks out files with \r\n;
  // FM_DELIMITER_RE and downstream splits are all authored for \n only.
  // Durable rule: feedback_path_helpers_normalize_posix.md — normalize at entry.
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(FM_DELIMITER_RE);
  return match ? (match[1] ?? null) : null;
}

/**
 * Parse the YAML content of a front-matter block using the three-tier strategy
 * defined in ADR-008.
 *
 * @param raw  The raw string content between the `---` delimiters of an asset
 *             file. The caller (validator.ts via gray-matter custom engine) is
 *             responsible for delimiter detection and body extraction.
 *
 * @returns ParseFrontMatterResult with data, mode, and warnings.
 */
export function parseFrontMatter(raw: string): ParseFrontMatterResult {
  // Normalize CRLF → LF at entry. Production reads from chokidar+fs.readFile;
  // operator's machine may produce files with any line-ending. Tests on
  // Windows CI receive CRLF-checked-out fixtures. Single normalization here
  // protects every downstream regex and split("\n") from line-ending drift.
  // Durable rule: feedback_path_helpers_normalize_posix.md — normalize at entry.
  const normalized = raw.replace(/\r\n/g, "\n");
  // -------------------------------------------------------------------------
  // Tier 1: raw YAML parse (via injected _yamlParse; defaults to Bun.YAML.parse)
  // -------------------------------------------------------------------------
  try {
    const parsed = _yamlParse(normalized);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        data: parsed as Record<string, unknown>,
        mode: "raw",
        warnings: [],
      };
    }
    // YAML parsed but produced a non-object (e.g., a scalar or array at top level).
    // Fall through to Tier 2.
  } catch {
    // Tier 1 failed — try Tier 2.
  }

  // -------------------------------------------------------------------------
  // Tier 2: BC1 escape pre-processor + YAML parse (via injected _yamlParse)
  // -------------------------------------------------------------------------
  try {
    const preprocessed = preprocess(normalized);
    const parsed = _yamlParse(preprocessed);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        data: parsed as Record<string, unknown>,
        mode: "preprocessed",
        warnings: [],
      };
    }
    // Preprocessed YAML parsed but produced a non-object — fall through to Tier 3.
  } catch {
    // Tier 2 failed — try Tier 3.
  }

  // -------------------------------------------------------------------------
  // Tier 3: per-field regex fallback
  // -------------------------------------------------------------------------
  const fields = extractFields(normalized);
  if (Object.keys(fields).length > 0) {
    return {
      data: fields,
      mode: "fallback",
      warnings: ["front-matter-fallback-extraction"],
    };
  }

  // All tiers failed.
  return {
    data: null,
    mode: "failed",
    warnings: [],
  };
}
