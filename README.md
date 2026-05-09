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
- Linux: see `.github/workflows/ci.yml` for `apt` dependencies

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

## Releasing signed builds

Pushing a `v*` tag (e.g. `v1.2.3`) triggers two independent workflows:

- **`release.yml`** — builds signed, notarized platform artifacts (macOS, Windows, Linux) and publishes a GitHub Release draft
- **`publish-sdk.yml`** — builds and publishes `@zoeplane/plugin-sdk` to npm

Both workflows fail loudly if required secrets are absent. No unsigned artifacts or un-gated publishes occur.

### Publishing the Plugin SDK

`publish-sdk.yml` fires on the same tag pattern. Before the first SDK publish, a repository operator must:

1. **Register the `@zoeplane` npm scope** — log in to npmjs.com as the BrinsCorp-Tech org account and create the `@zoeplane` organization scope
2. **Create an automation token** — on npmjs.com under Account Settings → Access Tokens, create a granular token with read+write publish permission scoped to the `@zoeplane` packages
3. **Configure the GHA secret** — add the token as `NPM_TOKEN` in the repository's GitHub Actions secrets (Settings → Secrets and variables → Actions)

The workflow will emit `::error::NPM_TOKEN secret not configured` and exit 1 if the secret is absent.

### Homebrew distribution

A static Homebrew formula is committed at `packaging/homebrew/zoeplane.rb`. Before each release, an operator must:

1. **Create the tap repo** (first time only) — create `brinscorp-tech/homebrew-zoeplane` on GitHub
2. **Compute the SHA256** of the macOS universal `.tar.gz` artifact from the GitHub Release:
   ```bash
   shasum -a 256 ZoePlane_<version>_universal.tar.gz
   ```
3. **Update the formula** — replace the `REPLACE_BEFORE_PUBLISH_WITH_RELEASE_ARTIFACT_SHA256` placeholder and the version/URL in `packaging/homebrew/zoeplane.rb`
4. **Copy to the tap repo** — place the updated formula at `Formula/zoeplane.rb` in the tap repo and commit

Users install via:
```bash
brew tap brinscorp-tech/zoeplane
brew install zoeplane
```

No cross-repo automation is wired — this is a manual operator action per release.

### Winget distribution

Winget manifest stubs are committed at `packaging/winget/BrinsCorpTech.ZoePlane/`. Submission to `microsoft/winget-pkgs` is **post-Sprint-1**. Before submitting, an operator must update the version, installer URL, and replace the `REPLACE_BEFORE_PUBLISH_WITH_RELEASE_ARTIFACT_SHA256` placeholder with the actual SHA256 of the Windows NSIS installer.

### Platform signing secrets

Before the first signed release, a repository operator must provision the following GitHub Actions secrets:

| Secret | Platform | Description |
|--------|----------|-------------|
| `APPLE_CERTIFICATE` | macOS | Base64-encoded `.p12` Developer ID certificate |
| `APPLE_CERTIFICATE_PASSWORD` | macOS | Password for the `.p12` |
| `APPLE_SIGNING_IDENTITY` | macOS | Developer ID string (e.g. `Developer ID Application: ...`) |
| `APPLE_ID` | macOS | Apple ID email used for notarization |
| `APPLE_PASSWORD` | macOS | App-specific password for the Apple ID |
| `APPLE_TEAM_ID` | macOS | Apple Developer Team ID |
| `WINDOWS_CERTIFICATE` | Windows | Base64-encoded `.pfx` Authenticode certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | Windows | Password for the `.pfx` |
| `LINUX_GPG_PRIVATE_KEY` | Linux | Armored GPG private key for package signing |
| `LINUX_GPG_PASSPHRASE` | Linux | Passphrase for the GPG key |

Certificate procurement notes: Apple Developer ID requires Apple Developer Program enrollment. Windows Authenticode EV certs (DigiCert, Sectigo) can take 1-2 weeks to issue — start early. Linux GPG key can be self-generated.

Cert material must never be committed to the repo (Apache 2.0 OSS constraint).

---

## Contributing

See `CLAUDE.md` for Claude Code conventions used by this project.

Issues and pull requests welcome at [github.com/BrinsCorp-Tech/zoeplane](https://github.com/BrinsCorp-Tech/zoeplane).

---

## License

Apache 2.0 — see `LICENSE`.

Copyright 2026 BrinsCorp-Tech.
