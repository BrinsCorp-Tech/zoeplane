# Configuration — ZoePlane

## Configuration Sources

ZoePlane has no end-user-facing configuration file. All configuration is either compile-time (embedded in `src-tauri/tauri.conf.json`) or runtime (CLI arguments passed to the sidecar by the Tauri shell at spawn). There is no `~/.zoeplane.toml` or equivalent.

Precedence order (highest to lowest):

1. **Tauri shell CLI args to sidecar** — passed at spawn time by `lib.rs::spawn_sidecar()`, derived from Tauri's own path resolution. These cannot be overridden by the user.
2. **`tauri.conf.json`** — compile-time configuration embedded in the application bundle. Operators building from source may modify this; end users of a release binary cannot.
3. **`RUST_LOG` environment variable** — controls Tauri shell log verbosity at runtime (see Logging section below).

## Tauri Configuration (`src-tauri/tauri.conf.json`)

These values are baked into each release binary. They can only be changed by rebuilding the application.

### Application Identity

| Key           | Value                    | Description                                                                                               |
| ------------- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `productName` | `ZoePlane`               | Display name                                                                                              |
| `version`     | `0.1.0`                  | Application version (semver)                                                                              |
| `identifier`  | `com.brinscorp.zoeplane` | Bundle identifier. Determines `appDataDir()` path on all platforms. Immutable post-release — see ADR-001. |

### Window

| Key                        | Default | Description                     |
| -------------------------- | ------- | ------------------------------- |
| `app.windows[0].width`     | `1280`  | Initial window width (px)       |
| `app.windows[0].height`    | `800`   | Initial window height (px)      |
| `app.windows[0].minWidth`  | `1024`  | Minimum window width (px)       |
| `app.windows[0].minHeight` | `720`   | Minimum window height (px)      |
| `app.windows[0].resizable` | `true`  | User can resize the window      |
| `app.windows[0].center`    | `true`  | Window opens centered on screen |

### Filesystem Allowlist

ZoePlane enforces a three-path allowlist on all filesystem IPC operations, implemented across two enforcement layers per **ADR-003**:

1. **Capability scope** — `src-tauri/capabilities/default.json` contains an `fs:scope` permission entry declaring the canonical allowlist. This gates the plugin's built-in IPC commands via Tauri's ACL machinery.
2. **Runtime scope** — `lib.rs::run().setup()` calls `app.fs_scope().allow_directory(...)` for each canonical path, populating the `tauri::fs::Scope` runtime object. Custom Rust IPC wrappers in `src-tauri/src/commands/fs.rs` check this runtime scope via `is_allowed(...)`.

Both layers reference the same three semantic paths:

| Path pattern                         | Purpose                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `$HOME/.claude/**`                   | Read access to the Claude Code data directory (skills, agents, teams, workflows, hooks) |
| `$APPDATA/com.brinscorp.zoeplane/**` | Read/write access to ZoePlane's own app data (SQLite DB, preferences)                   |
| `$APP/**`                            | Read access to the application bundle resources (bundled migrations, icons)             |

`$HOME`, `$APPDATA`, and `$APP` are Tauri path macros that expand to platform-appropriate values at runtime:

| Macro      | macOS                                    | Windows                      | Linux               |
| ---------- | ---------------------------------------- | ---------------------------- | ------------------- |
| `$HOME`    | `/Users/<user>`                          | `C:\Users\<user>`            | `/home/<user>`      |
| `$APPDATA` | `~/Library/Application Support`          | `%APPDATA%`                  | `~/.local/share`    |
| `$APP`     | Inside `ZoePlane.app/Contents/Resources` | Inside the install directory | Inside the AppImage |

The full expanded `appDataDir` for ZoePlane is:

| Platform | Path                                                    |
| -------- | ------------------------------------------------------- |
| macOS    | `~/Library/Application Support/com.brinscorp.zoeplane/` |
| Windows  | `%APPDATA%\com.brinscorp.zoeplane\`                     |
| Linux    | `~/.local/share/com.brinscorp.zoeplane/`                |

All filesystem IPC operations are denied for paths outside this allowlist; violations are logged at ERROR to the `fs-allowlist` tracing target.

### Plugin Permissions (Tauri 2.x Capability Model)

Plugin method permissions are **not** declared in `tauri.conf.json` in Tauri 2.x. The prior Tauri 1.x boolean-toggle schema (`plugins.fs.readFile: true`, `writeFile: true`, etc.) has been removed. Per ADR-002, method-level grants live in `src-tauri/capabilities/default.json`.

The `plugins.fs` block has been removed from `tauri.conf.json` entirely. `tauri-plugin-fs` v2.5.1 accepts only `requireLiteralLeadingDot` as runtime configuration, and ZoePlane uses the platform default without overriding it. If a future story requires overriding `requireLiteralLeadingDot`, that story re-adds only the `plugins.fs.requireLiteralLeadingDot` key — never a `scope` array, which is a Tauri 1.x construct rejected at runtime by the 2.x schema. FS path scope is governed by `capabilities/default.json` (ACL layer) and programmatic runtime scope initialization in `lib.rs` (runtime layer) per ADR-003.

The `plugins.shell` block contains only `"open": false` (URL-open access is not granted in Sprint 1). The `plugins.deep-link` block contains only `desktop.schemes: ["zoeplane"]` (documented below). No other `plugins.*` runtime configuration blocks are present in Sprint 1.

`app.withGlobalTauri: true` is set as a dev-ergonomics setting enabling `window.__TAURI__` in the DevTools console for smoke testing. This is a Sprint 1 development convenience and is scheduled for revert to `false` before v0.1.0-alpha or when the first untrusted-content surface lands (whichever comes first) — see `docs/stories/epic-01/SPRINT-2-CARRYOVERS.md`.

See `docs/ARCHITECTURE.md` — "Tauri 2.x Capability Model" and "Three-way Tauri 2.x scope model" for the full permission surface table and the pattern for adding future plugin permissions.

### Deep-Link

```json
"plugins": {
  "deep-link": {
    "desktop": {
      "schemes": ["zoeplane"]
    }
  }
}
```

Registers the `zoeplane://` URL scheme with the host OS. The handler in `lib.rs:108-133` logs incoming URLs in Sprint 1; action dispatch is Epic 10.

### External Binary (Sidecar)

```json
"bundle": {
  "externalBin": ["binaries/zoeplane-sidecar"]
}
```

The sidecar binary is embedded in the release bundle by Tauri. It is resolved from `src-tauri/binaries/zoeplane-sidecar-<target-triple>` during the build (platform-stamped by `scripts/copy-sidecar.ts` postbuild).

## Sidecar Runtime Arguments

The Tauri shell constructs and passes these arguments to the sidecar binary at spawn (`src-tauri/src/lib.rs:205-215`). They are not user-configurable; they are resolved by Tauri's path API to ensure platform-consistent paths.

| Argument                  | Required          | Description                                                                                                                                                                                                                                                          |
| ------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--db-path <path>`        | Yes               | Absolute path to the SQLite database file (`<appDataDir>/zoeplane.db`). The sidecar fails with exit code 1 if absent.                                                                                                                                                |
| `--migrations-dir <path>` | No (dev fallback) | Absolute path to the bundled migrations directory. In production builds, the Tauri shell passes the resource-bundled path (`<resourceDir>/migrations`). In dev mode, the sidecar falls back to `sidecar/src/db/migrations/` relative to the binary and emits a WARN. |

Source: `sidecar/src/index.ts:40-89`.

## Logging

### Tauri Shell (Rust)

Logging uses the `tracing` crate with a `FmtSubscriber` writing structured output to stderr.

| Environment variable | Description                                                                              | Default                                                    |
| -------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `RUST_LOG`           | Log level filter. Examples: `debug`, `info`, `zoeplane=debug`, `sidecar-lifecycle=trace` | `info` (implicit — set by `EnvFilter::from_default_env()`) |

Named log targets used by ZoePlane:

| Target              | Emitter          | What it logs                                                                              |
| ------------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| `sidecar-lifecycle` | `lib.rs`         | Sidecar spawn, port announcement, stderr forwarding, crash/shutdown events                |
| `sidecar-ipc`       | `ipc.rs`         | Health-check requests and responses, timeout events                                       |
| `fs-scope-init`     | `lib.rs`         | Runtime FS scope initialization: each registered allowlist path (INFO) or failure (ERROR) |
| `fs-allowlist`      | `commands/fs.rs` | Every FS operation: request, permit, deny (violations at ERROR level)                     |
| `fs-allowlist-json` | `commands/fs.rs` | Machine-parseable JSON duplicate of violation entries                                     |
| `deep-link`         | `lib.rs`         | Received `zoeplane://` URL events                                                         |

### Sidecar (Node.js)

The sidecar writes structured JSON lines to stderr via `sidecar/src/log.ts`. Each line is:

```json
{
  "level": "INFO",
  "message": "ZoePlane sidecar HTTP server ready",
  "pid": 12345,
  "hostname": "127.0.0.1",
  "port": 54321
}
```

Fields: `level` (`INFO` | `WARN` | `ERROR`), `message`, `pid`, plus any `extra` fields passed by the caller. The Tauri shell forwards these stderr lines to the `sidecar-lifecycle` tracing target.

---

_Last reviewed: 2026-05-10 by project-manager agent — Story 1.12 (Filesystem Allowlist section updated for ADR-003 three-way scope model; plugins.fs block removal documented; withGlobalTauri policy noted; fs-scope-init log target added)._
