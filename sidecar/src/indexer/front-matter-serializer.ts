// ZoePlane Sidecar — Front-Matter Serializer
//
// Serializes a skill file back to disk format, preserving:
//   1. All unknown fields verbatim (arrays, objects, scalars)
//   2. The ---\n...\n---\n delimiter format Claude Code expects
//   3. POSIX line endings (CRLF → LF normalization at entry)
//
// Strategy (per Story 6.4 Technical Notes):
//   Try gray-matter stringify first. gray-matter is the same parser used on
//   read, so it produces output that round-trips cleanly. If gray-matter
//   throws or produces output that doesn't parse back cleanly (defensive check),
//   fall through to the custom serializer.
//
// The serializer accepts:
//   - frontMatter: Record<string, unknown>  — the full front-matter object
//     (known fields + preserved unknown fields combined)
//   - body: string  — the markdown body (without delimiters)
//
// Returns the full file content: `---\n<yaml>\n---\n<body>\n`
//
// Story: 6.4 — Skill Detail + Skill Editor (FR-004)

import { log } from "../log";

// ---------------------------------------------------------------------------
// YAML serializer injection (mirrors parser injection pattern)
// ---------------------------------------------------------------------------

type YamlStringifier = (obj: Record<string, unknown>) => string;

let _yamlStringify: YamlStringifier = (obj) => {
  // Default: Bun.YAML.stringify — production always has Bun (ADR-005).
  if (typeof Bun === "undefined" || typeof Bun.YAML?.stringify !== "function") {
    throw new Error(
      "Bun.YAML.stringify unavailable; setYamlStringifier() must be called in non-Bun runtimes",
    );
  }
  return Bun.YAML.stringify(obj);
};

/** Test injection hook — mirrors setYamlParser() in front-matter-parser.ts. */
export function setYamlStringifier(fn: YamlStringifier): void {
  _yamlStringify = fn;
}

// ---------------------------------------------------------------------------
// gray-matter dynamic import (mirrors validator.ts pattern)
// ---------------------------------------------------------------------------

type MatterModule = {
  stringify: (content: string, data: Record<string, unknown>) => string;
};

let matterModule: MatterModule | null = null;
let matterLoadAttempted = false;

/** Reset loader cache — test helper. */
export function resetSerializerCache(): void {
  matterModule = null;
  matterLoadAttempted = false;
}

async function loadGrayMatterStringify(): Promise<MatterModule | null> {
  if (matterLoadAttempted) return matterModule;
  matterLoadAttempted = true;
  try {
    const mod = await import("gray-matter");
    const rawMatter = (mod.default ?? mod) as unknown as {
      stringify: (content: string, data: Record<string, unknown>) => string;
    };
    matterModule = { stringify: rawMatter.stringify.bind(rawMatter) };
    return matterModule;
  } catch (err) {
    log("WARN", "Serializer: failed to import gray-matter — falling back to custom serializer", {
      error: String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Custom YAML serializer fallback
// ---------------------------------------------------------------------------

/**
 * Custom serializer using Bun.YAML.stringify.
 * Called when gray-matter is unavailable. Produces `---\n<yaml>\n---\n<body>\n`.
 */
function customSerialize(frontMatter: Record<string, unknown>, body: string): string {
  // CRLF → LF at entry (durable rule: feedback_text_content_crlf_normalize.md)
  const normalizedBody = body.replace(/\r\n/g, "\n");
  const yamlBlock = _yamlStringify(frontMatter);
  // Ensure the YAML block does not have a trailing newline — we add exactly one
  const trimmedYaml = yamlBlock.replace(/\n+$/, "");
  const normalizedBody2 = normalizedBody.replace(/\n+$/, "");
  return `---\n${trimmedYaml}\n---\n${normalizedBody2}\n`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialize a skill's front-matter and body to the canonical on-disk format.
 *
 * CRLF → LF normalization is applied to the body at entry (per
 * feedback_text_content_crlf_normalize.md). The front-matter YAML is
 * serialized via gray-matter stringify (primary) or Bun.YAML.stringify
 * (fallback).
 *
 * @param frontMatter  The full front-matter object (known + unknown fields).
 * @param body         The markdown body text (without --- delimiters).
 * @returns The complete file content: `---\n<yaml>\n---\n<body>\n`
 */
export async function serializeSkillFile(
  frontMatter: Record<string, unknown>,
  body: string,
): Promise<string> {
  // CRLF → LF normalize at I/O entry
  const normalizedBody = body.replace(/\r\n/g, "\n");
  const trimmedBody = normalizedBody.replace(/\n+$/, "");

  const gm = await loadGrayMatterStringify();

  if (gm !== null) {
    try {
      const result = gm.stringify(trimmedBody, frontMatter);
      // Defensive: verify the result starts with --- (gray-matter contract)
      if (result.trimStart().startsWith("---")) {
        // Ensure exactly one trailing newline
        return result.replace(/\n+$/, "") + "\n";
      }
      log("WARN", "Serializer: gray-matter stringify produced unexpected output — falling back", {
        preview: result.slice(0, 80),
      });
    } catch (err) {
      log("WARN", "Serializer: gray-matter stringify threw — falling back to custom serializer", {
        error: String(err),
      });
    }
  }

  return customSerialize(frontMatter, trimmedBody);
}
