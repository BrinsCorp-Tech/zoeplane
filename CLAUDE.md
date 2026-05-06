# ZoePlane — Claude Code Instructions

This is the OSS Claude-Code-native team cockpit. Stack: **Tauri 2.0** (Rust shell) + **React/TypeScript/Vite/Tailwind** UI + **Node.js sidecar** (bun-compatible single-binary build target).

## Stack rules (do not violate)

- **No Next.js, no AWS, no Lambda, no Cognito** — desktop-only Tauri app
- **No mobile / Expo** — desktop-only v1
- **No Claude session telemetry persistence** — SQLite holds derived state only; the source of truth is `~/.claude/`
- **Apache 2.0 OSS** — no proprietary code in this repo. Proprietary capabilities (e.g., Zoe-Mem) ship as signed plugin bundles from separate repos
- **Plugins cannot install hooks or write `settings.json`** — hooks are user-authored only

## Workspace layout

| Path | Owner |
|------|-------|
| `src/` | React UI (Vite-bundled) |
| `src-tauri/` | Tauri Rust shell + IPC bridge |
| `sidecar/` | Node.js sidecar (Path A SDK + Path B CLI harness + evaluator + indexer) |
| `packages/plugin-sdk/` | Public Plugin SDK (published to npm) |
| `packages/shared-types/` | Types shared between UI and sidecar |
| `packages/design-tokens/` | DTCG JSON → Style Dictionary v4 pipeline |

## Conventions

- **Bun** is the preferred runtime (`brew install bun`); pnpm fallback documented in `README.md`
- **Design tokens** are sourced from `packages/design-tokens` and built into `src/styles/tokens.css` via Style Dictionary v4 — never hardcode hex values in components
- **Dark mode** toggles via `[data-theme="dark"]` on `<html>` — do not use `prefers-color-scheme` directly in components
- **Animation** must include a `prefers-reduced-motion` variant for every motion pattern
- **Feature-branch workflow**; PRs into `main` require CI green (lint + typecheck + tests)

## Project memory

If you are using Claude Code in this repo, project-scoped memory auto-loads from `~/.claude/projects/<project-path>/memory/`. The session-startup hook also loads `hot.md` and `warm/rules.md` if they exist.
