# Architecture — ZoePlane

## Overview

ZoePlane is a desktop application that wraps the `claude` and `codex` CLIs into a structured, file-native, keyboard-first cockpit for Claude-Code-native teams. It is a Tauri 2.0 application (Rust shell + WebView UI) combined with a Node.js sidecar process and a public Plugin SDK. The source of truth for all user data is `~/.claude/`; SQLite holds derived state only and is never the primary store.

The project is Apache 2.0 OSS steered by BrinsCorp-Tech. Proprietary capabilities (e.g., Zoe-Mem) ship as separately signed plugin bundles and are not part of this repository.

## Component Map

```
ZoePlane/
├── src/                    React UI (Vite-bundled, served in Tauri WebView)
│   └── main.tsx            Entry point
├── src-tauri/              Tauri Rust shell
│   ├── src/main.rs         Thin binary entry — calls lib.rs::run()
│   ├── src/lib.rs          App setup: tracing, sidecar lifecycle, plugin init
│   ├── src/ipc.rs          Tauri commands: ping, sidecar_status
│   ├── src/commands/
│   │   └── fs.rs           FS allowlist-violation logger (FB-016)
│   └── tauri.conf.json     Bundle identifier, window config, plugin config
├── sidecar/                Node.js sidecar (bun-compiled single-binary)
│   ├── src/index.ts        HTTP loopback server + DB init + signal handlers
│   ├── src/log.ts          Structured JSON stderr logger
│   └── src/db/
│       ├── runner.ts       SQLite migration runner
│       └── migrations/     Ordered .sql migration files
└── packages/
    ├── plugin-sdk/         @zoeplane/plugin-sdk (Apache 2.0, published to npm)
    ├── shared-types/       @zoeplane/shared-types (private monorepo package)
    └── design-tokens/      DTCG JSON → Style Dictionary v4 pipeline
```

## Component Responsibilities

**Tauri Rust shell (`src-tauri/`)** owns the OS layer. It spawns and supervises the sidecar process, registers the `zoeplane://` deep-link URL scheme with the host OS, enforces the filesystem allowlist on all file operations, manages the application window, and bridges the React UI to sidecar services via typed Tauri IPC commands. It never delegates OS-level operations to JavaScript. The Tauri shell is the sole process that speaks to the OS; the React UI and sidecar speak only to the Tauri shell.

**Node.js sidecar (`sidecar/`)** is a bun-compiled single-binary process that the Tauri shell spawns at startup. In Sprint 1 it hosts an HTTP loopback server on `127.0.0.1` at a kernel-assigned ephemeral port, runs the SQLite migration runner, and announces its port to the Tauri shell via a single-line JSON on stdout (`{"port": N}`). Future epics extend it to host Path A (Direct Claude SDK calls), Path B (CLI harness wrapping `claude` and `codex`), the Skill Safety Evaluator, and the FS watcher/asset indexer. The sidecar writes structured JSON to stderr; the Tauri shell forwards these lines to its own tracing output.

**React UI (`src/`)** is a Vite-bundled React 18 / TypeScript / Tailwind v4 application rendered in Tauri's WebView. The UI communicates exclusively with the Tauri shell via `invoke()` — it never makes direct HTTP calls to the sidecar or raw filesystem calls. In Sprint 1 the UI is a scaffold; production features ship in Epic 02 onward.

**Plugin SDK (`packages/plugin-sdk/`)** is the public extension contract for third-party ZoePlane plugins. It is published to npm as `@zoeplane/plugin-sdk`. The SDK defines the types for plugin manifests, declared capabilities, and extension points (navigation, views, run-stream observers, resource enrichers, settings panels). The runtime implementation ships in Epic 04; the Sprint 1 package is a typed stub establishing the public API surface.

**Shared types (`packages/shared-types/`)** is a private monorepo package (`@zoeplane/shared-types`) containing TypeScript types shared between the React UI and the sidecar — resource taxonomies, IPC message envelopes, run event shapes, and user preference types.

**Design tokens (`packages/design-tokens/`)** converts DTCG W3C v1 JSON token definitions into `src/styles/tokens.css` via Style Dictionary v4. All hex values in UI components are derived from this pipeline; hardcoded colors are forbidden.

## Data Flow

**Startup sequence:**

1. Tauri shell launches, initializes tracing, and calls `spawn_sidecar()` (`src-tauri/src/lib.rs:169`).
2. Tauri shell resolves `app_data_dir()` using the bundle identifier `com.brinscorp.zoeplane` and passes `--db-path <path>` and `--migrations-dir <path>` to the sidecar at spawn.
3. Sidecar opens SQLite at the provided path, runs the migration runner (`sidecar/src/db/runner.ts`), starts the HTTP loopback server on port 0, and writes `{"port": N}` to stdout.
4. Tauri shell captures the port announcement, stores it in `SidecarPort` app state (`lib.rs:302-311`), and emits the `sidecar-ready` event to the UI.
5. React UI listens for `sidecar-ready` and can begin issuing IPC requests.

**Typical health-check request:**

```
React UI
  → invoke("sidecar_status")
  → Tauri: ipc.rs::sidecar_status()
      reads SidecarPort from app state
      → GET http://127.0.0.1:{port}/health (100 ms timeout)
      ← { status: "ok", pid: N }
  ← SidecarStatus { running: true, pid: N }
```

**FS read request (FB-016 enforcement):**

```
React UI
  → invoke("fs_read_file", { path, caller })
  → Tauri: commands/fs.rs::fs_read_file()
      fs_scope().is_allowed(path)?
      if denied → log_violation (ERROR, "fs-allowlist" target) → return Err
      if allowed → std::fs::read(path) → return Ok(bytes)
```

## Persistence and State

See `docs/DATA-MODEL.md` for the SQLite schema and migration philosophy.

The source-of-truth split is:

- **`~/.claude/`** — authoritative for all skill, agent, team, workflow, hook, and session data. ZoePlane reads this directory; it does not own it.
- **SQLite** (path: `<appDataDir>/zoeplane.db`) — derived indexes, preferences, and evaluator results. Can be deleted and rebuilt from `~/.claude/` content.

## External Integrations

- **Claude Code CLI (`claude`)** — invoked by the sidecar (Path B, Epic 04+). ZoePlane reads CLI output, does not modify the CLI.
- **`codex` CLI** — additional CLI harness target (Path B, Epic 04+).
- **npm registry** — `@zoeplane/plugin-sdk` is published here on release.
- **Homebrew** — distribution via `brinscorp-tech/homebrew-zoeplane` tap (tap repo not yet created; operator prerequisite for first release).
- **winget** — distribution via submission to `microsoft/winget-pkgs` (post-Sprint-1).
- **Apple Notarization** — macOS builds are submitted to Apple's notarization service via `xcrun notarytool` (automated by `release.yml`, requires provisioned GHA secrets).

## Tauri 2.x Capability Model

ZoePlane adopts Tauri 2.x's capability-based ACL system in full, per **ADR-002**. This is the permanent pattern for every plugin permission, sidecar execution grant, and future plugin-host SDK boundary in this codebase.

### How it works

In Tauri 2.x, plugin method permissions are no longer declared inline in `tauri.conf.json`. Instead:

- **`src-tauri/capabilities/default.json`** — the single capability file for Sprint 1. It enumerates every permission granted to the `main` window across all three platforms (`macOS`, `linux`, `windows`).
- **`tauri.conf.json` `plugins.*` blocks** — retain only plugin-instance _configuration_ (filesystem allowlist scope, deep-link URL schemes, `shell.open` boolean). Method-level permissions have been removed.
- **`src-tauri/gen/schemas/desktop-schema.json`** — the auto-generated catalog of all valid permission identifiers, produced by `tauri-build` from the installed plugin crates. This is the source of truth when adding new identifiers.

### Sprint 1 capability surface (`capabilities/default.json`)

| Identifier             | Purpose                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `core:default`         | Tauri baseline (path resolution, app metadata, resource loading, window lifecycle) |
| `fs:default`           | FS plugin baseline (JS-side `BaseDirectory` enum and metadata helpers)             |
| `fs:allow-read-file`   | `fs_read_file` IPC command                                                         |
| `fs:allow-write-file`  | `fs_write_file` IPC command                                                        |
| `fs:allow-read-dir`    | `fs_read_dir` IPC command                                                          |
| `fs:allow-exists`      | `fs_exists` IPC command                                                            |
| `fs:allow-mkdir`       | AppData directory bootstrap in `lib.rs::spawn_sidecar`                             |
| `shell:allow-execute`  | Sidecar spawn only (scoped to `zoeplane-sidecar` with arg validators)              |
| `dialog:default`       | Native dialog plugin baseline                                                      |
| `notification:default` | Native notification plugin baseline                                                |
| `process:default`      | App exit/restart IPC (clean-shutdown wiring in `lib.rs`)                           |
| `deep-link:default`    | Deep-link URL scheme handler (`zoeplane://`)                                       |

### Identifier discipline

Enumerated `allow-*` permissions are used instead of blanket `<plugin>:default` identifiers wherever the plugin's default surface is broader than what is needed. `<plugin>:default` is a moving target across plugin minor versions — a plugin upgrade could silently expand the granted surface. Enumerated identifiers are stable.

The one deliberate exception is `core:default`: it covers ~80 baseline identifiers whose stability across Tauri minor versions is contractually maintained by the Tauri project. Enumerating them individually would bury the meaningful permission grants under boilerplate.

### Adding a new plugin or capability

Future plugin additions follow the pattern established by ADR-002:

1. Add the plugin crate to `src-tauri/Cargo.toml` and register it via `.plugin(tauri_plugin_<name>::init())` in `lib.rs`.
2. Add the required `<plugin>:allow-<method>` identifiers to `capabilities/default.json` (or a new per-feature capability file if window-scoped restriction is needed).
3. If the plugin requires instance configuration (allowlist scopes, URL schemes), add a `plugins.<name>` block to `tauri.conf.json` containing **only** configuration — never method permissions.
4. If the plugin uses sidecar or external-binary execution, add a `shell:allow-execute` entry to `capabilities/default.json` — never to `tauri.conf.json`.

## Architectural Decisions

See `docs/architecture/decisions/README.md` for the full ADR index.

- **ADR-001** — Retains `com.brinscorp.zoeplane` as the permanent bundle identifier. Rationale: honest correspondence with the BrinsCorp-Tech signing trust root; changing after first release would require Apple notarization re-binding, Homebrew tap updates, winget renamespace, data migration, and deep-link re-registration.
- **ADR-002** — Adopts Tauri 2.x's capability model in full, with four invariants: single capability file at `src-tauri/capabilities/default.json` for Sprint 1; enumerate every permission (no blanket `<plugin>:default` where the surface exceeds need); sidecar grants live in `capabilities/default.json`, never in `tauri.conf.json`; hard separation between plugin configuration (`tauri.conf.json`) and plugin permissions (capability files). See section above and ADR-002 for full rationale.

## Glossary

**Sidecar** — The bun-compiled Node.js binary that the Tauri shell spawns at startup. Named "sidecar" per Tauri's external binary embedding terminology (`externalBin` in `tauri.conf.json`). Responsible for all Claude API/CLI work and the FS indexer.

**FS allowlist** — The set of filesystem paths the Tauri app is permitted to access, declared in `tauri.conf.json` under `plugins.fs.scope.allow`. In Sprint 1: `$HOME/.claude/**`, `$APPDATA/com.brinscorp.zoeplane/**`, and `$APP/**`. The method-level permissions (`fs:allow-read-file`, `fs:allow-write-file`, etc.) are granted separately in `src-tauri/capabilities/default.json` per the Tauri 2.x capability model. All filesystem operations route through `commands/fs.rs` wrappers that enforce this allowlist and log violations.

**IPC** — Inter-process communication. ZoePlane uses two IPC layers: (1) Tauri commands (`invoke()`) between React UI and Rust shell, and (2) HTTP loopback on `127.0.0.1` between the Rust shell and the sidecar.

**Path A / Path B** — Two modes for invoking Claude. Path A: direct Anthropic SDK calls from the sidecar. Path B: shell harness wrapping the `claude` CLI. Both are sidecar-side; neither is implemented in Sprint 1.

**Plugin host** — The ZoePlane runtime that loads, sandboxes, and manages third-party `.zoeplugin` bundles. Plugin host runtime is Epic 04; `@zoeplane/plugin-sdk` 0.0.1 defines the typed contract.

**Bundle identifier** — The reverse-DNS string `com.brinscorp.zoeplane` used by Tauri to identify the app to the OS. Determines the app data directory path, the deep-link registration key, the macOS bundle ID, and the Windows AppUserModelID. See ADR-001.

---

_Last reviewed: 2026-05-10 by project-manager agent — Story 1.11 (Tauri 2.x capability model adoption, ADR-002)._
