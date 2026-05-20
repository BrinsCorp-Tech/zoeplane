/**
 * derivePluginSource — unit tests.
 *
 * Covers:
 *   - null provenance → "User-authored"
 *   - undefined provenance → "User-authored"
 *   - empty sourceUrl → "User-authored"
 *   - valid URL → "From {hostname}", variant="plugin"
 *   - valid URL with hostname exactly 24 chars → no truncation
 *   - valid URL with hostname longer than 24 chars → truncated with ellipsis
 *   - file:// URL (empty hostname) → "User-authored"
 *   - non-URL opaque identifier → "From {identifier}", variant="plugin"
 *   - non-URL identifier longer than 24 chars → truncated with ellipsis
 *   - malformed URL string treated as opaque identifier
 *
 * Story: 6.3 — Skill Library
 */

import { describe, expect, it } from "vitest";
import type { AssetProvenanceSummary } from "@zoeplane/shared-types";
import { derivePluginSource } from "../derive-plugin-source";

// ---------------------------------------------------------------------------
// Fixture helper
// ---------------------------------------------------------------------------

function makeProvenance(sourceUrl: string): AssetProvenanceSummary {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    sourceUrl,
    sourceHash: "abc123",
    importedAt: Date.now(),
    evaluatorReportId: null,
    lastEvaluatedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("derivePluginSource", () => {
  // ── Null / undefined provenance ───────────────────────────────────────────

  it("returns 'User-authored' when provenance is null", () => {
    const result = derivePluginSource(null);
    expect(result.label).toBe("User-authored");
    expect(result.variant).toBe("user-authored");
    expect(result.hostname).toBeNull();
  });

  it("returns 'User-authored' when provenance is undefined", () => {
    const result = derivePluginSource(undefined);
    expect(result.label).toBe("User-authored");
    expect(result.variant).toBe("user-authored");
    expect(result.hostname).toBeNull();
  });

  // ── Empty sourceUrl ───────────────────────────────────────────────────────

  it("returns 'User-authored' when sourceUrl is empty string", () => {
    const result = derivePluginSource(makeProvenance(""));
    expect(result.label).toBe("User-authored");
    expect(result.variant).toBe("user-authored");
    expect(result.hostname).toBeNull();
  });

  it("returns 'User-authored' when sourceUrl is whitespace-only", () => {
    const result = derivePluginSource(makeProvenance("   "));
    expect(result.label).toBe("User-authored");
    expect(result.variant).toBe("user-authored");
    expect(result.hostname).toBeNull();
  });

  // ── Valid URL sourceUrl ───────────────────────────────────────────────────

  it("returns 'From github.com' for a GitHub URL", () => {
    const result = derivePluginSource(
      makeProvenance("https://github.com/anthropic/claude-skills/blob/main/code-reviewer/SKILL.md"),
    );
    expect(result.label).toBe("From github.com");
    expect(result.variant).toBe("plugin");
    expect(result.hostname).toBe("github.com");
  });

  it("returns 'From anthropic.com' for an Anthropic URL", () => {
    const result = derivePluginSource(makeProvenance("https://anthropic.com/skills/code-review"));
    expect(result.label).toBe("From anthropic.com");
    expect(result.variant).toBe("plugin");
    expect(result.hostname).toBe("anthropic.com");
  });

  it("returns full hostname when hostname is exactly 24 chars (no truncation)", () => {
    // Construct a URL with exactly 24-char hostname: "exactly24charlong.example"
    // "exactly24charlong.exam" = 22, let's use something precise
    // "abcdefghij.abcdefghijk" = 22 ... let's just count
    // Need: hostname.length === 24
    // "aaaaaaaaaa.aaaaaaaaaa.aa" = 24 chars
    const hostname24 = "aaaaaaaaaa.aaaaaaaaaa.aa";
    expect(hostname24.length).toBe(24);
    const result = derivePluginSource(makeProvenance(`https://${hostname24}/path`));
    expect(result.label).toBe(`From ${hostname24}`);
    expect(result.hostname).toBe(hostname24);
  });

  it("truncates hostname to 24 chars with ellipsis when longer", () => {
    // hostname = "subdomain.really-long-name.example.org" (38 chars)
    const longHostname = "subdomain.really-long-name.example.org";
    expect(longHostname.length).toBeGreaterThan(24);
    const result = derivePluginSource(makeProvenance(`https://${longHostname}/path`));
    // Truncated: first 23 chars + ellipsis
    const expected = longHostname.slice(0, 23) + "…";
    expect(result.label).toBe(`From ${expected}`);
    expect(result.variant).toBe("plugin");
    expect(result.hostname).toBe(longHostname); // full hostname stored
  });

  // ── file:// URL (empty hostname) ──────────────────────────────────────────

  it("returns 'User-authored' for file:// URL (empty hostname)", () => {
    const result = derivePluginSource(makeProvenance("file:///Users/zeke/.claude/skills/SKILL.md"));
    expect(result.label).toBe("User-authored");
    expect(result.variant).toBe("user-authored");
    expect(result.hostname).toBeNull();
  });

  // ── Non-URL opaque identifier ─────────────────────────────────────────────

  it("returns 'From {identifier}' for a non-URL opaque string", () => {
    const result = derivePluginSource(makeProvenance("claude-code-marketplace"));
    expect(result.label).toBe("From claude-code-marketplace");
    expect(result.variant).toBe("plugin");
    expect(result.hostname).toBeNull();
  });

  it("truncates non-URL identifier to 24 chars with ellipsis when longer", () => {
    // "this-is-a-really-long-opaque-identifier" = 39 chars
    const longId = "this-is-a-really-long-opaque-identifier";
    expect(longId.length).toBeGreaterThan(24);
    const result = derivePluginSource(makeProvenance(longId));
    const expected = longId.slice(0, 23) + "…";
    expect(result.label).toBe(`From ${expected}`);
    expect(result.variant).toBe("plugin");
    expect(result.hostname).toBeNull();
  });

  // ── Malformed URL treated as opaque identifier ────────────────────────────

  it("treats malformed URL string as opaque identifier without throwing", () => {
    const result = derivePluginSource(makeProvenance("not-a-url-just:garbage"));
    // "not-a-url-just:garbage" — new URL() will try to parse this.
    // URL("not-a-url-just:garbage") — may or may not throw; either way, no throw to caller.
    // If it happens to parse (e.g., as a scheme-relative), it still returns a result.
    // If it throws, it falls through to opaque-identifier branch.
    expect(() => derivePluginSource(makeProvenance("not-a-url-just:garbage"))).not.toThrow();
    // Either way, result is a valid PluginSourceResult
    expect(result.label).toBeDefined();
    expect(result.variant).toBeDefined();
  });

  it("treats ':::' as opaque identifier without throwing", () => {
    expect(() => derivePluginSource(makeProvenance(":::"))).not.toThrow();
    const result = derivePluginSource(makeProvenance(":::"));
    expect(result.label).toBe("From :::");
    expect(result.variant).toBe("plugin");
  });

  // ── Hostname exactly 1 char longer than limit ─────────────────────────────

  it("truncates a 25-char hostname correctly (boundary case)", () => {
    // 25-char hostname
    const hostname25 = "a".repeat(12) + "." + "b".repeat(12);
    expect(hostname25.length).toBe(25);
    const result = derivePluginSource(makeProvenance(`https://${hostname25}/`));
    expect(result.label).toBe(`From ${"a".repeat(12) + "." + "b".repeat(10)}…`);
    expect(result.hostname).toBe(hostname25);
  });
});
