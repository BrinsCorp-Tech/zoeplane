# Path B — CLI Harness (`sidecar/src/path-b/`)

Path B is the **primary execution path**. It wraps the user's already-installed
`claude` and `codex` CLIs as managed subprocesses.

## Why Path B is primary

Users who live in Claude Pro/Max pay $20–$200/month for token-unlimited (or high-limit)
usage. Path B lets ZoePlane's task runner consume those subscriptions instead of
metered API tokens. This is the primary value proposition for Persona A.

## Architecture

```
React UI → Tauri IPC → Rust shell → sidecar IPC → path-b/harness.ts
                                                   ↓
                                         spawn(claude --print --json ...)
                                         spawn(codex --json ...)
                                         (parse structured output)
```

## CLI detection

On startup, the sidecar probes for installed CLIs:
1. `claude --version` — Anthropic Claude Code CLI
2. `codex --version` — OpenAI Codex CLI

Detection results are cached in SQLite and surfaced in Settings → Credentials (Epic 10).

## TODO (Epic 07, Sprint 5 — Path B Primary)

Implement:
- `harness.ts` — subprocess spawner and lifecycle manager
- `adapters/claude.ts` — Claude CLI adapter (parses `--json` output, maps to PAL events)
- `adapters/codex.ts` — Codex CLI adapter
- `stream.ts` — structured event → IPC event bridge (same interface as Path A stream.ts)
- `detect.ts` — CLI detection / version probing

Per PRD §6.5: future CLIs (Gemini CLI, etc.) onboard as additional adapters under
the same harness interface without requiring PAL changes.
