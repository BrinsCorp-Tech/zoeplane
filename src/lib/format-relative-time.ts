/**
 * formatRelativeTime — Unix epoch ms → human-readable relative time.
 *
 * Examples:
 *   0–59 s   → "just now"
 *   1–59 m   → "Xm ago"
 *   1–23 h   → "Xh ago"
 *   1–6 d    → "Xd ago"
 *   7+ d     → "Xw ago"
 *   4+ w     → "Xmo ago"
 *   12+ mo   → "Xyr ago"
 *
 * Story: 6.2 — Agent Library + AgentCard
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

/**
 * Format a Unix epoch millisecond timestamp as a relative time string.
 * Falls back to an empty string if the value is not a valid number.
 */
export function formatRelativeTime(epochMs: number, now = Date.now()): string {
  if (!Number.isFinite(epochMs)) return "";

  const diff = now - epochMs;

  if (diff < MINUTE_MS) return "just now";
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h ago`;
  if (diff < WEEK_MS) return `${Math.floor(diff / DAY_MS)}d ago`;
  if (diff < MONTH_MS) return `${Math.floor(diff / WEEK_MS)}w ago`;
  if (diff < YEAR_MS) return `${Math.floor(diff / MONTH_MS)}mo ago`;

  return `${Math.floor(diff / YEAR_MS)}yr ago`;
}
