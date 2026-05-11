# Security — ZoePlane

## Security Model

ZoePlane is a local desktop application. It does not operate a network service, does not send telemetry, and does not persist Claude session content. The trust boundary is the local machine: all processes run under the current user's credentials, and no remote party can issue commands to ZoePlane.

**In scope:**

- Preventing plugin code from escaping its sandbox (filesystem, IPC, hook-authoring boundaries)
- Preventing React UI from bypassing the Tauri FS allowlist
- Ensuring sidecar-to-Tauri communication is limited to the loopback interface
- Logging FS allowlist violations so operators can detect accidental or intentional scope creep

**Out of scope:**

- Protecting against a malicious actor with local OS access (ZoePlane has no privilege separation beyond what Tauri provides)
- Protecting against a compromised `~/.claude/` directory (ZoePlane reads this directory as-is; it does not validate skill or hook content before display — that is the Skill Safety Evaluator's job, which ships in Epic 05)
- Network-level security (no network surface beyond loopback)

## Surface Area

| Surface                  | Description                                                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tauri IPC                | `invoke()` commands from the React UI to the Rust shell. The IPC channel is local-process-only — not accessible from outside the app window.                                                                                      |
| HTTP loopback            | `GET http://127.0.0.1:{port}/health` issued by the Tauri shell to the sidecar. Bound to `127.0.0.1` (not `0.0.0.0`); not reachable from other machines or other local users on the same host under standard OS network isolation. |
| Filesystem               | `$HOME/.claude/**`, `$APPDATA/com.brinscorp.zoeplane/**`, and `$APP/**` — see FS Allowlist below.                                                                                                                                 |
| `zoeplane://` URL scheme | Registered with the host OS via `tauri-plugin-deep-link`. In Sprint 1 the handler logs the URL and takes no action. Deep-link dispatch is Epic 10.                                                                                |
| Plugin iframes           | Not active in Sprint 1. When implemented (Epic 04), plugins run in sandboxed iframes with capability gating.                                                                                                                      |

## Default Protections

### FS Allowlist (FB-016)

All filesystem operations from the React UI and sidecar route through four Tauri IPC command wrappers (`src-tauri/src/commands/fs.rs:91-295`):

- `fs_read_file` — reads a file
- `fs_write_file` — writes a file
- `fs_read_dir` — lists a directory
- `fs_exists` — checks path existence

Each wrapper performs an upfront `app.fs_scope().is_allowed(path)` check before touching the filesystem. On a scope denial it calls `log_violation()` (`commands/fs.rs:54-78`), which emits a structured ERROR event on the `fs-allowlist` tracing target and a JSON-serialized line on stderr. The operation is then denied without touching the filesystem.

**Path scope** — Tauri 2.x uses a three-way scope model (ADR-003). The canonical allowlist is:

```
$HOME/.claude/**
$APPDATA/com.brinscorp.zoeplane/**
$APP/**
```

This allowlist appears in two locations that must be kept in sync:

- **`src-tauri/capabilities/default.json` `fs:scope.allow`** — the IPC-dispatch-gating scope (capability layer, consumed by the plugin's built-in commands if any are JS-exposed).
- **`src-tauri/src/lib.rs::run()::setup()`** — the runtime scope state (`app.fs_scope()`), populated programmatically at startup via `app.path().home_dir()`, `app.path().app_data_dir()`, and `app.path().resource_dir()`. This is the scope enforced by the custom `fs_*` IPC commands. See ADR-003 for why capability `fs:scope` entries do NOT automatically populate `app.fs_scope()`.

**Method permissions** — per Tauri 2.x's capability model (ADR-002), method-level grants are declared in `src-tauri/capabilities/default.json`, not in `tauri.conf.json`. The prior Tauri 1.x schema (`plugins.fs.readFile: true`, `writeFile: true`, etc.) has been removed. The current grants are: `fs:default`, `fs:allow-read-file`, `fs:allow-write-file`, `fs:allow-read-dir`, `fs:allow-exists`, `fs:allow-mkdir`. There is no `fs:allow-copy-file`, `fs:allow-remove-file`, `fs:allow-remove-dir`, or `fs:allow-rename-file` — operations not used by the current IPC surface are not granted.

Direct use of `@tauri-apps/plugin-fs` from the React UI is prohibited by an ESLint rule (see `CONTRIBUTING.md` FB-016 section). This rule is enforced pre-commit via Husky/lint-staged and in CI via `ci.yml`.

### Plugin Sandbox Boundaries

Plugins (Epic 04) are constrained by their declared `PluginCapabilities` manifest. Undeclared capabilities are not accessible even if the plugin attempts to call them. Critical constraints that are hardcoded and cannot be overridden by any plugin manifest:

- **Plugins cannot install hooks** — hooks are user-authored only. The Tauri shell will never honor a plugin request to write `settings.json` or add lifecycle hooks.
- **Plugins cannot write `settings.json`** — only the local user can modify their Claude Code settings.

These constraints are architectural (not just policy): the Tauri IPC command set registered in `lib.rs:82-91` does not include any hook-write or settings-write commands.

### Deep-Link Safety

The `zoeplane://` URL scheme handler validates every incoming URL (`lib.rs:108-133`). URLs with an unexpected scheme or malformed structure are logged at WARN and discarded — the app does not crash. Action dispatch from deep-link URLs (e.g., credential flows) is deferred to Epic 10 and is not implemented in Sprint 1.

### Sidecar Lifecycle Supervision

The Tauri shell supervises the sidecar process. If the sidecar terminates unexpectedly, the port is cleared from app state (`lib.rs:268-275`) so subsequent health-check calls fail loudly rather than attempting a dead HTTP endpoint. An ERROR is emitted on the `sidecar-lifecycle` tracing target.

## Reporting a Vulnerability

To report a security vulnerability in ZoePlane, email the BrinsCorp-Tech security contact:

**security@brinscorp.tech** (TBD — pending operator provisioning of security contact address)

Please include:

1. Description of the vulnerability and affected component
2. Reproduction steps (or a proof-of-concept)
3. Your assessment of impact

We will acknowledge receipt within 5 business days and provide an initial assessment within 10 business days.

## Disclosure Policy

ZoePlane follows coordinated disclosure. We ask reporters to:

1. Report privately (do not open a public GitHub issue for security vulnerabilities)
2. Allow 90 days for a fix before public disclosure
3. Coordinate the disclosure date with us if a public advisory is planned

We will credit reporters in the release notes and CHANGELOG unless anonymity is requested.

## Known Limitations

- **No privilege separation within the app process.** Tauri 2.0 does not run the WebView in a separate OS process with reduced privileges on all platforms. A JavaScript-level exploit in a plugin iframe could potentially affect the host process.
- **Sidecar runs as the current user.** There is no OS-level sandboxing of the sidecar binary beyond the FS allowlist enforced by the Tauri shell's IPC wrappers. If the sidecar is compromised, it can access anything the user can access that is not blocked by the Tauri IPC wrapper layer.
- **`~/.claude/` content is trusted.** ZoePlane reads skill and hook files from `~/.claude/` without content validation in Sprint 1. A maliciously crafted skill file could contain unexpected content. Content validation via the Skill Safety Evaluator is Epic 05.
- **HTTP loopback is not authenticated.** Any local process on the same machine that discovers the sidecar's ephemeral port can issue a `GET /health` request. In Sprint 1 the health endpoint is read-only and returns only `{ status: "ok", pid: N }`. Future IPC endpoints (Epics 03–09) must be audited for this exposure before adding mutation operations.

---

_Last reviewed: 2026-05-10 by sprint-programmer agent — Story 1.12 (three-way Tauri 2.x scope model, ADR-003; runtime scope init; fs.rs ancestor probe)._
