/**
 * Unit tests for formatRelativeTime (src/lib/format-relative-time.ts).
 *
 * Story: 6.15 — formatRelativeTime Hoist to src/lib/
 *
 * Uses the `now` injection parameter for fully deterministic, clock-independent
 * assertions. All threshold boundary tests verify which bucket each edge value
 * falls into.
 */

import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "../format-relative-time";

// ---------------------------------------------------------------------------
// Constants (mirrored from implementation for readability)
// ---------------------------------------------------------------------------

const SEC = 1_000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const NOW = 1_000_000_000_000; // arbitrary fixed epoch ms

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function ago(ms: number): number {
  return NOW - ms;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("formatRelativeTime", () => {
  describe("seven-bucket output", () => {
    it('returns "just now" for 0 ms ago', () => {
      expect(formatRelativeTime(ago(0), NOW)).toBe("just now");
    });

    it('returns "just now" for 59 s ago (< 60 s threshold)', () => {
      expect(formatRelativeTime(ago(59 * SEC), NOW)).toBe("just now");
    });

    it('returns "1m ago" for exactly 60 s ago (minutes bucket lower bound)', () => {
      expect(formatRelativeTime(ago(MIN), NOW)).toBe("1m ago");
    });

    it('returns "Xm ago" for 30 minutes ago', () => {
      expect(formatRelativeTime(ago(30 * MIN), NOW)).toBe("30m ago");
    });

    it('returns "59m ago" for 59 minutes ago (still in minutes bucket)', () => {
      expect(formatRelativeTime(ago(59 * MIN), NOW)).toBe("59m ago");
    });

    it('returns "1h ago" for exactly 1 hour ago (hours bucket lower bound)', () => {
      expect(formatRelativeTime(ago(HOUR), NOW)).toBe("1h ago");
    });

    it('returns "Xh ago" for 12 hours ago', () => {
      expect(formatRelativeTime(ago(12 * HOUR), NOW)).toBe("12h ago");
    });

    it('returns "23h ago" for 23 hours ago (still in hours bucket)', () => {
      expect(formatRelativeTime(ago(23 * HOUR), NOW)).toBe("23h ago");
    });

    it('returns "1d ago" for exactly 1 day ago (days bucket lower bound)', () => {
      expect(formatRelativeTime(ago(DAY), NOW)).toBe("1d ago");
    });

    it('returns "Xd ago" for 4 days ago', () => {
      expect(formatRelativeTime(ago(4 * DAY), NOW)).toBe("4d ago");
    });

    it('returns "6d ago" for 6 days ago (still in days bucket)', () => {
      expect(formatRelativeTime(ago(6 * DAY), NOW)).toBe("6d ago");
    });

    it('returns "1w ago" for exactly 1 week / 7 days ago (weeks bucket lower bound)', () => {
      expect(formatRelativeTime(ago(WEEK), NOW)).toBe("1w ago");
    });

    it('returns "Xw ago" for 3 weeks ago', () => {
      expect(formatRelativeTime(ago(3 * WEEK), NOW)).toBe("3w ago");
    });

    it('returns "4w ago" for 29 days ago (still in weeks bucket — < 30d threshold)', () => {
      expect(formatRelativeTime(ago(29 * DAY), NOW)).toBe("4w ago");
    });

    it('returns "1mo ago" for exactly 30 days ago (months bucket lower bound)', () => {
      expect(formatRelativeTime(ago(MONTH), NOW)).toBe("1mo ago");
    });

    it('returns "Xmo ago" for 6 months ago', () => {
      expect(formatRelativeTime(ago(6 * MONTH), NOW)).toBe("6mo ago");
    });

    it('returns "11mo ago" for 11 months ago (still in months bucket — < 365d threshold)', () => {
      expect(formatRelativeTime(ago(11 * MONTH), NOW)).toBe("11mo ago");
    });

    it('returns "1yr ago" for exactly 1 year / 365 days ago (years bucket lower bound)', () => {
      expect(formatRelativeTime(ago(YEAR), NOW)).toBe("1yr ago");
    });

    it('returns "Xyr ago" for 3 years ago', () => {
      expect(formatRelativeTime(ago(3 * YEAR), NOW)).toBe("3yr ago");
    });
  });

  describe("Number.isFinite guard", () => {
    it("returns empty string for NaN", () => {
      expect(formatRelativeTime(NaN, NOW)).toBe("");
    });

    it("returns empty string for Infinity", () => {
      expect(formatRelativeTime(Infinity, NOW)).toBe("");
    });

    it("returns empty string for -Infinity", () => {
      expect(formatRelativeTime(-Infinity, NOW)).toBe("");
    });
  });

  describe("now injection", () => {
    it("uses the injected now parameter instead of Date.now()", () => {
      const fixedNow = 2_000_000_000_000;
      const twoHoursBeforeFixedNow = fixedNow - 2 * HOUR;
      expect(formatRelativeTime(twoHoursBeforeFixedNow, fixedNow)).toBe("2h ago");
    });

    it("produces deterministic output for the same inputs regardless of wall clock", () => {
      const result1 = formatRelativeTime(ago(5 * MIN), NOW);
      const result2 = formatRelativeTime(ago(5 * MIN), NOW);
      expect(result1).toBe(result2);
      expect(result1).toBe("5m ago");
    });
  });

  describe("exact threshold boundaries", () => {
    it("60s falls in minutes bucket, not just-now bucket", () => {
      expect(formatRelativeTime(ago(60 * SEC), NOW)).toBe("1m ago");
    });

    it("60m falls in hours bucket, not minutes bucket", () => {
      expect(formatRelativeTime(ago(60 * MIN), NOW)).toBe("1h ago");
    });

    it("24h falls in days bucket, not hours bucket", () => {
      expect(formatRelativeTime(ago(24 * HOUR), NOW)).toBe("1d ago");
    });

    it("7d falls in weeks bucket, not days bucket", () => {
      expect(formatRelativeTime(ago(7 * DAY), NOW)).toBe("1w ago");
    });

    it("30d falls in months bucket, not weeks bucket", () => {
      expect(formatRelativeTime(ago(30 * DAY), NOW)).toBe("1mo ago");
    });

    it("365d falls in years bucket, not months bucket", () => {
      expect(formatRelativeTime(ago(365 * DAY), NOW)).toBe("1yr ago");
    });
  });
});
