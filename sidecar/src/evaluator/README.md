# Skill Safety Evaluator (`sidecar/src/evaluator/`)

The Skill Safety Evaluator is a tamper-resistant gate that inspects every skill,
agent, and hook before activation. Epic 05, Sprint 8.

## What it does

Per PRD §1.9 and FR-082 through FR-094:
- Static analysis of skill/agent YAML front-matter (declared tools, permissions)
- Shell command scanning for hooks (exfiltration patterns, filesystem writes, network calls)
- Risk classification: Low / Medium / High / Error
- Summary generation: human-readable "what does this thing actually do?"
- Source-pull re-evaluation: when a remote-sourced skill changes, diff the findings
  (RiskDelta view per ux-spec §7.13.D and FR-086)

## Evaluator modes

- **Standard mode (default):** skills/agents get evaluator pass on import; user sees
  findings before approval. Hooks get evaluator pass; in default Soft Notification mode,
  externally-discovered hooks fire normally but surface `pending review` badge.
- **Strict Mode (opt-in, FR-108):** externally-discovered hooks are quarantined until
  user reviews. Activates FR-102, FR-103, FR-105, FR-106.

## TODO (Epic 05, Sprint 8)

Implement:
- `runner.ts` — evaluator orchestrator (receives skill/agent/hook payload, runs passes)
- `passes/static-analysis.ts` — YAML/front-matter static parser + risk classifier
- `passes/shell-scan.ts` — hook command scanner (network, fs-write, exfil patterns)
- `passes/summary-gen.ts` — LLM-assisted summary via Path A/B (uses the user's own assistant)
- `risk-delta.ts` — source-pull delta diff against prior approved evaluation
- `store.ts` — evaluator result persistence in SQLite (not telemetry — just derived findings)
