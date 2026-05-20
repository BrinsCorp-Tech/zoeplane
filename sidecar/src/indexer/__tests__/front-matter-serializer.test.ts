// ZoePlane — Front-matter serializer tests
//
// Critical invariant: unknown fields (e.g. tools: [Bash, Read]) MUST be
// preserved through a serialize → parse round-trip without modification.
//
// Story: 6.4 (FR-004)

// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  serializeSkillFile,
  setYamlStringifier,
  resetSerializerCache,
} from "../front-matter-serializer";

// ---------------------------------------------------------------------------
// YAML stringifier injection for Node test environment (mirrors parser injection)
// ---------------------------------------------------------------------------

import yaml from "js-yaml";

beforeEach(() => {
  resetSerializerCache();
  // Inject js-yaml stringify since Bun.YAML is not available in Vitest/Node
  setYamlStringifier((obj: Record<string, unknown>) => yaml.dump(obj, { lineWidth: -1 }));
});

afterEach(() => {
  resetSerializerCache();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("serializeSkillFile", () => {
  // ── Basic round-trip ───────────────────────────────────────────────────────

  it("produces a file starting with ---\\n", async () => {
    const result = await serializeSkillFile({ name: "code-reviewer" }, "This is the body.");
    expect(result.trimStart().startsWith("---")).toBe(true);
  });

  it("includes the closing --- delimiter", async () => {
    const result = await serializeSkillFile({ name: "code-reviewer" }, "Body text.");
    expect(result).toContain("---\n");
    // Should have at least two --- occurrences (opening + closing)
    const count = (result.match(/^---/gm) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("includes the body after the closing ---", async () => {
    const result = await serializeSkillFile({ name: "x" }, "The skill body here.");
    expect(result).toContain("The skill body here.");
  });

  it("ends with a single newline", async () => {
    const result = await serializeSkillFile({ name: "x" }, "Body.");
    expect(result.endsWith("\n")).toBe(true);
    expect(result.endsWith("\n\n")).toBe(false);
  });

  // ── Unknown field preservation (CRITICAL invariant) ────────────────────────

  it("preserves unknown array field tools: [Bash, Read] in serialized output", async () => {
    const fm: Record<string, unknown> = {
      name: "code-reviewer",
      description: "A code review skill",
      tools: ["Bash", "Read"],
    };
    const result = await serializeSkillFile(fm, "# Code Reviewer\n\nThis is the body.");
    // The tools array must appear in the output
    expect(result).toContain("tools:");
    expect(result).toContain("Bash");
    expect(result).toContain("Read");
  });

  it("round-trips: parsed output contains the same tools array", async () => {
    const fm: Record<string, unknown> = {
      name: "code-reviewer",
      description: "Review skill",
      tools: ["Bash", "Read", "Write"],
    };
    const serialized = await serializeSkillFile(fm, "Body text.");

    // Parse the serialized output to verify round-trip
    const FM_RE = /^---\s*\n([\s\S]*?)---\s*\n?([\s\S]*)$/;
    const match = serialized.match(FM_RE);
    expect(match).not.toBeNull();
    const yamlBlock = match![1] ?? "";
    const parsed = yaml.load(yamlBlock) as Record<string, unknown>;

    expect(parsed.name).toBe("code-reviewer");
    expect(parsed.description).toBe("Review skill");
    expect(Array.isArray(parsed.tools)).toBe(true);
    expect(parsed.tools).toEqual(["Bash", "Read", "Write"]);
  });

  it("preserves nested object unknown fields", async () => {
    const fm: Record<string, unknown> = {
      name: "x",
      metadata: { author: "alice", tags: ["a", "b"] },
    };
    const result = await serializeSkillFile(fm, "Body.");
    expect(result).toContain("metadata:");
  });

  // ── CRLF normalization ─────────────────────────────────────────────────────

  it("normalizes CRLF in body to LF", async () => {
    const result = await serializeSkillFile({ name: "x" }, "Line 1\r\nLine 2\r\nLine 3");
    expect(result).not.toContain("\r\n");
    expect(result).toContain("Line 1\nLine 2");
  });

  it("normalizes CRLF with raw \\r\\n string literal in body", async () => {
    // Use raw \r\n literal as required by feedback_text_content_crlf_normalize.md
    const bodyWithCrlf = "First line\r\nSecond line\r\nThird line";
    const result = await serializeSkillFile({ name: "x" }, bodyWithCrlf);
    expect(result).not.toContain("\r\n");
    expect(result).toContain("First line\nSecond line");
  });

  // ── Known fields ───────────────────────────────────────────────────────────

  it("includes all known fields in the output", async () => {
    const fm: Record<string, unknown> = {
      name: "test-skill",
      description: "A test skill",
      version: "1.2.3",
      voice_id: "AbcDe12345",
      voice_name: "Joseph",
      model: "claude-sonnet",
      color: "#1a2b3c",
    };
    const result = await serializeSkillFile(fm, "Body.");
    expect(result).toContain("name:");
    expect(result).toContain("test-skill");
    expect(result).toContain("description:");
    expect(result).toContain("version:");
    expect(result).toContain("1.2.3");
  });

  // ── Body content ───────────────────────────────────────────────────────────

  it("preserves multiline markdown body", async () => {
    const body = "# Heading\n\nParagraph one.\n\nParagraph two.\n\n- item 1\n- item 2";
    const result = await serializeSkillFile({ name: "x" }, body);
    expect(result).toContain("# Heading");
    expect(result).toContain("Paragraph one.");
    expect(result).toContain("- item 1");
  });

  it("handles empty body", async () => {
    const result = await serializeSkillFile({ name: "x" }, "");
    // Should still produce valid delimiters
    expect(result.trimStart().startsWith("---")).toBe(true);
  });

  // ── Format compatibility ───────────────────────────────────────────────────

  it("produces output that starts with ---\\n (Claude Code format)", async () => {
    const result = await serializeSkillFile({ name: "my-skill" }, "Body.");
    // Claude Code expects exactly ---\n (not --- \n or ---\r\n)
    expect(result.startsWith("---\n")).toBe(true);
  });
});
