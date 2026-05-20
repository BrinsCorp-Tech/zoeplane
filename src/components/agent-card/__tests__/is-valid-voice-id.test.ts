/**
 * Tests for isValidVoiceId — ElevenLabs voice ID format check.
 * Valid IDs, malformed IDs, null/undefined.
 * Story: 6.2
 */

import { describe, it, expect } from "vitest";
import { isValidVoiceId } from "../is-valid-voice-id";

describe("isValidVoiceId", () => {
  // ── Valid IDs ────────────────────────────────────────────────────────────

  it("accepts a 15-char alphanumeric ID (minimum length)", () => {
    expect(isValidVoiceId("ABC123defghijkl")).toBe(true);
  });

  it("accepts a 32-char alphanumeric ID (maximum length)", () => {
    expect(isValidVoiceId("A".repeat(32))).toBe(true);
  });

  it("accepts a 20-char mixed-case ID", () => {
    expect(isValidVoiceId("8fcyCHOzlKDlxh1InJSf")).toBe(true);
  });

  it("accepts IDs with digits only", () => {
    expect(isValidVoiceId("123456789012345")).toBe(true); // 15 chars
  });

  it("accepts IDs with lowercase letters only", () => {
    expect(isValidVoiceId("abcdefghijklmno")).toBe(true); // 15 chars
  });

  it("accepts IDs with uppercase letters only", () => {
    expect(isValidVoiceId("ABCDEFGHIJKLMNO")).toBe(true); // 15 chars
  });

  // ── Too short ────────────────────────────────────────────────────────────

  it("rejects a 14-char ID (one below minimum)", () => {
    expect(isValidVoiceId("abc123def45678")).toBe(false); // 14 chars
  });

  it("rejects an empty string", () => {
    expect(isValidVoiceId("")).toBe(false);
  });

  it("rejects a single character", () => {
    expect(isValidVoiceId("a")).toBe(false);
  });

  // ── Too long ─────────────────────────────────────────────────────────────

  it("rejects a 33-char ID (one above maximum)", () => {
    expect(isValidVoiceId("A".repeat(33))).toBe(false);
  });

  // ── Special characters ───────────────────────────────────────────────────

  it("rejects IDs with hyphens", () => {
    expect(isValidVoiceId("abc-def-ghi-jklm")).toBe(false);
  });

  it("rejects IDs with underscores", () => {
    expect(isValidVoiceId("abc_def_ghi_jklm")).toBe(false);
  });

  it("rejects IDs with spaces", () => {
    expect(isValidVoiceId("abc def ghi jklm")).toBe(false);
  });

  it("rejects IDs with special chars (!)", () => {
    expect(isValidVoiceId("short!")).toBe(false);
  });

  it("rejects IDs with leading spaces", () => {
    expect(isValidVoiceId(" abc123def456xyz0")).toBe(false);
  });

  // ── Non-string inputs ────────────────────────────────────────────────────

  it("returns false for null", () => {
    expect(isValidVoiceId(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isValidVoiceId(undefined)).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isValidVoiceId(12345)).toBe(false);
  });

  it("returns false for an object", () => {
    expect(isValidVoiceId({ id: "abc123" })).toBe(false);
  });

  it("returns false for an array", () => {
    expect(isValidVoiceId(["abc123def456xyz"])).toBe(false);
  });

  it("returns false for a boolean", () => {
    expect(isValidVoiceId(true)).toBe(false);
  });
});
