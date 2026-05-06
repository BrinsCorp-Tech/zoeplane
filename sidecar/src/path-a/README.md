# Path A — Direct API SDK (`sidecar/src/path-a/`)

Path A is the **Direct Claude SDK** execution path. Instead of spawning the `claude`
CLI as a subprocess, Path A calls the Anthropic SDK (and in v1.x, OpenAI/Google SDKs)
directly from the sidecar process.

## When Path A is used

- User has configured an API key in Settings → Credentials (FR-013).
- User selects "Path A (Direct API)" per-task override in Task Console (FR-016).
- Path B CLI is not installed or fails to spawn.

Path A is the PARITY path — it must produce equivalent task outcomes to Path B.
Workspace default is Path B (per PRD §2 — wrapping existing CLIs is the primary value prop).

## Architecture

```
React UI → Tauri IPC → Rust shell → sidecar IPC → path-a/client.ts
                                                   ↓
                                         @anthropic-ai/sdk
                                         (direct API call)
```

## TODO (Epic 07, Sprint 5 — Path A Parity)

Implement:
- `client.ts` — Anthropic SDK client factory (reads API key from SQLite credentials store)
- `provider.ts` — Provider Abstraction Layer interface (PAL) for Path A calls
- `stream.ts` — Streaming response handler → IPC events back to Tauri

Per PRD §6.5: Path A v1 covers Anthropic SDK only. OpenAI + Google adapters are
contemplated as v1.x additive extensions under the same PAL interface.
