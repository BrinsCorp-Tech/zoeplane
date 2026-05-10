# IPC API Reference — ZoePlane

## Overview

ZoePlane uses two IPC layers:

1. **Tauri commands** — `invoke()` calls from the React UI to the Rust shell. Registered in `src-tauri/src/lib.rs:82-91` via `tauri::generate_handler![]`. Each command is implemented in `src-tauri/src/ipc.rs` or `src-tauri/src/commands/`.
2. **HTTP loopback** — `GET http://127.0.0.1:{port}` requests issued by the Rust shell to the sidecar. The sidecar announces its port at startup via stdout.

The React UI communicates only with the Rust shell via Tauri commands. The React UI never speaks to the sidecar directly. The Rust shell relays relevant requests to the sidecar over the HTTP loopback.

### Capability gating

All Tauri commands are gated by the Tauri 2.x capability model (ADR-002). The `main` window's granted capabilities are declared in `src-tauri/capabilities/default.json`. The FS commands (`fs_read_file`, `fs_write_file`, `fs_read_dir`, `fs_exists`) require the corresponding `fs:allow-*` identifiers to be present in that file; the `ping` and `sidecar_status` commands are covered by `core:default`. The Rust function signatures and error modes documented below are unchanged by the capability model migration — capability gating is enforced by Tauri before the command handler is invoked.

## Tauri Commands

### `ping`

**File**: `src-tauri/src/ipc.rs:63-66`
**Stability**: Stable
**Purpose**: Verify the Tauri IPC bridge is alive. Does not involve the sidecar.

**Parameters**: none

**Returns**: `string` — always `"pong"`

**Example (TypeScript)**:

```typescript
import { invoke } from "@tauri-apps/api/core";
const result = await invoke<string>("ping");
// result === "pong"
```

---

### `sidecar_status`

**File**: `src-tauri/src/ipc.rs:77-155`
**Stability**: Stable
**Purpose**: Health-check the sidecar process by issuing `GET /health` to the sidecar's HTTP loopback server. Returns the sidecar's running state and OS PID.

**Parameters**: none (reads `SidecarPort` and `HttpClient` from Tauri app state)

**Returns**: `SidecarStatus` object:

```typescript
interface SidecarStatus {
  running: boolean; // true if the sidecar responded within 100 ms
  pid: number | null; // OS PID reported by the sidecar's /health response
  version: string | null; // reserved for future use; always null in Sprint 1
}
```

**Error modes**:

- Returns `{ running: false, pid: null, version: null }` (not a rejected promise) in all failure cases: port not yet known, HTTP timeout (>100 ms), connection refused, non-success HTTP status.
- Logs to `sidecar-ipc` tracing target on all failures; timeout events are logged at ERROR with `timeout_ms: 100`.

**Example (TypeScript)**:

```typescript
import { invoke } from "@tauri-apps/api/core";

const status = await invoke<{ running: boolean; pid: number | null; version: string | null }>(
  "sidecar_status",
);
if (status.running) {
  console.log("Sidecar is up, PID:", status.pid);
}
```

---

### `fs_read_file`

**File**: `src-tauri/src/commands/fs.rs:91-138`
**Stability**: Stable
**Purpose**: Read a file at `path`, enforcing the FS allowlist and logging any scope denial (FB-016).

**Parameters**:

| Name     | Type     | Description                                                                                                                                            |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `path`   | `string` | Absolute path to the file to read                                                                                                                      |
| `caller` | `string` | Short stable identifier for the invoking component (e.g., `"ProjectList"`, `"SettingsPanel"`, `"sidecar:indexer"`). Included in violation log entries. |

**Returns**: `Uint8Array` (raw bytes) on success.

**Error modes**:

- Returns `Err("path not allowed")` if the path is outside the FS allowlist. A structured violation log entry is emitted at ERROR level on the `fs-allowlist` tracing target before returning.
- Returns `Err(<OS error message>)` on I/O failure after the allowlist check passes.

**Example (TypeScript)**:

```typescript
import { invoke } from "@tauri-apps/api/core";

const bytes = await invoke<Uint8Array>("fs_read_file", {
  path: "/home/user/.claude/skills/my-skill.md",
  caller: "SkillBrowser",
});
const text = new TextDecoder().decode(bytes);
```

---

### `fs_write_file`

**File**: `src-tauri/src/commands/fs.rs:143-192`
**Stability**: Stable
**Purpose**: Write `contents` to `path`, enforcing the FS allowlist and logging any scope denial (FB-016).

**Parameters**:

| Name       | Type       | Description                                        |
| ---------- | ---------- | -------------------------------------------------- |
| `path`     | `string`   | Absolute path to write                             |
| `contents` | `number[]` | File contents as a byte array                      |
| `caller`   | `string`   | Invoking component identifier (for violation logs) |

**Returns**: `null` (void) on success.

**Error modes**: Same pattern as `fs_read_file` — `Err("path not allowed")` on scope denial (with violation log), `Err(<OS error>)` on I/O failure.

---

### `fs_read_dir`

**File**: `src-tauri/src/commands/fs.rs:197-265`
**Stability**: Stable
**Purpose**: List directory entries at `path`, enforcing the FS allowlist (FB-016).

**Parameters**:

| Name     | Type     | Description                    |
| -------- | -------- | ------------------------------ |
| `path`   | `string` | Absolute path to the directory |
| `caller` | `string` | Invoking component identifier  |

**Returns**: `string[]` — list of entry names (filenames, not full paths). Individual unreadable entries are skipped with an ERROR log; the overall listing does not fail for one bad inode.

**Error modes**: `Err("path not allowed")` on scope denial (with violation log); `Err(<OS error>)` if the directory itself cannot be opened.

---

### `fs_exists`

**File**: `src-tauri/src/commands/fs.rs:269-294`
**Stability**: Stable
**Purpose**: Check whether a path exists within the FS allowlist (FB-016). Returns an error (not `false`) if the path is outside the allowlist.

**Parameters**:

| Name     | Type     | Description                   |
| -------- | -------- | ----------------------------- |
| `path`   | `string` | Absolute path to check        |
| `caller` | `string` | Invoking component identifier |

**Returns**: `boolean` — `true` if path exists; `false` if it does not.

**Error modes**: `Err("path not allowed")` if the path is outside the allowlist (with violation log). This distinguishes "path does not exist" (`Ok(false)`) from "path is outside the allowed scope" (`Err`).

---

## Sidecar HTTP Loopback Protocol

The Rust shell communicates with the sidecar via HTTP on `127.0.0.1` at a kernel-assigned ephemeral port. This interface is **internal** — it is not accessible from the React UI or from outside the local machine.

### Port Announcement

At startup, the sidecar writes a single JSON line to stdout:

```
{"port": <N>}
```

The Rust shell reads this line in `lib.rs:299-328`, parses the port, stores it in `SidecarPort` app state, and emits the `sidecar-ready` event to the UI. The port changes on every sidecar launch.

Source: `sidecar/src/index.ts:141`.

### `GET /health`

**Stability**: Stable
**Purpose**: Health check. Called by the Rust shell's `sidecar_status` Tauri command with a 100 ms timeout.

**Request**: `GET http://127.0.0.1:{port}/health`

**Response** (HTTP 200):

```json
{ "status": "ok", "pid": 12345 }
```

**Error modes**: Any non-200 status or timeout causes `sidecar_status` to return `{ running: false }`. No authentication is required.

Source: `sidecar/src/index.ts:123-132`.

### Future endpoints

All routes other than `/health` return HTTP 404 in Sprint 1. Future epics will extend the routing table — see comments in `sidecar/src/index.ts:161-163` and `src-tauri/src/ipc.rs:157-160`.

## Planned Commands (Not Yet Implemented)

These are documented here as forward declarations visible in the codebase comments. They are not callable in Sprint 1.

| Command                                           | Source reference           | Target epic                      |
| ------------------------------------------------- | -------------------------- | -------------------------------- |
| `read_dir_recursive`, `watch_path`, `stop_watch`  | `src-tauri/src/ipc.rs:157` | Epic 03 (FS indexer)             |
| `run_evaluator`, `get_evaluator_result`           | `src-tauri/src/ipc.rs:158` | Epic 05 (Skill Safety Evaluator) |
| `spawn_task`, `stream_task_events`, `cancel_task` | `src-tauri/src/ipc.rs:159` | Epic 07 (Task runner)            |
| `read_hooks`, `write_hook`, `delete_hook`         | `src-tauri/src/ipc.rs:160` | Epic 09 (Hook management)        |

---

_Last reviewed: 2026-05-10 by project-manager agent — Story 1.11 (capability gating note added)._
