# IPC API Reference — ZoePlane

## Overview

ZoePlane uses two IPC layers:

1. **Tauri commands** — `invoke()` calls from the React UI to the Rust shell. Registered in `src-tauri/src/lib.rs` via `tauri::generate_handler![]`. Each command is implemented in `src-tauri/src/ipc.rs` or `src-tauri/src/commands/`. Used for filesystem operations, OS-level commands, and Epic 03 project-management commands.
2. **Sidecar HTTP loopback** — HTTP requests on `http://127.0.0.1:{port}`. This interface serves two callers:
   - The **Rust shell** uses it internally for health-checking (`GET /health` via `sidecar_status` command).
   - The **React UI** uses it directly for read-heavy library data queries (`GET /assets`) and the SSE event stream (`GET /events`), per **ADR-009**. This direct-fetch path was introduced in Sprint 5 and formally retires the prior "UI never speaks to sidecar directly" rule for the read-only data-query case.

**Routing summary**:

| Operation type | Path |
|---|---|
| FS read/write/list/exists | React UI → `invoke()` → Tauri Rust shell → OS |
| OS / sidecar status | React UI → `invoke()` → Tauri Rust shell |
| Epic 03 project commands | React UI → `invoke()` → Tauri Rust shell → sidecar |
| Library asset queries (`GET /assets`) | React UI → direct `fetch()` → sidecar |
| Live library invalidation (`GET /events` SSE) | React UI → `EventSource` → sidecar |
| Internal health-check | Tauri Rust shell → `GET /health` → sidecar |

### Capability gating

All Tauri commands are gated by the Tauri 2.x capability model (ADR-002). The `main` window's granted capabilities are declared in `src-tauri/capabilities/default.json`. The FS commands (`fs_read_file`, `fs_write_file`, `fs_read_dir`, `fs_exists`) require the corresponding `fs:allow-*` identifiers to be present in that file; the `ping` and `sidecar_status` commands are covered by `core:default`. The Rust function signatures and error modes documented below are unchanged by the capability model migration — capability gating is enforced by Tauri before the command handler is invoked.

#### Tauri 2.x scope concepts (three-way split)

Tauri 2.x has three distinct scope layers that are easy to conflate (ADR-003 is the canonical reference):

1. **Plugin runtime configuration** — fields in `tauri.conf.json plugins.<name>`. Read once at plugin init; never mutated. For `tauri-plugin-fs` v2.5.1, the only accepted field is `requireLiteralLeadingDot`.
2. **Capability ACL gating** — permission entries in `capabilities/default.json`. Enforced by Tauri at IPC dispatch before any command handler is called. The `fs:scope` entry here documents the canonical allowlist and gates any future plugin built-in commands exposed via JS.
3. **Plugin runtime scope state** — an in-memory mutable object owned by the plugin, accessed via `app.fs_scope()` (provided by `tauri_plugin_fs::FsExt`). **This is the scope that the FS commands' `Err("path not allowed")` deny is enforced against.** Capability `fs:scope` entries do NOT populate this scope; it is populated programmatically at app startup in `src-tauri/src/lib.rs::run()::setup()`. See ADR-003 for the rationale and invariants.

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
**Caller**: Rust shell (via `sidecar_status` Tauri command). Not called directly by the React UI.
**Purpose**: Health check. Called with a 100 ms timeout.

**Request**: `GET http://127.0.0.1:{port}/health`

**Response** (HTTP 200):

```json
{ "status": "ok", "pid": 12345 }
```

**Error modes**: Any non-200 status or timeout causes `sidecar_status` to return `{ running: false }`. No authentication is required.

Source: `sidecar/src/index.ts`.

---

### `GET /events` (SSE)

**Stability**: Stable (locked by ADR-007 SemVer policy)
**Caller**: React UI — `useLibrarySSE` hook (`src/hooks/useLibrarySSE.ts`) and any other consumer that subscribes to watcher events.
**Purpose**: Server-Sent Events stream. The sidecar pushes all watcher, indexer, validator, hook-discovery, and event-router events over this endpoint. Introduced in Sprint 3 (Story 3.2); event types expanded through Sprint 4.

**Request**: `GET http://127.0.0.1:{port}/events`

The sidecar responds with `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`. An immediate `": connected"` heartbeat comment is sent on connect so the client knows the stream is live before any events arrive.

**Event envelope** (all events): Each event is serialized as a single SSE `data:` line:

```
data: <JSON>\n\n
```

The JSON object always carries a `type` field matching one of the channel-name constants defined in `packages/shared-types/src/watcher.ts`.

**Event types** (all exported from `@zoeplane/shared-types`):

| Type constant | Interface | Emitted by | Purpose |
|---|---|---|---|
| `WATCHER_ASSET_UPDATED` (`"asset:index:updated"`) | `AssetIndexUpdatedEvent` | `indexer/watcher.ts` | File-system change detected at a watched path; signals re-index |
| `WATCHER_STARTED` (`"watcher:started"`) | `WatcherStartedEvent` | `indexer/watcher.ts` | Watch root successfully registered |
| `WATCHER_ERROR` (`"watcher:error"`) | `WatcherErrorEvent` | `indexer/watcher.ts` | Watch root error (e.g., `project_claude_missing`, `EMFILE`) |
| `ASSET_INDEX_HYDRATED` (`"asset:index:hydrated"`) | `AssetIndexHydratedEvent` | `indexer/scanner.ts` | Cold-launch scan complete; carries per-kind counts and elapsed ms |
| `VALIDATION_COMPLETED` (`"validation:completed"`) | `ValidationCompletedEvent` | `indexer/validator.ts` | Startup validation pipeline complete; carries valid/warnings/invalid counts |
| `ASSET_VALIDATION_UPDATED` (`"asset:validation:updated"`) | `AssetValidationUpdatedEvent` | `indexer/validator.ts` | Per-asset revalidation complete after a watcher-triggered change |
| `HOOK_INDEX_COMPLETED` (`"hook:index:completed"`) | `HookIndexCompletedEvent` | `indexer/hook-discovery.ts` | Hook discovery complete; carries hook count and elapsed ms |
| `LIBRARY_REFRESH` (`"library:refresh"`) | `LibraryRefreshEvent` | `indexer/event-router.ts` | Asset insert/update/remove batch-window summary; primary consumer is `useLibrarySSE` |
| `ASSET_EXTERNALLY_MODIFIED_WHILE_OPEN` (`"asset:externally-modified-while-open"`) | `AssetExternallyModifiedWhileOpenEvent` | `indexer/event-router.ts` | File modified externally while open in the editor; suppresses LibraryRefreshEvent |

Source: `packages/shared-types/src/watcher.ts`, `sidecar/src/index.ts`.

**Usage pattern** — the `useLibrarySSE` hook:

```typescript
import { useLibrarySSE } from "@/hooks/useLibrarySSE";

// In AgentLibraryView / SkillLibraryView:
useLibrarySSE("agent", sidecarReady);
// Invalidates TanStack Query key ["assets", "agent"] on each LibraryRefreshEvent
// where event.kind === "agent". See src/hooks/useLibrarySSE.ts.
```

**CORS**: All responses include `Access-Control-Allow-Origin: *` (safe — the sidecar is bound to `127.0.0.1` only). Source: `sidecar/src/index.ts` `CORS_HEADERS` constant.

---

### `GET /assets` (ADR-009)

**Stability**: Stable — locked at SemVer through v1.0.0 per ADR-009 §7.
**Caller**: React UI — `src/lib/fetch-assets.ts::fetchAssets()`, consumed via TanStack Query in `AgentLibraryView` and `SkillLibraryView`.
**Purpose**: Paginated read query for the asset index. Returns `AssetSummary[]` with server-side-parsed front-matter and LEFT-JOINed provenance. Introduced in Sprint 5 (Story 6.2).

**Request**: `GET http://127.0.0.1:{port}/assets?kind=<kind>[&scope=<scope>][&projectId=<uuid>]`

**Query parameters**:

| Parameter | Required | Values | Description |
|---|---|---|---|
| `kind` | Yes | `skill \| agent \| command \| team \| workflow` | Asset kind to return. Returns 400 if absent or invalid. |
| `scope` | No | `global \| project \| local` | Filter by scope. Omit to return all scopes. Returns 400 if present and invalid. |
| `projectId` | Conditional | UUID string | Required when `scope` is `project` or `local`. Returns 400 if omitted in that case. |

**Response** (HTTP 200 — `AssetsResponse` from `packages/shared-types/src/epic-06.ts`):

```typescript
interface AssetsResponse {
  assets: AssetSummary[];  // up to 500 rows
  truncated: boolean;       // true when result set exceeded the 500-row soft cap
  totalCount: number;       // actual DB row count before soft cap was applied
}
```

Each `AssetSummary` contains: `id`, `kind`, `name`, `scope`, `projectId`, `sourcePath`, `validationStatus`, `lastModifiedAt`, `lastModifiedBy`, `frontMatter` (server-side JSON.parsed from `assets.front_matter_json` — `null` on parse failure), `bodyExcerpt`, and `provenance` (LEFT-JOINed `AssetProvenanceSummary` or `null`).

**Soft cap**: The query uses `LIMIT 501`. If the DB returns >500 rows, the response truncates to 500 and sets `truncated: true`. No cursor/pagination is defined in v1.

**Sort order**: `ORDER BY kind ASC, scope ASC, name ASC` — deterministic across pages.

**Error responses**:

| Status | Cause |
|---|---|
| 400 Bad Request | `kind` absent/invalid; `scope` invalid; `projectId` absent when scope requires it |
| 500 Internal Server Error | SQLite query failure (logged to sidecar stderr) |

**SQL**: Server-side LEFT JOIN on `asset_provenance WHERE asset_provenance.deleted_at IS NULL AND assets.deleted_at IS NULL AND assets.shadowed_by_project_id IS NULL`. The `idx_asset_provenance_asset_id` index (`004_indexes.sql`, Sprint 5 CR-4 paydown) is required for acceptable query performance. Source: `sidecar/src/routes/assets.ts`.

**Client usage** (TypeScript):

```typescript
import { fetchAssets } from "@/lib/fetch-assets";
import { getSidecarBaseUrl } from "@/lib/sidecar-client";

useQuery({
  queryKey: ["assets", "agent", "global"],
  queryFn: () => fetchAssets({ kind: "agent", scope: "global" }),
  enabled: getSidecarBaseUrl() !== null,
});
```

---

### `POST /watcher/project/open`

**Stability**: Stable (ADR-007)
**Caller**: Tauri shell (via Epic 03 `switch_project` command relay)
**Purpose**: Register a per-project `.claude/` watch root.

**Request body**: `{ "projectRoot": "/absolute/path" }`

**Response** (200): `{ "ok": true, "projectRoot": "..." }` or a `WatcherErrorEvent` is emitted on the `/events` stream with reason `"project_claude_missing"` if `<projectRoot>/.claude/` does not exist.

---

### `POST /watcher/project/close`

**Stability**: Stable (ADR-007)
**Caller**: Tauri shell
**Purpose**: Remove a per-project watch root.

**Request body**: `{ "projectRoot": "/absolute/path" }`

**Response** (200): `{ "ok": true, "projectRoot": "..." }`

---

### `GET /projects/:id`

**Stability**: Stable (ADR-007)
**Purpose**: Look up a `projects` row by UUID.

**Response** (200): `{ id, path, displayName, lastOpenedAt }` or 404 if not found / soft-deleted.

---

### `POST /projects`

**Stability**: Stable (ADR-007)
**Purpose**: Add a new tracked project. Does not auto-activate.

**Request body**: `{ "projectRoot": "/absolute/path" }`

**Response** (200): `{ "ok": true, "id": "<uuid>", "projectRoot": "..." }`

---

### `POST /projects/:id/remove`

**Stability**: Stable (ADR-007)
**Purpose**: Soft-delete a project. Tombstones associated `assets`, `hook_index`, `route_stacks`, and `recent_files` rows.

**Response** (200): `{ "ok": true }` or 404 if the project is not found.

---

_Last reviewed: 2026-05-20 by tech-writer agent against Sprint 5 (ADR-009 sidecar /assets surface + Sprint 3 /events SSE + ADR-007 Epic 03 IPC contract)._
