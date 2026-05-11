# ADR-002: Tauri 2.x Capability Model — adoption pattern, identifier discipline, and sidecar permission location

**Status:** Accepted (2026-05-10) — **invariant 4 partially superseded by [ADR-003](ADR-003-tauri-2x-runtime-scope.md) (2026-05-10)**. Manual smoke testing on the same evening this ADR was accepted surfaced a third Tauri 2.x scope concept (plugin runtime scope state, accessed via `app.<plugin>_scope()`) that this ADR's invariant 4 did not anticipate. ADR-003 is the canonical reference for the three-way scope split; ADR-002 invariants 1, 2, 3 remain in force unchanged.
**Date:** 2026-05-10
**Decision drivers:** Story 1.11 unblocks `bun run tauri` boot by migrating `tauri.conf.json` from a Tauri-1.x plugin-permission schema to the Tauri-2.x capability model. The capability model is the permanent way every plugin permission, every sidecar grant, and every future plugin-host SDK boundary will be expressed in this codebase. Locking the adoption pattern now — before any plugin or capability is added beyond the Sprint 1 surface — is materially cheaper than retrofitting it after Epic 02 (design system) and Epic 04 (plugin host SDK) start adding capability files of their own.

## Context

Tauri 1.x expressed plugin permissions inline in `tauri.conf.json` under `plugins.<name>` — boolean toggles per method (`readFile: true`, `writeFile: true`) with an optional `scope` array. Tauri 2.x replaces this with a **capability-based ACL system**:

- Permission identifiers (e.g., `fs:allow-read-file`, `shell:allow-execute`, `core:default`) live in `src-tauri/capabilities/*.json` files
- Each capability file scopes permissions to specific windows (by `label` or pattern)
- The `plugins.<name>` block in `tauri.conf.json` retains only **plugin configuration** (e.g., `fs.scope.allow/deny`, `deep-link.desktop.schemes`) — never **method-level permissions**
- Sidecar execution is no longer granted via `plugins.shell.scope[].sidecar = true`; it is granted via a `shell:allow-execute` permission entry in a capability file with explicit `name`, `cmd`, `args`, and `sidecar` fields
- The auto-generated catalog at `src-tauri/gen/schemas/desktop-schema.json` (and the per-platform variants) is the source-of-truth list of valid identifiers

This codebase declares Tauri 2.x crates in `Cargo.toml` (`tauri = "2"`, `tauri-plugin-{shell,fs,dialog,notification,process,deep-link} = "2"`) but `tauri.conf.json` still uses the 1.x plugin-permission schema. The `capabilities/` directory does not exist. This combination is non-functional — the 2.x plugin loader rejects 1.x schema fields at boot with a runtime panic (`PluginInitialization("shell", "Error deserializing 'plugins.shell' within your Tauri configuration: unknown field 'all', expected 'open'")`). Boot has not succeeded once since the project switched to 2.x crates; the failure was masked by CI exercising only `tauri build` (which performs schema validation but not plugin instantiation) and by `/code-audit` not modeling config-vs-dependency drift.

This decision is the project's first encounter with the capability model. Every future plugin addition (Epic 02 design-tokens watcher, Epic 03 indexer-driven UI events, Epic 04 plugin host SDK with its own per-plugin capability sub-files) will compound on the pattern this ADR locks in.

## Decision

**Adopt Tauri 2.x's capability model in full, with the following four invariants:**

1. **Single capability file at `src-tauri/capabilities/default.json`** for the Sprint 1 surface (one window: `main`). Per-plugin or per-feature capability splitting is deferred to the first plugin/feature that materially needs window-scoped or context-scoped restriction (Epic 04 plugin host SDK is the most likely first split — each loaded plugin will declare its own capability sub-file). Premature splitting hides the total permission surface; one file makes the surface auditable in a single read.

2. **Identifier discipline: enumerate every permission, never grant blanket access.** Use the auto-generated catalog at `src-tauri/gen/schemas/desktop-schema.json` as the source of truth. `core:default` is acceptable (it is the documented Tauri-recommended baseline for app-level events, paths, resources, and window controls and is verified against the schema). Plugin-level `<plugin>:default` identifiers are NOT used in this codebase except where the plugin's documented default matches the precise surface needed; otherwise enumerate `allow-*` permissions one-by-one. Rationale: `<plugin>:default` is a moving target across plugin minor versions (a plugin upgrade can silently expand the granted surface); enumerated identifiers are stable.

3. **Sidecar grants live in `capabilities/default.json`, never in `tauri.conf.json`.** The 2.x pattern places `shell:allow-execute` in the capability file with an `allow` array containing `{ name, cmd, sidecar: true, args }` entries. `tauri.conf.json` retains only `plugins.shell.open` (boolean — opening URLs in the user's default browser is a UX setting, not a plugin permission). The `bundle.externalBin` field stays in `tauri.conf.json` because it is a build-time bundling directive, not a runtime permission grant.

4. **Plugin configuration vs. plugin permissions: a hard separation.** `tauri.conf.json` `plugins.<name>` blocks contain only fields that are plugin-instance configuration (filesystem allowlist scope, deep-link URL schemes, dialog default options). Anything that grants the right to invoke a plugin method belongs in a capability file. This boundary is the only way to keep `tauri.conf.json` reviewable as configuration — once plugin permissions creep back in, the schema split that 2.x introduced is wasted.

## Consequences

**Positive:**

- Boot succeeds. The 1.x schema rejection panic is permanently resolved.
- Every future plugin addition follows a single documented pattern (this ADR + Story 1.11's `capabilities/default.json` as the worked example).
- The total permission surface for the app is auditable in one file (`capabilities/default.json`) and one schema (`gen/schemas/desktop-schema.json`); a security reviewer does not have to cross-reference plugin documentation to know what the app can do.
- Identifier discipline makes plugin upgrades auditable — a plugin minor-version bump that expands `<plugin>:default` cannot silently broaden the app's surface, because we never grant `<plugin>:default` for the plugins where surface stability matters.
- The capability/configuration split keeps `tauri.conf.json` reviewable as configuration, not as a security-relevant document.

**Negative:**

- Marginally more verbose than the 1.x boolean-toggle schema — every FS method we use is one line in the capability file rather than one boolean in `tauri.conf.json`. Acceptable cost: enumeration is the security-positive default, and four FS methods is not a large surface.
- Future plugin additions will require touching two files (`Cargo.toml` + `capabilities/default.json`) where the 1.x pattern needed only `tauri.conf.json`. This ADR makes the two-file requirement explicit so it is not surprising at code-review time.

- The `core:default` identifier is a small exception to the enumeration rule. Justified because it covers documented baseline functionality (path resolution, app metadata, resource loading, window lifecycle) where stability across Tauri minor versions is contractually maintained by the Tauri project, and because enumerating ~80 individual `core:*` identifiers would dwarf the meaningful permission grants and bury the security signal under boilerplate.

**Neutral:**

- The `src-tauri/gen/schemas/` directory is auto-generated by `tauri-build` from the installed plugin crates. It will rebuild on every `cargo build` and capture any plugin-version permission-surface changes. It is currently checked into git (Story 1.11 leaves it that way for diff visibility); a future story may evaluate gitignoring it once the regeneration cadence is well understood.

## Alternatives Considered

**Alternative A — split capabilities per plugin from day one** (`capabilities/fs.json`, `capabilities/shell.json`, `capabilities/deep-link.json`, etc.). Rejected: at the Sprint 1 surface (one window, six plugins, ~10 permission identifiers) splitting hides the total surface across files for no operational benefit. Tauri's capability merging is well-defined, so splitting later is a low-cost refactor when it becomes necessary (likely Epic 04 when each plugin-host plugin needs its own capability file).

**Alternative B — grant `<plugin>:default` for every plugin and rely on Tauri's defaults.** Rejected: `<plugin>:default` is a moving target across plugin versions. A `tauri-plugin-fs` minor-version upgrade that adds a new permission to its default set would silently expand our app's filesystem surface without any code change visible in this repo. Enumerated permissions make plugin upgrades auditable.

**Alternative C — keep sidecar grant inside `plugins.shell.scope` in `tauri.conf.json` and only migrate the FS plugin to capabilities.** Rejected: the 2.x plugin loader does not accept `plugins.shell.scope` at all in the legacy 1.x shape, and the 2.x replacement (`plugins.shell.open` + capability-based execution permissions) is a single coherent pattern. Splitting it across two configuration mechanisms doubles the cognitive load for no benefit.

**Alternative D — disable the shell plugin entirely and spawn the sidecar via `std::process::Command`.** Rejected: `tauri-plugin-shell`'s `Sidecar` integration handles platform-specific path resolution (`.exe` suffix on Windows, codesign trust on macOS, executable bit on Linux), event-channel wiring (`stdout`/`stderr`/`exit` as `CommandEvent` variants), and clean shutdown. Reimplementing those guarantees would be a multi-story effort with no security or functional benefit.

## Implementation Impact

**Story 1.11 implements this ADR.** Subsequent plugin additions must:

1. Add the plugin crate to `src-tauri/Cargo.toml` and register it in `lib.rs` via `.plugin(tauri_plugin_<name>::init())`.
2. Add the necessary `<plugin>:allow-<method>` identifiers to `capabilities/default.json` (or a per-feature capability file when the surface justifies splitting).
3. If the plugin requires instance configuration (allowlist scopes, URL schemes, etc.), add a `plugins.<name>` block to `tauri.conf.json` containing **only** configuration — never method permissions.
4. If the plugin requires sidecar or external-binary execution, add a `shell:allow-execute` entry to `capabilities/default.json` — never to `tauri.conf.json`.

For future readers: the canonical 2.x plugin-permission catalog is `src-tauri/gen/schemas/desktop-schema.json` (and `macOS-schema.json` for macOS-only permissions). When in doubt about whether an identifier exists, search that file. The auto-generated `gen/schemas/acl-manifests.json` and `gen/schemas/capabilities.json` are populated by `tauri-build` only after at least one capability file exists; they will fill in once Story 1.11 lands.
