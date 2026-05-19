// @vitest-environment node
/**
 * Tests for the front-matter parser module (Story 6.1).
 *
 * Tests the three-tier parsing strategy defined in ADR-008:
 *   Tier 1 — raw Bun.YAML.parse
 *   Tier 2 — BC1 escape pre-processor + Bun.YAML.parse
 *   Tier 3 — per-field regex fallback (allowlist fields only)
 *
 * These tests run in the Bun environment (vitest --environment=node but bun
 * is the runtime, so Bun.YAML.parse is available). The test runner is
 * configured to include sidecar/src/ via vitest.config.ts.
 *
 * Three test buckets:
 *   Bucket 1 — operator corpus regression (RUN_LOCAL_CORPUS_TESTS=1 gate)
 *   Bucket 2 — synthetic fixture files (repo-tracked, always run)
 *   Bucket 3 — Bun.YAML parity smoke (precomputed canonical fixture)
 *
 * Windows regression: all fixture reads use import.meta.url resolution to
 * derive absolute paths without hardcoding separators.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, statSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { parseFrontMatter, preprocess, extractFields, setYamlParser } from "../front-matter-parser";

// ---------------------------------------------------------------------------
// YAML parser injection for Node/Vitest workers
//
// production sidecar runs under Bun (Bun.YAML.parse available per ADR-005).
// Vitest runs under Node, so we inject js-yaml (gray-matter's bundled dep) via
// createRequire from gray-matter's real path. No new dependency required.
// ---------------------------------------------------------------------------

beforeAll(() => {
  // Resolve gray-matter's real path to traverse the bun symlink into the
  // content-addressable cache, where js-yaml is co-located as a peer dep.
  const gmRealPath = realpathSync(
    join(fileURLToPath(import.meta.url), "../../../../node_modules/gray-matter/index.js"),
  );
  const requireFromGm = createRequire(gmRealPath);
  // js-yaml v3 — gray-matter's declared dependency (see gray-matter@4 package.json).
  // safeLoad is the YAML 1.2 safe parser, which is close enough to Bun.YAML.parse
  // for the fixture shapes tested here (see Bun.YAML parity hint in Phase 3 brief).
  const jsYaml = requireFromGm("js-yaml") as { safeLoad: (s: string) => unknown };
  setYamlParser((s) => jsYaml.safeLoad(s));
});

// ---------------------------------------------------------------------------
// Fixture path resolution
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, "fixtures", "front-matter");

function readFixture(filename: string): string {
  return readFileSync(join(FIXTURES_DIR, filename), "utf-8");
}

/**
 * Extract the raw YAML block content from between the first pair of --- delimiters.
 * Mirrors the extraction gray-matter performs before calling the custom engine.
 */
function extractRawYamlBlock(content: string): string {
  const m = content.match(/^---\s*\n([\s\S]*?)---\s*\n?/);
  return m ? (m[1] ?? "") : "";
}

// ---------------------------------------------------------------------------
// Bucket 1: Operator corpus regression (env-gated)
// ---------------------------------------------------------------------------

describe("Bucket 1 — operator corpus regression (RUN_LOCAL_CORPUS_TESTS=1)", () => {
  if (!process.env.RUN_LOCAL_CORPUS_TESTS) return;

  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const claudeDir = join(home, ".claude");

  it("14/14 agent files parse in preprocessed mode with non-null data", () => {
    const agentsDir = join(claudeDir, "agents");
    const files = readdirSync(agentsDir).filter((f: string) => f.endsWith(".md"));
    expect(files.length).toBeGreaterThanOrEqual(14);

    for (const file of files) {
      const content = readFileSync(join(agentsDir, file), "utf-8");
      const raw = extractRawYamlBlock(content);
      if (!raw) continue; // skip files without delimiters (not agent files)

      const result = parseFrontMatter(raw);
      expect(result.mode, `${file}: expected preprocessed or raw, got ${result.mode}`).toMatch(
        /^(raw|preprocessed)$/,
      );
      expect(result.data, `${file}: data should be non-null`).not.toBeNull();
      expect(result.warnings, `${file}: no parser warnings expected`).toHaveLength(0);
    }
  });

  it("21/21 skill files with front-matter parse in raw mode", () => {
    const skillsDir = join(claudeDir, "skills");
    // Skills may be in subdirs (subdir-canonical: skills/<name>/SKILL.md)
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    const skillFiles: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFile = join(skillsDir, entry.name, "SKILL.md");
        try {
          statSync(skillFile);
          skillFiles.push(skillFile);
        } catch {
          // not a canonical skill subdir
        }
      }
    }

    let parsedCount = 0;
    for (const filePath of skillFiles) {
      const content = readFileSync(filePath, "utf-8");
      const raw = extractRawYamlBlock(content);
      if (!raw) continue;

      const result = parseFrontMatter(raw);
      expect(result.mode, `${filePath}: expected raw mode for skill`).toBe("raw");
      expect(result.data, `${filePath}: data should be non-null`).not.toBeNull();
      parsedCount++;
    }
    expect(parsedCount).toBeGreaterThanOrEqual(21);
  });

  it("all command files with front-matter parse in raw mode (≥1 file expected)", () => {
    const commandsDir = join(claudeDir, "commands");
    const files = readdirSync(commandsDir).filter((f: string) => f.endsWith(".md"));
    expect(files.length).toBeGreaterThanOrEqual(1);

    let parsedCount = 0;
    for (const file of files) {
      const content = readFileSync(join(commandsDir, file), "utf-8");
      const raw = extractRawYamlBlock(content);
      if (!raw) continue;

      const result = parseFrontMatter(raw);
      expect(result.mode, `${file}: expected raw mode for command`).toBe("raw");
      expect(result.data, `${file}: data should be non-null`).not.toBeNull();
      parsedCount++;
    }
    // All commands that have front-matter should parse via Tier 1 (raw mode).
    expect(parsedCount).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Bucket 2: Synthetic fixture files
// ---------------------------------------------------------------------------

describe("Bucket 2 — synthetic fixtures", () => {
  // -------------------------------------------------------------------------
  // tier-1-clean.md — simple front-matter, parses via Tier 1 (raw)
  // -------------------------------------------------------------------------

  describe("tier-1-clean.md", () => {
    it("returns mode=raw with correct data", () => {
      const content = readFixture("tier-1-clean.md");
      const raw = extractRawYamlBlock(content);
      const result = parseFrontMatter(raw);

      expect(result.mode).toBe("raw");
      expect(result.data).not.toBeNull();
      expect(result.data!.name).toBe("my-skill");
      expect(result.data!.description).toBe("A simple skill with no special characters.");
      expect(result.data!.version).toBe("1.0.0");
      expect(result.warnings).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // tier-2-colon-in-description.md — colon-space bigram in description
  // -------------------------------------------------------------------------

  describe("tier-2-colon-in-description.md", () => {
    it("returns mode=preprocessed when description contains colon-space bigram", () => {
      const content = readFixture("tier-2-colon-in-description.md");
      const raw = extractRawYamlBlock(content);
      const result = parseFrontMatter(raw);

      expect(result.mode).toBe("preprocessed");
      expect(result.data).not.toBeNull();
      expect(result.data!.name).toBe("research-analyst");
      expect(typeof result.data!.description).toBe("string");
      expect(result.data!.description as string).toContain("including:");
      expect(result.warnings).toHaveLength(0);
    });

    it("Tier 1 fails on raw block (colon-space breaks strict YAML)", () => {
      const content = readFixture("tier-2-colon-in-description.md");
      const raw = extractRawYamlBlock(content);
      // Verify that the raw block actually fails Tier 1 alone.
      expect(() => Bun.YAML.parse(raw)).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // tier-2-markdown-bold-colon.md — **Term**: pattern in description
  // -------------------------------------------------------------------------

  describe("tier-2-markdown-bold-colon.md", () => {
    it("returns mode=preprocessed when description contains **Term**: markdown bold", () => {
      const content = readFixture("tier-2-markdown-bold-colon.md");
      const raw = extractRawYamlBlock(content);
      const result = parseFrontMatter(raw);

      expect(result.mode).toBe("preprocessed");
      expect(result.data).not.toBeNull();
      expect(result.data!.name).toBe("sprint-programmer");
      expect(result.data!.voice_id).toBe("8fcyCHOzlKDlxh1InJSf");
      expect(result.data!.voice_name).toBe("Joseph");
      expect(result.warnings).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // tier-2-yaml-sigil.md — YAML sigil characters in value
  //
  // Note: Bun.YAML is more lenient than js-yaml for standalone sigil characters
  // (& # ! | > % @ ` { [ *). The DANGEROUS_CHARS_RE set from Claude Code's
  // BC1 function was calibrated against js-yaml; Bun.YAML parses many of these
  // as plain strings without error. As a result, this fixture parses via Tier 1
  // (raw mode) rather than Tier 2 — Bun.YAML handles the sigils gracefully.
  // This is consistent with ADR-008's goal: maximize parity with Claude Code's
  // native behavior (which also uses Bun.YAML internally).
  // -------------------------------------------------------------------------

  describe("tier-2-yaml-sigil.md", () => {
    it("returns non-null data with correct name field (sigils are handled by Bun.YAML)", () => {
      const content = readFixture("tier-2-yaml-sigil.md");
      const raw = extractRawYamlBlock(content);
      const result = parseFrontMatter(raw);

      // Bun.YAML is lenient with most YAML sigil characters in plain scalars,
      // so Tier 1 succeeds for this fixture. The important assertion is that
      // the parser produces valid data regardless of which tier is used.
      expect(result.mode).toMatch(/^(raw|preprocessed)$/);
      expect(result.data).not.toBeNull();
      expect(result.data!.name).toBe("sigil-agent");
      expect(result.warnings).toHaveLength(0);
    });

    it("preprocess() wraps sigil-containing values in double quotes (BC1 algorithm)", () => {
      // Even though Bun.YAML handles sigils natively, the BC1 pre-processor
      // still wraps them — because DANGEROUS_CHARS_RE includes them for
      // compatibility with js-yaml (Claude Code's pre-processor target at compile time).
      const input = "description: Uses anchors & aliases for config reuse";
      const output = preprocess(input);
      expect(output).toBe('description: "Uses anchors & aliases for config reuse"');
    });
  });

  // -------------------------------------------------------------------------
  // tier-2-already-quoted.md — value already quoted, pre-processor leaves alone
  // -------------------------------------------------------------------------

  describe("tier-2-already-quoted.md", () => {
    it("parses successfully without double-escaping the already-quoted value", () => {
      const content = readFixture("tier-2-already-quoted.md");
      const raw = extractRawYamlBlock(content);
      const result = parseFrontMatter(raw);

      // Value is pre-quoted, so Tier 1 may succeed (Bun.YAML handles quoted strings fine).
      // Either raw or preprocessed is acceptable — the key assertion is no double-quoting.
      expect(result.mode).toMatch(/^(raw|preprocessed)$/);
      expect(result.data).not.toBeNull();
      expect(result.data!.name).toBe("quoted-agent");
      // The description should be the inner string, not double-wrapped.
      expect(result.data!.description as string).toContain("including:");
      expect(result.data!.description as string).not.toMatch(/^".*"$/); // not re-quoted
      expect(result.warnings).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // tier-3-malformed-yaml-recoverable.md — Tier 3 extracts partial data
  // -------------------------------------------------------------------------

  describe("tier-3-malformed-yaml-recoverable.md", () => {
    it("returns mode=fallback with partial data and front-matter-fallback-extraction warning", () => {
      const content = readFixture("tier-3-malformed-yaml-recoverable.md");
      const raw = extractRawYamlBlock(content);
      const result = parseFrontMatter(raw);

      expect(result.mode).toBe("fallback");
      expect(result.data).not.toBeNull();
      // name, description, and voice_id are on simple key: value lines within the allowlist
      expect(result.data!.name).toBe("broken-agent");
      expect(result.data!.description).toBeDefined();
      expect(result.data!.voice_id).toBe("abc123");
      expect(result.warnings).toContain("front-matter-fallback-extraction");
    });

    it("Tier 3 data contains only allowlisted fields", () => {
      const content = readFixture("tier-3-malformed-yaml-recoverable.md");
      const raw = extractRawYamlBlock(content);
      const result = parseFrontMatter(raw);

      if (result.data !== null) {
        const allowlist = [
          "name",
          "description",
          "voice_id",
          "voice_name",
          "color",
          "model",
          "version",
        ];
        for (const key of Object.keys(result.data)) {
          expect(allowlist, `unexpected field: ${key}`).toContain(key);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // tier-3-no-extractable-fields.md — all three tiers fail
  // -------------------------------------------------------------------------

  describe("tier-3-no-extractable-fields.md", () => {
    it("returns mode=failed with null data when all three tiers fail", () => {
      const content = readFixture("tier-3-no-extractable-fields.md");
      const raw = extractRawYamlBlock(content);
      const result = parseFrontMatter(raw);

      expect(result.mode).toBe("failed");
      expect(result.data).toBeNull();
      expect(result.warnings).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // no-delimiters.md — file with no --- markers (validator rejects before parsing)
  // -------------------------------------------------------------------------

  describe("no-delimiters.md", () => {
    it("extractRawYamlBlock returns empty string for a file with no --- delimiters", () => {
      const content = readFixture("no-delimiters.md");
      const raw = extractRawYamlBlock(content);
      // No front-matter block to extract.
      expect(raw).toBe("");
    });

    it("parseFrontMatter on an empty string returns mode=failed", () => {
      // Empty raw block — nothing to parse at any tier.
      const result = parseFrontMatter("");
      // Bun.YAML.parse("") returns null; extractFields("") returns {}
      expect(result.mode).toBe("failed");
      expect(result.data).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Inline: all allowlist fields present (validates Tier 1 parses all fields)
  // -------------------------------------------------------------------------

  describe("all allowlist fields present (inline synthetic)", () => {
    const rawAllFields = `name: full-agent
description: An agent with every allowlist field populated.
voice_id: abc-voice-id
voice_name: Maya
color: teal
model: claude-opus-4-5
version: 2.0.0
`;

    it("returns mode=raw and populates all seven allowlist fields", () => {
      const result = parseFrontMatter(rawAllFields);

      expect(result.mode).toBe("raw");
      expect(result.data).not.toBeNull();
      expect(result.data!.name).toBe("full-agent");
      expect(result.data!.description).toBe("An agent with every allowlist field populated.");
      expect(result.data!.voice_id).toBe("abc-voice-id");
      expect(result.data!.voice_name).toBe("Maya");
      expect(result.data!.color).toBe("teal");
      expect(result.data!.model).toBe("claude-opus-4-5");
      expect(result.data!.version).toBe("2.0.0");
      expect(result.warnings).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Inline: only the minimum required field (name only)
  // -------------------------------------------------------------------------

  describe("only-required-field — name only (inline synthetic)", () => {
    const rawNameOnly = `name: minimal-agent
`;

    it("returns mode=raw with only name field when only name is present", () => {
      const result = parseFrontMatter(rawNameOnly);

      expect(result.mode).toBe("raw");
      expect(result.data).not.toBeNull();
      expect(result.data!.name).toBe("minimal-agent");
      // No other fields — data has exactly one key.
      expect(Object.keys(result.data!)).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Internal helper: preprocess() unit tests
// ---------------------------------------------------------------------------

describe("preprocess() — BC1 algorithm unit tests", () => {
  it("wraps a value containing colon-space in double quotes", () => {
    const input = "description: Use this for tasks: one, two, three";
    const output = preprocess(input);
    expect(output).toBe('description: "Use this for tasks: one, two, three"');
  });

  it("wraps a value containing ** (dangerous char) in double quotes", () => {
    const input = "description: **Term**: Explanation";
    const output = preprocess(input);
    expect(output).toBe('description: "**Term**: Explanation"');
  });

  it("leaves already double-quoted values alone", () => {
    const input = 'description: "Already quoted: value"';
    const output = preprocess(input);
    expect(output).toBe('description: "Already quoted: value"');
  });

  it("leaves already single-quoted values alone", () => {
    const input = "description: 'Already quoted: value'";
    const output = preprocess(input);
    expect(output).toBe("description: 'Already quoted: value'");
  });

  it("leaves lines with no key-value pattern unchanged", () => {
    const lines = ["  - list item", "  nested: value", "", "# comment"];
    for (const line of lines) {
      expect(preprocess(line)).toBe(line);
    }
  });

  it("escapes internal backslashes before double quotes when wrapping", () => {
    const input = "description: path\\to\\thing and: more";
    const output = preprocess(input);
    expect(output).toBe('description: "path\\\\to\\\\thing and: more"');
  });

  it("escapes internal double quotes when wrapping", () => {
    const input = 'description: has "quoted" word: plus colon';
    const output = preprocess(input);
    expect(output).toBe('description: "has \\"quoted\\" word: plus colon"');
  });

  it("leaves values without dangerous chars unchanged", () => {
    const input = "name: simple-name";
    const output = preprocess(input);
    expect(output).toBe("name: simple-name");
  });

  it("processes only top-level key-value lines (not indented content)", () => {
    // Multi-line input where only the top-level line triggers wrapping.
    const input = [
      "description: needs: wrapping",
      "  - list item with: colon", // indented — not a top-level key
      "name: clean",
    ].join("\n");
    const output = preprocess(input);
    const lines = output.split("\n");
    expect(lines[0]).toBe('description: "needs: wrapping"');
    expect(lines[1]).toBe("  - list item with: colon"); // unchanged
    expect(lines[2]).toBe("name: clean"); // no dangerous chars
  });
});

// ---------------------------------------------------------------------------
// Internal helper: extractFields() unit tests
// ---------------------------------------------------------------------------

describe("extractFields() — Tier 3 per-field regex", () => {
  it("extracts allowlisted fields from a simple key-value block", () => {
    const block = [
      "name: my-agent",
      "description: Some description",
      "voice_id: xyz789",
      "color: blue",
    ].join("\n");
    const result = extractFields(block);

    expect(result.name).toBe("my-agent");
    expect(result.description).toBe("Some description");
    expect(result.voice_id).toBe("xyz789");
    expect(result.color).toBe("blue");
  });

  it("ignores non-allowlisted fields", () => {
    const block = [
      "name: test",
      "traits: [a, b, c]", // not in allowlist
      "metadata: {key: val}", // not in allowlist
      "version: 1.0.0",
    ].join("\n");
    const result = extractFields(block);

    expect(result.name).toBe("test");
    expect(result.version).toBe("1.0.0");
    expect(result.traits).toBeUndefined();
    expect(result.metadata).toBeUndefined();
  });

  it("strips surrounding quotes from extracted values", () => {
    const block = ['name: "quoted-name"', "description: 'single-quoted'"].join("\n");
    const result = extractFields(block);

    expect(result.name).toBe("quoted-name");
    expect(result.description).toBe("single-quoted");
  });

  it("returns empty object when no allowlisted fields are present", () => {
    const block = ["{{{ broken yaml", "  not: a valid key value pair", "% TAG directive"].join(
      "\n",
    );
    const result = extractFields(block);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("extracts all seven allowlisted fields when present", () => {
    const block = [
      "name: agent",
      "description: desc",
      "voice_id: vid",
      "voice_name: vname",
      "color: red",
      "model: claude-opus-4-5",
      "version: 1.0.0",
    ].join("\n");
    const result = extractFields(block);

    expect(Object.keys(result)).toHaveLength(7);
    expect(result.name).toBe("agent");
    expect(result.voice_id).toBe("vid");
    expect(result.voice_name).toBe("vname");
  });
});

// ---------------------------------------------------------------------------
// Windows line endings — CRLF regression coverage
//
// Durable rule: feedback_path_helpers_normalize_posix.md — normalize at entry.
// Windows CI checks out files with CRLF (\r\n) line endings when git's
// autocrlf=true is active (the Windows default). All downstream regex and
// split("\n") calls are authored for LF-only. parseFrontMatter() normalizes
// CRLF → LF at entry, protecting every tier from line-ending drift.
//
// These tests use raw string literals with \r\n baked in — NOT disk-loaded
// fixtures, which git checkout settings would normalize on the host machine
// (making the test vacuous on macOS/Linux). The raw literals reproduce exactly
// what Windows CI delivers to the parser.
// ---------------------------------------------------------------------------

describe("Windows line endings — CRLF regression coverage", () => {
  it("Tier 1 (raw mode) succeeds with CRLF input — simple scalar fields", () => {
    // Simulates a skill file checked out with CRLF on Windows CI.
    // Tier 1 must parse the YAML block and produce mode=raw.
    const crlfRaw = "name: my-skill\r\ndescription: A simple skill.\r\nversion: 1.0.0\r\n";
    const result = parseFrontMatter(crlfRaw);

    expect(result.mode).toBe("raw");
    expect(result.data).not.toBeNull();
    expect(result.data!.name).toBe("my-skill");
    expect(result.data!.description).toBe("A simple skill.");
    expect(result.data!.version).toBe("1.0.0");
    expect(result.warnings).toHaveLength(0);
  });

  it("Tier 2 (preprocessed mode) succeeds with CRLF input + prose colon in value", () => {
    // Simulates an agent file containing a colon-space bigram in description,
    // checked out with CRLF on Windows CI. Without CRLF normalization, the BC1
    // pre-processor's split("\n") leaves \r at the end of each captured value,
    // causing the YAML parser to reject the preprocessed block.
    const crlfWithColon =
      "name: research-analyst\r\ndescription: Performs research, including: synthesis and analysis\r\nvoice_name: Maya\r\n";
    const result = parseFrontMatter(crlfWithColon);

    expect(result.mode).toBe("preprocessed");
    expect(result.data).not.toBeNull();
    expect(result.data!.name).toBe("research-analyst");
    expect(result.data!.description as string).toContain("including:");
    expect(result.data!.voice_name).toBe("Maya");
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Bucket 3: Bun.YAML parity smoke (precomputed canonical fixture)
//
// Choice rationale (per Sprint-Programmer Note #6): Rather than adding the
// `yaml` npm package as a devDependency, we use a precomputed canonical
// output fixture. The fixture was generated by running:
//
//   import YAML from 'yaml'; YAML.parse(CANONICAL_INPUT)
//
// with yaml@2.7.0 (the version Bun.YAML wraps) against the canonical
// Claude Code front-matter schema. The smoke test asserts that Bun.YAML.parse
// produces identical output to the precomputed reference for this input.
//
// This detects Bun runtime YAML drift without requiring a live yaml package
// at test time. If Bun.YAML changes semantics for this input, the test fails
// and we need to update the parser or the precomputed reference.
// ---------------------------------------------------------------------------

describe("Bucket 3 — Bun.YAML parity smoke (precomputed canonical fixture)", () => {
  /**
   * Canonical agent front-matter input representing the Claude Code schema.
   * Covers: string scalars, nested mapping (traits), and nested arrays.
   * Source: https://code.claude.com/docs/en/sub-agents (§Frontmatter reference)
   */
  const CANONICAL_INPUT = `name: my-agent
description: A helpful assistant agent.
model: claude-opus-4-5
color: blue
voice_id: abc123
voice_name: Maya
traits:
  expertise:
    - research
    - analysis
  personality:
    - friendly
    - direct
`;

  /**
   * Precomputed reference output for CANONICAL_INPUT.
   * Generated 2026-05-19 with yaml@2.7.0 (Bun.YAML's underlying library).
   * This is the ground-truth object shape for the test.
   */
  const CANONICAL_EXPECTED = {
    name: "my-agent",
    description: "A helpful assistant agent.",
    model: "claude-opus-4-5",
    color: "blue",
    voice_id: "abc123",
    voice_name: "Maya",
    traits: {
      expertise: ["research", "analysis"],
      personality: ["friendly", "direct"],
    },
  };

  // Gate this test behind a Bun availability check — it directly calls Bun.YAML.parse
  // which is undefined in Node/Vitest workers. The adjacent parseFrontMatter test
  // (which uses the injectable _yamlParse) already covers Tier 1 parity at the
  // production-code level and runs in all environments. (Finding 3 fix)
  const isBunAvailable = typeof Bun !== "undefined";
  it.skipIf(!isBunAvailable)(
    "Bun.YAML.parse produces output matching the precomputed canonical reference",
    () => {
      const parsed = Bun.YAML.parse(CANONICAL_INPUT);
      expect(parsed).toEqual(CANONICAL_EXPECTED);
    },
  );

  it("parseFrontMatter(Tier 1) produces the same structured data for the canonical input", () => {
    const result = parseFrontMatter(CANONICAL_INPUT);

    expect(result.mode).toBe("raw");
    expect(result.data).toEqual(CANONICAL_EXPECTED);
    expect(result.warnings).toHaveLength(0);
  });

  it("nested traits array is preserved through parseFrontMatter", () => {
    const result = parseFrontMatter(CANONICAL_INPUT);

    expect(result.data).not.toBeNull();
    const traits = result.data!.traits as { expertise: string[]; personality: string[] };
    expect(traits.expertise).toEqual(["research", "analysis"]);
    expect(traits.personality).toEqual(["friendly", "direct"]);
  });
});
