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

Declared under `plugins.fs.scope` in `tauri.conf.json`. These paths are enforced by `src-tauri/src/commands/fs.rs`. All filesystem IPC operations are denied for paths outside this allowlist; violations are logged at ERROR to the `fs-allowlist` tracing target.

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

### Plugin Permissions

Declared under `plugins.fs` in `tauri.conf.json`. Individual operations permitted by default:

| Operation    | Permitted |
| ------------ | --------- |
| `readFile`   | Yes       |
| `writeFile`  | Yes       |
| `readDir`    | Yes       |
| `copyFile`   | No        |
| `createDir`  | Yes       |
| `removeDir`  | No        |
| `removeFile` | No        |
| `renameFile` | Yes       |
| `exists`     | Yes       |

Note: these plugin-level permissions are a secondary gate. The primary gate is the FS allowlist enforced by `commands/fs.rs`. Even a permitted operation is denied if the target path is outside the allowlist.

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

| Target              | Emitter          | What it logs                                                               |
| ------------------- | ---------------- | -------------------------------------------------------------------------- |
| `sidecar-lifecycle` | `lib.rs`         | Sidecar spawn, port announcement, stderr forwarding, crash/shutdown events |
| `sidecar-ipc`       | `ipc.rs`         | Health-check requests and responses, timeout events                        |
| `fs-allowlist`      | `commands/fs.rs` | Every FS operation: request, permit, deny (violations at ERROR level)      |
| `fs-allowlist-json` | `commands/fs.rs` | Machine-parseable JSON duplicate of violation entries                      |
| `deep-link`         | `lib.rs`         | Received `zoeplane://` URL events                                          |

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

_Last reviewed: 2026-05-09 by tech-writer agent against Sprint 1._
