# ADR-008: Front-Matter Parsing Strategy — Match Claude Code's Native Behavior

**Status:** Accepted (2026-05-19, operator resolved all three open questions)
**Date:** 2026-05-19
**Decision drivers:** CR-7 carryover from Sprint 3/4; Sprint 5 prerequisite gating Epic 06 (AgentCard). Operator scope clarification 2026-05-19: "We're building this for Claude Code specifically. PAI is a superset of Claude Code but it's not the focus point for us." Captured durably in `~/.claude/projects/-Users-zekebrinsfield-Documents-DevWork-ZoePlane/memory/feedback_claude_code_is_compatibility_target.md`.

## Context

The sidecar validation pipeline (`sidecar/src/indexer/validator.ts:222`) uses `gray-matter@4.0.3` with its default YAML engine (strict `js-yaml`) to parse front-matter from every indexed asset under `~/.claude/`. Strict YAML treats the bigram `: ` (colon-space) as a key/value delimiter, so a description line like:

```yaml
description: Use this agent for X including: **Solution Design**: Evaluating options
```

is parsed as nested mapping keys rather than a single string. **Empirically, 14/14 of the operator's PAI agent files at `~/.claude/agents/*.md` fail to parse under strict-mode gray-matter** — every file's `description` field uses unquoted prose containing colons and `**Term**:` markdown patterns. Failures surface today as `validation_status='invalid'` in the `assets` table and `front_matter_json=NULL`, captured at `validator.ts:228`.

This does not impact production today because Epic 03 finished without any consumer of `front_matter_json`. **It becomes a launch-day defect the moment Epic 06 AgentCard ships**, since the card UI in `ux-spec §7.8` is required by FR-010 to "render voice ID, archetype, trait composition from actual file front-matter — never fabricated values." With 14/14 agents flagged invalid, AgentCard would either render empty/error states for every agent on the operator's machine or have to fall back to placeholder UI for every card.

### What Claude Code actually does

The Claude Code CLI binary (`/opt/homebrew/Caskroom/claude-code@latest/2.1.143/claude`) is a Bun-compiled single executable. Reading the embedded source via `strings(1)` extraction (`/tmp/cc-strings.txt:332778-332780`) reveals the parser:

```javascript
// Constants (recovered from the binary, variable names from minification)
const FM_DELIMITER_RE = /^---\s*\n([\s\S]*?)---\s*\n?/;          // Z9H
const DANGEROUS_CHARS_RE = /[{}[\]*&#!|>%@`]|: /;                // pC1

function parseYaml(s) { return Bun.YAML.parse(s); }              // KzH

function preprocess(s) {                                          // BC1 — the escape pre-processor
  const lines = s.split('\n');
  const out = [];
  for (const line of lines) {
    const m = line.match(/^([a-zA-Z_-]+):\s+(.+)$/);
    if (m) {
      const [, key, value] = m;
      if (!key || !value) { out.push(line); continue; }
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        out.push(line); continue;                                 // already quoted — leave alone
      }
      if (DANGEROUS_CHARS_RE.test(value)) {
        const escaped = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
        out.push(`${key}: "${escaped}"`);                         // wrap in double quotes
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

function parseFrontmatter(content, sourceLabel) {                 // eY — the entry point
  const m = content.match(FM_DELIMITER_RE);
  if (!m) return { frontmatter: {}, content };
  const raw = m[1] || '';
  const body = content.slice(m[0].length);
  let data = {};
  try {
    data = parseYaml(raw);                                        // attempt 1: raw
  } catch {
    try {
      data = parseYaml(preprocess(raw));                          // attempt 2: pre-escaped
    } catch (err) {
      // Logs "Failed to parse YAML frontmatter" at warn level
      // Returns {frontmatter: {}, content: body} — file still loads, no invalidation
    }
  }
  return {
    frontmatter: (data && typeof data === 'object' && !Array.isArray(data)) ? data : {},
    content: body,
  };
}
```

Four properties of Claude Code's parser matter for the decision:

1. **Underlying YAML engine is `Bun.YAML.parse`** (the Bun runtime's built-in parser), not `js-yaml`. The two are very close in behavior on inputs we care about; differences are at the spec-edge.
2. **A regex-based escape pre-processor runs as a fallback.** For any line `key: value` where `value` is unquoted and contains any of `{ } [ ] * & # ! | > % @ \`` or the bigram `: `, the pre-processor wraps the value in double quotes (escaping internal `\` and `"`). YAML then sees a single quoted string instead of an attempted nested mapping.
3. **Parse-failure semantics are permissive.** If both attempts fail, frontmatter becomes `{}` but `content` is still returned. A warn-level log is emitted (`"Failed to parse YAML frontmatter"`). The file is **not invalidated**; downstream still gets the body.
4. **The published spec is silent on quoting.** The official docs at `https://code.claude.com/docs/en/skills` and `https://code.claude.com/docs/en/sub-agents` describe `description` as "What the skill does and when to use it" with all examples shown as unquoted prose. There is no mention of quoting rules, escape sequences, or special-character handling. Anthropic's contract with the ecosystem is: **write descriptions naturally, even when they contain colons or markdown.** The escape pre-processor is the undocumented implementation that makes that contract work.

### Empirical verification

A reconstruction of Claude Code's algorithm tested against the operator's full local corpus produces:

| Corpus | Files | Parsed (raw) | Parsed (pre-processed) | Failed |
|--------|-------|--------------|------------------------|--------|
| `~/.claude/agents` | 14 | 0 | 14 | 0 |
| `~/.claude/skills` (with front-matter) | 21 | 21 | 0 | 0 |
| `~/.claude/commands` | 20 | 20 | 0 | 0 |

The pre-processor is necessary only for the agents corpus, but it costs nothing for the rest (the first parse succeeds; the pre-processor never runs). Every agent that strict gray-matter rejects becomes parseable with full structured output (`name`, `model`, `description`, `color`, `voice_id`, `voice_name`, `traits`).

## Decision

**Adopt a hybrid parsing strategy that matches Claude Code's native algorithm: dual-attempt parsing with an escape pre-processor between attempts, falling through to per-field line-level extraction only if both YAML attempts fail.**

Concretely, the validator pipeline at `sidecar/src/indexer/validator.ts` adopts a three-tier strategy:

### Tier 1: Raw YAML parse (existing behavior)
Attempt to parse the front-matter block as-is via the YAML engine. If it succeeds and produces an object, return that object. **This is what 21/21 skill files and 20/20 command files hit today; no change for these.**

### Tier 2: Pre-processed YAML parse (new — matches Claude Code's BC1 function)
If Tier 1 throws, run the front-matter through the same line-level escape pre-processor Claude Code uses:
- For each line matching `^([a-zA-Z_-]+):\s+(.+)$`,
- if the value is not already wrapped in matching `"..."` or `'...'`,
- and the value contains any of `{ } [ ] * & # ! | > % @ \`` or the bigram `: `,
- replace the line with `key: "<escaped-value>"` where `<escaped-value>` is the original value with `\` → `\\` and `"` → `\"`.

Then re-attempt YAML parse on the pre-processed string. **This is what 14/14 agent files hit today; the tier moves them from invalid to valid with structured front-matter populated.**

### Tier 3: Per-field line-level extraction (new — graceful degradation)
If both Tier 1 and Tier 2 fail, run a regex-based extractor that pulls a small allowlist of well-known fields as raw strings: `name`, `description`, `voice_id`, `voice_name`, `color`, `model`, `version`. Each field is matched via `^<field>:\s*(.+)$` on a per-line basis with no nested-structure support. Arrays, mappings, and inline JSON are not extracted at this tier.

When Tier 3 succeeds for any field, set:
- `validation_status='warnings'` (not `'invalid'` — the file is still indexable; AgentCard renders a small "front-matter could not be fully parsed" badge)
- `front_matter_json` = the partial object produced by Tier 3
- Append warning code `front-matter-fallback-extraction` to the warnings array

When Tier 3 fails to extract any field, retain today's `validation_status='invalid'` behavior with `front_matter_json=NULL`.

### Implementation surface

The minimal change set is small:

1. **Custom gray-matter engine** in a new file `sidecar/src/indexer/front-matter-parser.ts` that exports `parseAssetFrontMatter(raw: string) → { data, mode }` where `mode` is one of `'raw' | 'preprocessed' | 'fallback' | 'failed'`. This module owns the three-tier algorithm.
2. **`validator.ts` swaps gray-matter's default engine for this custom engine** via the `engines.yaml` option — gray-matter exposes a custom engine hook (`matter(content, { engines: { yaml: customEngine } })`). The custom engine wraps Tiers 1 + 2; Tier 3 is invoked from `validator.ts` only when gray-matter throws.
3. **`validation_status` mapping update** at `validator.ts:228` — promote `'invalid'` to `'warnings'` whenever Tier 3 succeeded with at least one extracted field.
4. **New warning category `front-matter-fallback-extraction`** added to the warnings catalogue in `validator.ts`. Downstream AgentCard renders a small advisory badge when this warning is present.

### Why not "exactly mimic Bun.YAML"

`Bun.YAML.parse` is the Bun runtime's built-in YAML implementation. The validator runs in a Bun sidecar (per ADR-005), so **`Bun.YAML.parse` is directly callable** — we do not need a JavaScript port. Tier 1 and Tier 2 should call `Bun.YAML.parse` directly to maximize parity with Claude Code. `gray-matter`'s default engine (`js-yaml` strict) is replaced; gray-matter remains in the pipeline only for the front-matter delimiter detection and body extraction (which it already handles correctly). This pins the parse semantics to the same engine Claude Code uses, eliminating spec-edge divergence as a risk class.

### Why include Tier 3 at all

Two reasons:

1. **Defense in depth.** Claude Code's parser swallows total parse failures and returns `{frontmatter: {}, content: body}` — the file is still usable. AgentCard cannot render a card from `{}` because FR-010 requires real metadata. Tier 3 lets us render a card with degraded but real data (description + voice_id pulled by regex) when the YAML pipeline gives up.
2. **Future-proofing against ecosystem drift.** Today the agent corpus parses cleanly via Tier 2. If a future PAI variant introduces a front-matter pattern that breaks both YAML attempts (e.g., a malformed embedded JSON value), Tier 3 keeps AgentCard functional rather than producing an empty card. The cost is small — ~60 LOC of regex-based field extraction.

## Alternatives Considered

### Option A (rejected as standalone): Pre-processor only, no per-field fallback

Implement Tier 1 + Tier 2 exactly as Claude Code does, drop Tier 3. **Closest to perfect parity with Claude Code.** Total parse failures would mark assets `invalid` (same as today's behavior).

Rejected because: AgentCard's FR-010 requirement means an invalid agent renders no usable metadata. Without Tier 3, a single future pathological file produces an empty AgentCard, which is worse UX than a card with a "couldn't fully parse" badge. The marginal cost of Tier 3 is low (~60 LOC, regex-based), so the safety net is worth keeping.

### Option B (rejected as standalone): Per-field graceful degradation only

Keep strict gray-matter as Tier 1; if Tier 1 fails, fall straight through to per-field line extraction. No Tier 2 pre-processor.

Rejected because: this option loses **structural** front-matter (arrays like `traits.expertise`, nested objects, type coercion of booleans/numbers). 14/14 agents today have a nested `traits:` mapping with three array values. Without the Tier 2 pre-processor, every agent renders with a degraded badge and no trait composition data — which violates FR-010 ("trait composition rendered from actual file front-matter"). The pre-processor is what restores full structured parsing for the dominant failure mode in the operator's corpus.

### Option C (ruled out at scope-decision time): Push the PAI ecosystem to use proper YAML quoting

Document that descriptions must be quoted; emit warnings against unquoted descriptions; rely on community uptake to fix the corpus.

Ruled out per operator scope clarification 2026-05-19 — see `feedback_claude_code_is_compatibility_target.md`. ZoePlane is built for Claude Code natively; Claude Code itself does not require quoting and emits no warning when it auto-escapes via the BC1 pre-processor. Asking PAI authors (or anyone else) to change their files to satisfy ZoePlane's stricter parser would diverge from Claude Code's contract with the ecosystem.

## Consequences

**Positive:**

- 14/14 PAI agent files transition from `validation_status='invalid'` to `'valid'` with full structured `front_matter_json` populated. AgentCard launches with real metadata for every indexed agent on the operator's machine.
- Parity with Claude Code's native behavior means any file Claude Code can read, ZoePlane can render. This is the durable correctness guarantee called for by `feedback_claude_code_is_compatibility_target.md`.
- Three-tier strategy provides graceful degradation: a future pathological file degrades to a partially-rendered card with an advisory badge, not an empty error state.
- No change to skill / command parsing — Tier 1 still handles those at 100%.

**Negative:**

- Adds ~150 LOC across the new `front-matter-parser.ts` module and updates to `validator.ts`. Modest maintenance surface.
- Introduces a third validation status branch (Tier 3 success → `warnings`). UI must handle the new `front-matter-fallback-extraction` warning category — small AgentCard work.
- The pre-processor regex is a fingerprint of Claude Code's internal implementation. If Anthropic changes their pre-processor (e.g., adds new dangerous characters, removes the colon-space trigger), we will need to update ours. Risk class: low — the regex has been stable across multiple Claude Code releases the operator has run; the algorithm is simple and unlikely to need substantial revision.

**Neutral:**

- `ValidationFallbackWarning` (the not-shipped concept noted in ADR-007 §Risks R-1) remains unshipped. The new `front-matter-fallback-extraction` warning is per-asset and lives inside `AssetValidationUpdatedEvent.warnings`, not as a standalone event type. This is consistent with ADR-007 §Risks R-1 — adding a standalone event type would be an additive minor change, not required for this story.
- `IPC-API.md` does not need a refresh for this ADR; the event shapes locked in ADR-007 are unchanged.

## Risks

**R-1: Bun.YAML parser version drift.**
`Bun.YAML.parse` is part of the Bun runtime. If Bun upgrades to a YAML library version with different edge-case behavior than the one Claude Code 2.1.143 was compiled against, parser parity erodes. Mitigation: pin the sidecar's Bun version (per ADR-005, sidecar already runs on a known Bun version); add a smoke test that asserts a known-good corpus parses identically pre- and post-Bun-upgrade.

**R-2: Claude Code may evolve its pre-processor.**
The decompiled algorithm is from version 2.1.143 (May 2026). If Anthropic adds new YAML metacharacters to the dangerous-chars regex (e.g., a future YAML 1.3 introduces a new sigil), our implementation falls behind. Mitigation: include the Claude Code version under test in the parser module's docstring; revisit on major Claude Code releases.

**R-3: Per-field fallback (Tier 3) extracts only a subset of fields.**
A file that reaches Tier 3 will have its non-allowlist fields (e.g., `traits`, `metadata`) silently dropped. AgentCard renders the advisory badge but the user has no way to know which fields were lost without opening the file. Mitigation: surface the count of un-extractable fields in the warning payload so AgentCard can render "N additional fields could not be parsed."

**R-4: gray-matter is doing less work than its name implies.**
After this change, gray-matter only owns delimiter detection and body extraction. The actual YAML parsing is handled by `Bun.YAML.parse` via the custom engine hook. We could remove gray-matter entirely and write ~20 LOC of front-matter delimiter splitting ourselves. Deferred to a future refactor; not in scope for the Sprint 5 gate-class story.

## Relationship to Prior ADRs

- **ADR-005** (Watcher Layer): The sidecar runs on Bun, which exposes `Bun.YAML.parse` — this ADR depends on ADR-005's choice of Bun over Rust notify.
- **ADR-007** (Epic 03 IPC Contract): The `AssetValidationUpdatedEvent.warnings` field is the carrier for the new `front-matter-fallback-extraction` warning code. Adding a new warning code to an existing string-array field is an additive change per ADR-007 §5 — no SemVer bump required.
- **ADR-001 through ADR-004, ADR-006**: Orthogonal.

## Implementation Notes for Sprint 5

The implementation lives in a new gate-class first story for Sprint 5, drafted at `docs/stories/epic-06/story-6.X-front-matter-parsing.md`. Key elements:

- New module `sidecar/src/indexer/front-matter-parser.ts` (~150 LOC including tests).
- Wire-up at `validator.ts:222` to replace gray-matter's default engine.
- New warning code `front-matter-fallback-extraction` added to the warnings catalogue.
- Test corpus: 14 operator agent files + 21 operator skill files + 20 operator command files + 3 synthetic pathological-edge inputs (malformed-then-recoverable, malformed-then-Tier-3, malformed-then-fail).
- Acceptance criteria includes empirical verification: re-running the validation pipeline against the operator's `~/.claude/` produces 14/14 agents at `validation_status='valid'`.

## Open Questions for Operator — RESOLVED 2026-05-19

All three open questions resolved by operator at ADR-008 review time:

1. **Parser library: `Bun.YAML.parse` direct call.** Locked. Matches Claude Code's native algorithm exactly; drops gray-matter delegation to strict js-yaml. Sidecar already runs under Bun (per ADR-005), so the primitive is always available. Coupling to Bun runtime accepted as a trade-off for max Claude Code parity.
2. **AgentCard `warnings` state UX surface: deferred to ux-designer.** Sprint 5 Phase 0 spec work for the AgentCard story will own this decision. ADR-008 commits the data shape (`validation_status='warnings'` + `front-matter-fallback-extraction` warning code per ADR-007 §5 additive policy); UX layer chooses card-face vs Detail-view surfacing.
3. **Tier 3 (per-field regex fallback) included in v1.** Ship all three tiers in the Sprint 5 gate-class story. Tier 1+2 alone covers the operator's 14/14 PAI corpus today; Tier 3 (~60 LOC) is cheap insurance so AgentCard never renders an empty card from a future pathological file. Defense-in-depth posture matches Sprint 4 close-out philosophy.
