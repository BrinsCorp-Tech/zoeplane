# Changelog

All notable changes to ZoePlane are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/)

---

## [Unreleased]

### Sprint 1 (2026-05-07 → 2026-05-09)

Sprint 1 established the foundational monorepo scaffold, the Tauri shell and sidecar lifecycle, SQLite migration infrastructure, CI/release pipeline, code-signing pipeline, the Plugin SDK public contract, and the policy bundle (pre-commit hooks, FS allowlist enforcement, deep-link registration). No signed release has been tagged yet; the first tag will be `v0.1.0` once 10 GHA secrets are provisioned.

#### Added

- **Monorepo scaffold** (PR #1 — Story 1.1): Bun workspaces with packages `src` (React/Vite/Tailwind v4 UI), `sidecar` (Node.js bun-compiled single-binary), `packages/plugin-sdk` (`@zoeplane/plugin-sdk`), `packages/shared-types` (`@zoeplane/shared-types`), `packages/design-tokens` (DTCG → Style Dictionary v4 pipeline). `package.json` workspace root at version `0.1.0`, `src-tauri/Cargo.toml` at version `0.1.0`.
- **Tauri Rust shell core** (PR #1 — Story 1.1): `src-tauri/src/lib.rs` with structured tracing (via `tracing` + `tracing-subscriber`), app window configuration (1280×800, min 1024×720), plugin registration (`tauri-plugin-shell`, `tauri-plugin-fs`, `tauri-plugin-dialog`, `tauri-plugin-notification`, `tauri-plugin-process`, `tauri-plugin-deep-link`).
- **Sidecar lifecycle** (PR #3 — Story 1.2): `spawn_sidecar()` in `lib.rs` resolves `appDataDir()` using the bundle identifier, passes `--db-path` and `--migrations-dir` to the sidecar at spawn, supervises the process via `CommandEvent` channel, and emits `sidecar-ready` to the UI on port announcement. Clean shutdown on `WindowEvent::CloseRequested` and `RunEvent::Exit`.
- **HTTP loopback IPC** (PR #3 — Story 1.2): Sidecar binds `Bun.serve` to `127.0.0.1:0` (kernel-assigned ephemeral port), announces bound port via stdout as `{"port": N}`. Tauri shell captures port and stores in `SidecarPort` app state. `sidecar_status` Tauri command issues `GET /health` with a 100 ms timeout (`ipc.rs`).
- **Sidecar structured logging** (PR #9 — Story 1.9 amendment): `sidecar/src/log.ts` — `log(level, message, extra?)` writes `JSON.stringify({ level, message, pid, ...extra })` to stderr. Every sidecar log line includes `pid` for restart correlation.
- **SQLite migration runner** (PR #4 — Story 1.3): `sidecar/src/db/runner.ts` — forward-only migration runner using `bun:sqlite`. Bootstraps `__migrations` tracking table, discovers `NNN_description.sql` files, applies pending migrations in ascending numeric order inside individual transactions. Fatal on migration failure (exit code 1). Supports `--migrations-dir` production path and dev fallback.
- **Migration 001** (PR #4 — Story 1.3): `sidecar/src/db/migrations/001_init.sql` creates `__migrations` table (idempotent). First and only domain-layer migration in Sprint 1.
- **CI matrix pipeline** (PR #5 — Story 1.4): `.github/workflows/ci.yml` — lint + typecheck + test + scaffold-health + actionlint + build (unsigned) across `macos-latest`, `windows-latest`, `ubuntu-22.04`. `fail-fast: false`. Results table written to GHA step summary. ESLint 9 flat config (`eslint.config.js`).
- **Nightly pipeline** (PR #5 — Story 1.4): `.github/workflows/nightly.yml` — same matrix as CI, runs daily at 07:00 UTC against `main`, plus manual dispatch.
- **Code-signing release pipeline** (PR #6 — Story 1.5): `.github/workflows/release.yml` — triggered by `v*.*.*` semver tags. Three parallel platform jobs: macOS (universal-apple-darwin, Apple Developer ID codesign + notarization via `xcrun notarytool`), Windows (Authenticode via `.pfx` + `signtool.exe`), Linux (GPG via AppImageTool with `APPIMAGETOOL_FORCE_SIGN=1`). All jobs validate required secrets before spending build time and fail loudly on absent secrets. GitHub Release draft published by `tauri-apps/tauri-action@v0`.
- **Plugin SDK** (PR #7 — Story 1.6): `packages/plugin-sdk/src/index.ts` — `@zoeplane/plugin-sdk@0.0.1`. Exports `PluginManifest`, `PluginCapabilities`, `PluginExtensionPoints` (navigation, view, run-stream observer, resource enricher, settings panel), `ZoePlaneHostBridge`, and `HostEventType`. All APIs marked `@experimental`; runtime implementation is Epic 04.
- **Plugin SDK publish pipeline** (PR #7 — Story 1.6): `.github/workflows/publish-sdk.yml` — fires on same `v*.*.*` tag as `release.yml`. Builds via `tsup`, verifies `NPM_TOKEN` secret, publishes `@zoeplane/plugin-sdk` to npm as public. Fails loudly if `NPM_TOKEN` is absent.
- **Homebrew Cask stub** (PR #7 — Story 1.6): `packaging/homebrew/zoeplane.rb` — static stub for `brinscorp-tech/homebrew-zoeplane` tap. Version and SHA256 placeholders require per-release operator update. Depends on macOS ≥ 13 (Ventura). Declares `zap trash` paths targeting `com.brinscorp.zoeplane`.
- **Winget manifest stubs** (PR #7 — Story 1.6): `packaging/winget/BrinsCorpTech.ZoePlane/` — three winget manifests (version, locale, installer) at schema 1.9.0. Submission to `microsoft/winget-pkgs` is post-Sprint-1.
- **Pre-commit policy** (PR #8 — Story 1.7): Husky 9.1.7 pre-commit hook via `prepare` script. lint-staged runs ESLint `--fix` + Prettier `--write` on staged TypeScript files, and Prettier on JSON/Markdown/CSS/HTML. Hook config in root `package.json:lint-staged`.
- **Deep-link registration** (PR #8 — Story 1.7): `zoeplane://` URL scheme registered via `tauri-plugin-deep-link` in `tauri.conf.json`. `lib.rs:108-133` handler validates scheme and structure, logs at WARN for unexpected/malformed URLs, does not crash. Action dispatch is Epic 10.
- **FS allowlist enforcement** (PR #8 + PR #9 — Stories 1.7 + 1.8): `src-tauri/src/commands/fs.rs` — four Tauri IPC commands (`fs_read_file`, `fs_write_file`, `fs_read_dir`, `fs_exists`) each performing an upfront `app.fs_scope().is_allowed()` check. Scope denials trigger `log_violation()` which emits a structured ERROR on the `fs-allowlist` tracing target and a JSON line on `fs-allowlist-json`. ESLint rule prohibits direct `@tauri-apps/plugin-fs` usage in the React UI.
- **ADR-001** (2026-05-09): Retains `com.brinscorp.zoeplane` as the permanent bundle identifier. See `docs/architecture/decisions/ADR-001-bundle-identifier.md`.
- **Public OSS policy documents** (PR #8 — Story 1.7): `LICENSE` (Apache 2.0), `NOTICE` (third-party attributions), `CONTRIBUTING.md` (contributor guide including FB-016 enforcement details and branch naming conventions).
- **Founding documentation** (Sprint 1 close): `docs/ARCHITECTURE.md`, `docs/INSTALL.md`, `docs/SECURITY.md`, `docs/CONFIGURATION.md`, `docs/BUILD-AND-RELEASE.md`, `docs/IPC-API.md`, `docs/PLUGIN-SDK.md`, `docs/DATA-MODEL.md`.

#### Fixed

- **CI YAML** (PR #2 — hotfix): Corrected GitHub Actions workflow YAML syntax error introduced in the initial monorepo commit. CI matrix was non-functional until this fix.
- **`tauri-plugin-fs` API usage** (PR #8 build-matrix fix commit `87b73af`): Corrected `tauri-plugin-fs` API calls in `src-tauri/src/commands/fs.rs` to use `FsExt` trait methods correctly for Tauri 2.0 compatibility. PR #8 had failed on Windows and Linux matrix legs due to this API mismatch.
- **IPC hygiene** (PR #9 — Story 1.8 amendment): Resolved a dual-emission issue in `log_violation` where the structured tracing event and the JSON stderr line could produce inconsistent field sets under certain log configurations. (MED-1 from code-audit pass 2; a residual dual-emission cleanup is tracked for Sprint 2.)
- **Sidecar scope consolidation** (PR #9 — Story 1.10 amendment): Consolidated FS scope-deny logic across the four `commands/fs.rs` wrappers into a consistent pattern — all four now perform the `is_allowed` check at the same structural position before any I/O.
- **Tauri 2.x permission migration** (Story 1.11 amendment — 2026-05-10): Migrated `tauri.conf.json` from Tauri 1.x plugin-permission schema to the Tauri 2.x capability model (ADR-002). Removed `"all"` field and all method-permission boolean keys from `plugins.shell` and `plugins.fs` (the 1.x schema caused a runtime panic on plugin deserialization — the app had never successfully booted from source). Created `src-tauri/capabilities/default.json` granting 12 enumerated capability identifiers scoped to the `main` window. Set `plugins.shell.open: false` (Tauri 2.x rejects `true`; URL-open is not a Sprint 1 use case).
- **AppData directory bootstrap** (Story 1.11 amendment — 2026-05-10): Added `std::fs::create_dir_all(&app_data_dir)` to `lib.rs::spawn_sidecar` before the `db_path` join. On a fresh user account or post-clean-state run, the AppData directory now exists before the sidecar is spawned, preventing SQLite from failing to open a file in a non-existent directory. Structured logging added on success (`tracing::info!` with `dir_created: true`) and on failure (`tracing::error!` with the underlying I/O error). Rust unit test covers the bootstrap path.
- **Vite mobile-scaffold cleanup** (Story 1.11 amendment — 2026-05-10): Removed `internal-ip` import and LAN-IP binding from `src/vite.config.ts` (copied from a Tauri mobile scaffold template). Vite now binds exclusively to `localhost:5173`. Removed `internal-ip` from `package.json` devDependencies.
- **Developer-prerequisites documentation** (Story 1.11 amendment — 2026-05-10): Added `cargo install tauri-cli --version "^2" --locked` to `docs/INSTALL.md` build-from-source section and `CONTRIBUTING.md`. Added "Clean-state smoke testing" subsection to `CONTRIBUTING.md` documenting `scripts/clean-state.sh` and the clean-state verification workflow. Added `scripts/clean-state.sh` (macOS, mode 0755, idempotent) that wipes the four `com.brinscorp.zoeplane` platform-state locations for reliable clean-state boot verification.

---

_Last reviewed: 2026-05-10 by project-manager agent — Story 1.11 entries added._
