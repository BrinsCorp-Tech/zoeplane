/**
 * Tests for deriveArchetype — WARN F resolution priority chain.
 * All 4 branches + edge cases (null, empty string, wrong type).
 * Story: 6.2
 */

import { describe, it, expect } from "vitest";
import { deriveArchetype } from "../derive-archetype";

describe("deriveArchetype", () => {
  // ── Priority 1: explicit archetype field ────────────────────────────────

  it("returns archetype field when present and non-empty", () => {
    const result = deriveArchetype({ archetype: "The Craftsman" });
    expect(result).toEqual({ value: "The Craftsman", source: "archetype" });
  });

  it("trims whitespace from archetype field", () => {
    const result = deriveArchetype({ archetype: "  Efficiency  " });
    expect(result).toEqual({ value: "Efficiency", source: "archetype" });
  });

  // ── Priority 2: traits.personality[0] title-cased ───────────────────────

  it("falls through to traits.personality[0] when archetype is absent", () => {
    const result = deriveArchetype({
      traits: { personality: ["empathy", "systems_thinking"] },
    });
    expect(result).toEqual({ value: "Empathy", source: "trait-personality" });
  });

  it("title-cases the first personality trait", () => {
    const result = deriveArchetype({
      traits: { personality: ["systems_thinking"] },
    });
    expect(result).toEqual({ value: "Systems_thinking", source: "trait-personality" });
  });

  it("falls through personality when archetype is empty string", () => {
    const result = deriveArchetype({
      archetype: "",
      traits: { personality: ["directness"] },
    });
    expect(result).toEqual({ value: "Directness", source: "trait-personality" });
  });

  it("falls through personality when archetype is whitespace-only", () => {
    const result = deriveArchetype({
      archetype: "   ",
      traits: { personality: ["efficiency"] },
    });
    expect(result).toEqual({ value: "Efficiency", source: "trait-personality" });
  });

  // ── Priority 3: description first 60 chars word-boundary ────────────────

  it("falls through to description when personality is absent", () => {
    const result = deriveArchetype({
      description: "Implements features efficiently and ships working code.",
    });
    expect(result).toEqual({
      value: "Implements features efficiently and ships working code.",
      source: "description",
    });
  });

  it("truncates description at word boundary when over 60 chars", () => {
    const long =
      "Implements features efficiently without sacrificing code quality or maintainability";
    const result = deriveArchetype({ description: long });
    expect(result.source).toBe("description");
    expect(result.value.length).toBeLessThanOrEqual(61); // 60 chars + "…"
    expect(result.value.endsWith("…")).toBe(true);
    // Should break at word boundary
    expect(result.value).not.toMatch(/\s…$/);
  });

  it("does not truncate description exactly at 60 chars", () => {
    const exact60 = "A".repeat(60);
    const result = deriveArchetype({ description: exact60 });
    expect(result.value).toBe(exact60);
    expect(result.value.endsWith("…")).toBe(false);
  });

  it("falls through to description when personality array is empty", () => {
    const result = deriveArchetype({
      traits: { personality: [] },
      description: "Designs systems",
    });
    expect(result.source).toBe("description");
  });

  it("falls through to description when personality entries are non-strings", () => {
    const result = deriveArchetype({
      traits: { personality: [42, null] },
      description: "Research specialist",
    });
    expect(result.source).toBe("description");
  });

  // ── Priority 4: missing placeholder ─────────────────────────────────────

  it("returns missing placeholder when frontMatter is null", () => {
    const result = deriveArchetype(null);
    expect(result).toEqual({ value: "—", source: "missing" });
  });

  it("returns missing when no fields match", () => {
    const result = deriveArchetype({});
    expect(result).toEqual({ value: "—", source: "missing" });
  });

  it("returns missing when all fields are present but empty", () => {
    const result = deriveArchetype({
      archetype: "",
      traits: { personality: [] },
      description: "",
    });
    expect(result).toEqual({ value: "—", source: "missing" });
  });

  it("returns missing when traits is null", () => {
    const result = deriveArchetype({ traits: null });
    expect(result).toEqual({ value: "—", source: "missing" });
  });

  it("returns missing when traits is an array (wrong type)", () => {
    const result = deriveArchetype({ traits: ["efficiency"] });
    expect(result).toEqual({ value: "—", source: "missing" });
  });

  it("returns missing when description is whitespace-only", () => {
    const result = deriveArchetype({ description: "   " });
    expect(result).toEqual({ value: "—", source: "missing" });
  });

  it("returns missing when archetype is non-string (number)", () => {
    const result = deriveArchetype({ archetype: 42 });
    expect(result).toEqual({ value: "—", source: "missing" });
  });

  // ── Strict priority order ────────────────────────────────────────────────

  it("prefers archetype over personality when both present", () => {
    const result = deriveArchetype({
      archetype: "The Analyst",
      traits: { personality: ["efficiency"] },
    });
    expect(result.source).toBe("archetype");
    expect(result.value).toBe("The Analyst");
  });

  it("prefers personality over description when both present", () => {
    const result = deriveArchetype({
      traits: { personality: ["directness"] },
      description: "Falls through to here only when no personality",
    });
    expect(result.source).toBe("trait-personality");
  });
});
