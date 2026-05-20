/**
 * isValidVoiceId — ElevenLabs voice ID format validation.
 *
 * Rule: A voice ID is valid when it matches /^[A-Za-z0-9]{15,32}$/.
 * (Alphanumeric, no separators, length range 15–32 chars observed across
 * the operator's agent corpus.)
 *
 * Usage in AgentCard (AC #4):
 *   - `voice_id` present AND passes regex → render normally
 *   - `voice_id` present AND FAILS regex → render with strike-through + `?` icon + warning indicator
 *   - `voice_id` absent/null → render "—" + warning indicator
 *
 * Story: 6.2 — Agent Library + AgentCard
 */

const VOICE_ID_REGEX = /^[A-Za-z0-9]{15,32}$/;

/**
 * Returns true if `value` is a valid ElevenLabs voice ID.
 * Returns false for null, undefined, empty string, or values that do not
 * match the expected alphanumeric 15–32 char pattern.
 */
export function isValidVoiceId(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  return VOICE_ID_REGEX.test(value);
}
