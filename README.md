# ZoePlane

**The OSS cockpit and plugin host for Claude-Code-native teams.**

ZoePlane wraps your existing `claude` and `codex` CLIs into a structured,
file-native, keyboard-first desktop GUI — and ships a public Plugin SDK so
third-party capabilities can extend the cockpit without forking it.

Apache 2.0. Built by [BrinsCorp-Tech](https://github.com/BrinsCorp-Tech).

---

## What it does

- **Browse and deploy skills** — every skill in `~/.claude/skills/` is a first-class browsable, editable, deployable object
- **Compose agent teams** — visual team composer for one-off tasks and reusable templates
- **Stream live multi-agent runs** — per-agent panes, structured event timelines, inline approval checkpoints
- **Author new skills** — Skill Builder with assistant-driven scaffolding (your own configured assistant)
- **Audit and govern hooks** — Hooks Library surfaces every Claude Code lifecycle hook; Skill Safety Evaluator gates imports
- **Extend via plugins** — Plugin SDK with documented extension points; Zoe-Mem is the reference plugin

**Standalone mode works completely.** Zero "install plugin to unlock" placeholders for core features.

---

## Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Tauri 2.0 (Rust) |
| UI | React 18 + TypeScript + Tailwind v4 + Vite |
| Sidecar | Node.js (bun-compatible, single-binary build target) |
| Storage | SQLite (derived state only — source of truth is `~/.claude/`) |
| Design tokens | DTCG W3C v1 → Style Dictionary v4 |
| Plugin SDK | `@zoeplane/plugin-sdk` (Apache 2.0, published to npm) |

---

## Development setup

### Prerequisites

- **Bun** ≥ 1.1.0 (`brew install bun` or https://bun.sh)
- **Rust** stable toolchain (`rustup install stable`)
- **Tauri CLI** (`cargo install tauri-cli --version "^2"`)
- **Node.js** ≥ 20 (fallback if bun is unavailable for some tooling)
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Linux: see `.github/workflows/build.yml` for `apt` dependencies

### First-time setup

```bash
# 1. Install JS/TS dependencies
bun install

# 2. Build design tokens (generates src/styles/tokens.css from DTCG JSON)
bun run tokens:build

# 3. Start development (Tauri dev mode — launches app window with HMR)
bun run tauri
```

### Useful commands

```bash
bun run dev           # Start Vite dev server only (no Tauri window)
bun run build         # Build UI + sidecar
bun run tauri         # Start full Tauri dev session
bun run tauri:build   # Build production Tauri bundle
bun run lint          # ESLint across all packages
bun run typecheck     # tsc --noEmit across all packages
bun run test          # Vitest unit tests
bun run tokens:build  # Rebuild tokens.css from DTCG JSON
bun run tokens:check  # Verify light + dark token completeness
```

### pnpm fallback

If bun is not available:
```bash
npm install -g pnpm
pnpm install
# Replace `bun run` with `pnpm run` in commands above
```

---

## Architecture overview

```
ZoePlane/
├── src/                   ← React UI (Vite-bundled, served by Tauri WebView)
├── src-tauri/             ← Tauri Rust shell (single window, IPC bridge)
├── sidecar/               ← Node.js sidecar (Path A + Path B + evaluator + indexer)
├── packages/
│   ├── plugin-sdk/        ← Public Plugin SDK (Apache 2.0, published to npm)
│   ├── shared-types/      ← Shared TS types (UI ↔ sidecar)
│   └── design-tokens/     ← DTCG JSON → Style Dictionary pipeline
└── .github/workflows/     ← CI, build matrix, release stub
```

**Key rules:**
- No AWS, no Lambda, no Postgres — SQLite derived state only
- No mobile (no Expo) — desktop-only v1
- No telemetry capture — ZoePlane never persists Claude session data
- Plugins cannot install hooks or write `settings.json` — hooks are user-authored only
- Apache 2.0 OSS — zero proprietary code in this repo

---

## Contributing

See `CLAUDE.md` for Claude Code conventions used by this project.

Issues and pull requests welcome at [github.com/BrinsCorp-Tech/zoeplane](https://github.com/BrinsCorp-Tech/zoeplane).

---

## License

Apache 2.0 — see `LICENSE`.

Copyright 2026 BrinsCorp-Tech.
