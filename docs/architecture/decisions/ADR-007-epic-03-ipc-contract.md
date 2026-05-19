# ADR-007: Epic 03 IPC Contract — Locked Sprint 4 Surface

**Status:** Accepted (2026-05-18)
**Date:** 2026-05-18
**Decision drivers:** Story 3.10 (Epic 03 integration ceremony); Active Constraint 1 in sprint-context.md (Epic 06 cannot start without stable Epic 03 IPC surface); ADR-005 (watcher layer); Sprint 4 Batch 3 delivery.

## Context

Epic 03 (Filesystem Watchers & Asset Indexing Core) shipped eight stories (3.2–3.9) across Sprint 3 and Sprint 4 Batch 2. Each story introduced IPC event types and/or Tauri command signatures in isolation. Before Epic 06 (Library UI) can begin consuming these surfaces, the contract must be:

1. Audited for completeness and consistency.
2. Locked with explicit SemVer policy.
3. Published as a consolidated barrel (`packages/shared-types/src/epic-03.ts`).
4. Documented in an ADR that Epic 06 can reference as source-of-truth.

Without this lockdown, Epic 06 risks consuming half-finalized event shapes that change under it mid-sprint.

### Audit findings (Story 3.10)

**WARN-1 (resolved):** The story AC listed `WatcherError` as an event type. The shipped type name is `WatcherErrorEvent` (with `Event` suffix, consistent with all other watcher event types). The barrel uses the correct shipped name `WatcherErrorEvent`. Epic 06 must use `WatcherErrorEvent`, not `WatcherError`.

**WARN-2 (resolved):** `ValidationFallbackWarning` does not exist as a standalone type. The fallback warning concept is encoded as `ValidationCompletedEvent.fallback: boolean` — when the gray-matter library is unavailable, the validator emits a `ValidationCompletedEvent` with `fallback: true` rather than a separate event type. The separate type was planned but not shipped. It is omitted from the barrel and noted here as a risk (see Risks section).

**WARN-3 (resolved):** Five of seven Epic 03 Tauri commands (`switch_project`, `add_project`, `remove_project`, `register_open_editor`, `unregister_open_editor`) previously returned `Result<(), String>`, which throws across the Tauri command boundary on `Err`. Two commands (`reveal_in_finder`, `open_in_editor`) returned `Result<ShellResponse, String>` with structured error payloads. Story 3.10 normalizes all seven to `Result<CommandResponse, String>` where the `Err` branch is structurally unreachable. All error conditions are encoded as `Ok(CommandResponse::err(...))`. See §Normalization below.

**WARN-4 (resolved):** `switch_project` has three parameters (`projectId`, `stackJson`, `layoutJson`) — only `projectId` was mentioned in the story AC. All three are documented in the barrel.

## Decision

**Lock the Epic 03 IPC surface as defined in this ADR. No additive or breaking changes without SemVer-compliant review.**

### 1. Locked event types

The following event types are part of the Epic 03 public contract. All are exported from `packages/shared-types/src/epic-03.ts` (watcher events) or defined in `packages/shared-types/src/index.ts` (project-switch events):

| Event type                              | Source file  | Story | SSE channel constant                   |
| --------------------------------------- | ------------ | ----- | -------------------------------------- |
| `WatcherStartedEvent`                   | `watcher.ts` | 3.2   | `WATCHER_STARTED`                      |
| `WatcherErrorEvent`                     | `watcher.ts` | 3.2   | `WATCHER_ERROR`                        |
| `AssetIndexUpdatedEvent`                | `watcher.ts` | 3.2   | `WATCHER_ASSET_UPDATED`                |
| `AssetIndexHydratedEvent`               | `watcher.ts` | 3.3   | `ASSET_INDEX_HYDRATED`                 |
| `AssetValidationUpdatedEvent`           | `watcher.ts` | 3.5   | `ASSET_VALIDATION_UPDATED`             |
| `ValidationCompletedEvent`              | `watcher.ts` | 3.5   | `VALIDATION_COMPLETED`                 |
| `LibraryRefreshEvent`                   | `watcher.ts` | 3.8   | `LIBRARY_REFRESH`                      |
| `AssetExternallyModifiedWhileOpenEvent` | `watcher.ts` | 3.8   | `ASSET_EXTERNALLY_MODIFIED_WHILE_OPEN` |
| `ProjectSwitchCompletedEvent`           | `index.ts`   | 3.7   | Tauri event `project-switch-completed` |
| `ProjectClaudeMissingWarning`           | `index.ts`   | 3.7   | Tauri event `project-claude-missing`   |
| `ProjectSwitchFailedEvent`              | `index.ts`   | 3.7   | Tauri event `project-switch-failed`    |

**Not shipped:** `ValidationFallbackWarning` — see Risks section.
**Not in Epic 03:** `HookIndexCompletedEvent` — shipped in Story 3.6 but consumed by Epic 09, not Epic 06. It is exported from `watcher.ts` but not re-exported in the Epic 03 barrel (it is part of the `WatcherEvent` union in `watcher.ts` for consumers that need exhaustive switching).

### 2. Locked Tauri command signatures

All commands return `Result<CommandResponse, String>` where the `Err` branch is structurally unreachable. Epic 06 should invoke them as `Promise<CommandResponse>` and check `result.ok` to discriminate success from failure.

| Command                  | Parameters                                                   | Error codes                                                                   |
| ------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `switch_project`         | `projectId: string, stackJson?: string, layoutJson?: string` | `unknown_project`, `fs_scope_extension_failed`, `internal_error`              |
| `add_project`            | `projectRoot: string`                                        | `claude_dir_missing`, `claude_dir_not_directory`, `internal_error`            |
| `remove_project`         | `projectId: string`                                          | `unknown_project`, `internal_error`                                           |
| `reveal_in_finder`       | `path: string`                                               | `scope_denied`, `file_not_found`, `shell_invocation_failed`                   |
| `open_in_editor`         | `path: string`                                               | `scope_denied`, `file_not_found`, `shell_invocation_failed`, `internal_error` |
| `register_open_editor`   | `path: string`                                               | `path_not_watched`, `internal_error`                                          |
| `unregister_open_editor` | `path: string`                                               | `internal_error`                                                              |

### 3. CommandResponse shape

```typescript
interface CommandResponse {
  ok: boolean;
  code?: string; // present when ok: false
  message?: string; // present when ok: false
  path?: string; // present when the error is path-specific
}
```

Rust definition: `src-tauri/src/commands/response.rs` (`CommandResponse` struct).

### 4. CommandResponse normalization (AC #7)

Story 3.10 extracted `ShellResponse` from `assets.rs` into a shared `commands/response.rs` module, renamed it `CommandResponse` to signal broader applicability, and refactored all five previously-throwing commands to return `Ok(CommandResponse::err(...))` on all error paths.

Rationale: unhandled promise rejections on the JavaScript side from `Err(String)` results are difficult to trace and produce no structured error payload for UI rendering. Encoding all errors as `ok: false` discriminated values gives Epic 06 a uniform pattern.

The `Err(String)` branch of `Result<CommandResponse, String>` is retained because Tauri's async command trait requires it — but no code path in any command reaches it at runtime.

### 5. SemVer policy

- **Additive change** (new event type, new optional field on existing type, new command): allowed at any time; bumps the `@zoeplane/shared-types` **minor** version.
- **Field rename or removal** on an existing locked event type: **major** version bump required. Must be coordinated with an Epic 06 amendment before merge. Sprint-programmer must surface this to the architect before implementing.
- **Command signature change** (parameter added, parameter removed, error code renamed): treated as a field rename — **major** bump + Epic 06 amendment.
- **New required field** on an existing event type: treated as a breaking change — **major** bump.

### 6. Backward compatibility commitment

All event types and command signatures listed in §1 and §2 will remain stable through v1.0. Epic 06 can consume them without guarding for removal.

## Consequences

**Positive:**

- Epic 06 has a single authoritative reference (this ADR + `epic-03.ts`) for every event and command it needs to consume.
- All Tauri commands now have a uniform response pattern. UI code can use a single `if (!result.ok)` check for all commands.
- The `CommandResponse` type is exported from `@zoeplane/shared-types` so UI TypeScript consumers get full type coverage for invoke call sites.
- `WatcherErrorEvent` naming inconsistency (vs. story AC's `WatcherError`) is documented and resolved before Epic 06 writes any subscriber code.

**Negative:**

- `ValidationFallbackWarning` is absent — consumers of the fallback-mode signal must read `ValidationCompletedEvent.fallback: boolean` instead of a dedicated type. This is a minor ergonomic degradation; the information is still available.
- `HookIndexCompletedEvent` is not in the Epic 03 barrel — Epic 09 must import it directly from `@zoeplane/shared-types` (via the `watcher.ts` re-export) rather than from the Epic 03 surface. Consistent with the barrel's scope being Epic 06's needs.

**Neutral:**

- `IPC-API.md` (the OSS public doc) will be refreshed at the Sprint 4 `/code-doc` run using this ADR as source-of-truth.

## Risks

**R-1: `ValidationFallbackWarning` not shipped.**
The concept is encoded in `ValidationCompletedEvent.fallback: boolean`. If the validator pipeline grows a true fallback-mode warning path that warrants a dedicated event type in the future, that introduction is an additive minor change (new event type) — no breaking change to existing consumers.

**R-2: `HookIndexCompletedEvent` outside the barrel.**
Story 3.6 shipped `HookIndexCompletedEvent` for Epic 09 (hook management). It is intentionally excluded from the Epic 03 barrel because Epic 06 does not consume it. If a future sprint adds an Epic 06 consumer for hook counts, the type can be added to the barrel as an additive minor change.

**R-3: FS scope-narrow gap in `remove_project`.**
Tauri `tauri-plugin-fs` v2.5.1 has no `disallow_directory` API. Once a project's `.claude/**` path is scope-extended via `switch_project`, it cannot be narrowed at runtime until app restart. This is a v1 known limitation documented in `project.rs`. It does not affect IPC event shapes. Track under GitHub label `epic-02/fs-scope-narrow`.

## Relationship to Prior ADRs

- **ADR-005** (Watcher Layer — sidecar chokidar): This ADR governs the event-shape contract; ADR-005 governs the watcher implementation layer. The two are complementary — ADR-005 is the source of implementation truth, ADR-007 is the source of API contract truth for consumers.
- **ADR-006** (Visual Coverage Posture): Orthogonal. No visual-regression impact.
- **ADR-001 through ADR-004**: Orthogonal to IPC event shapes.
