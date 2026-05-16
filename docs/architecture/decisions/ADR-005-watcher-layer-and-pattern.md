# ADR-005: Watcher Layer & Implementation Pattern

**Status:** Accepted (2026-05-15)
**Date:** 2026-05-15
**Decision drivers:** Story 3.2 (Epic 03 — Filesystem Watchers & Asset Indexing Core); PRD FR-033 (watcher-root gating), FR-073 (per-project lifecycle), FR-077 (250 ms re-index latency); Epic 03 Risk register #4 (OS file-descriptor limits); operator layer lock 2026-05-15.

## Context

ZoePlane must watch `~/.claude/{skills,agents,commands,teams,workflows,settings.json}` plus
the per-project `<projectRoot>/.claude/` subtrees of every open project. The watching service
must:

1. Start at sidecar startup and survive the full application lifetime.
2. Add / remove per-project watch roots dynamically as the user opens and closes projects.
3. Coalesce same-path FS events within 250 ms into a single re-index trigger (FR-077).
4. Drop events for paths outside explicitly configured watch roots (FR-033).
5. Emit structured events to the React UI via the existing sidecar HTTP loopback IPC.
6. Handle OS-level watch errors (permission denied, file-descriptor exhaustion, root deleted) without crashing.

Two implementation layers were evaluated:

### Option A — Rust `notify` crate inside `src-tauri/src/services/watcher.rs`

The `notify` crate (v6) with the `macos_fsevent` feature provides low-latency FSEvents
integration. However, as of Sprint 3:

- Neither `notify` nor the `tokio` async runtime are present in `src-tauri/Cargo.toml`.
  Adding them would require: (1) adding `tokio` with `full` or `rt-multi-thread` features —
  a non-trivial surface-area addition to the Rust binary; (2) implementing explicit FSEvents
  coalescing because `notify` delivers raw events and atomic-write sequences (temp-write +
  rename) must be deduplicated manually; (3) a new Tauri command or event channel to fan
  events out to the sidecar (which owns the SQLite index) — adding a Tauri ↔ sidecar IPC leg
  not present today.
- The Rust core's responsibility boundary (per ADR-002, ADR-003) is: Tauri capability gating,
  FS scope enforcement, and sidecar process lifecycle. Pulling watcher logic into Rust extends
  that boundary without a compensating benefit.

### Option B — Sidecar Bun layer using `chokidar`

The sidecar already runs as a Bun process with direct access to the host filesystem (Node.js
`fs`, not gated by Tauri's FS capability model). The sidecar hosts the SQLite asset index —
so watcher events and their immediate consumer (the indexer) are co-located, avoiding an IPC
round-trip between watcher and indexer.

`chokidar` v5 uses `node:fs.watch` (kernel-level FS events on macOS) with its built-in
`atomic: true` mode (100 ms window) to collapse delete+create sequences from atomic-save
writers like VSCode/Cursor/Zed into a single event before delivering to application code.
The 250 ms application-level debounce window (FR-077) then provides a second collapse layer,
ensuring a single `AssetIndexUpdatedEvent` per path even if chokidar delivers more than one
event in a burst.

The single-watcher-multiple-roots pattern (`chokidar.watch([root1, root2, ...]).add(root3)` /
`.unwatch(root3)`) avoids spawning one watcher instance per project — the naive per-project
pattern would exhaust `kern.maxfiles` on macOS at ~20 tracked projects (Epic 03 Risk #4).
chokidar's `FSWatcher` instance accepts an array of paths at construction and supports
`.add()` / `.unwatch()` to mutate the watched set at runtime, which maps exactly to the
project-open / project-close lifecycle.

## Decision

**Layer: Sidecar Bun process using `chokidar`.** Option B is selected. Option A is
rejected.

### 1. Layer choice

The watcher service lives at `sidecar/src/indexer/watcher.ts`. It is a Bun/Node.js module,
not a Rust module. The Tauri core does not participate in event delivery.

### 2. Rationale

- **Latency tradeoff is acceptable.** FS watcher events are not user-blocking: the sidecar
  receives the chokidar event, coalesces for 250 ms, then writes to SQLite and emits
  `AssetIndexUpdatedEvent` to the UI. The total latency budget (250 ms debounce + SQLite write
  - HTTP round-trip to UI) is well within the PRD FR-077 target of 250 ms from last-event to
    re-index trigger. The UI renders a skeleton/loading state during indexing; the user does not
    wait on the watcher directly.
- **macOS atomic-write handling.** chokidar v5's `node:fs.watch` backend with `atomic: true`
  absorbs transient delete+create pairs from atomic editors (VSCode, Cursor, Zed write to a
  temp file and rename atomically). The 250 ms application-level debounce window provides a
  second collapse layer. If the Rust `notify` path were chosen, this collapse would have to be
  implemented manually using `tokio::time::sleep` per path key.
- **Smaller surface.** No new Rust module, no `tokio` runtime addition, no new Tauri ↔
  sidecar coordination protocol. The sidecar already owns the HTTP loopback IPC and SQLite —
  co-locating the watcher here keeps the asset indexing pipeline entirely in one process.
- **Existing scaffold alignment.** `sidecar/src/indexer/README.md` listed `watcher.ts` as a
  planned chokidar or Bun-native watch implementation (before ADR lock). The sidecar path was
  already the directional scaffold assumption.

### 3. Single-watcher-multiple-roots pattern

A **single `chokidar.FSWatcher` instance** is created at sidecar startup and shared across
all watch roots. Roots are added and removed via:

```
watcher.add(path)    // project:open or startup
watcher.unwatch(path) // project:close or shutdown
```

This avoids spawning N watcher instances for N open projects. On macOS, each `node:fs.watch`
instance consumes file descriptors; at 20 projects the naive per-instance pattern approaches
`kern.maxfiles` limits. The single-instance pattern keeps descriptor consumption constant at
one watcher instance regardless of project count.

Watch roots registered at startup (global):

- `~/.claude/skills/` (recursive)
- `~/.claude/agents/` (recursive)
- `~/.claude/commands/` (recursive)
- `~/.claude/teams/` (recursive)
- `~/.claude/workflows/` (recursive)
- `~/.claude/settings.json` (file watch, non-recursive)

Per-project watch root (added on `project:open`):

- `<projectRoot>/.claude/` (recursive)

### 4. Event coalescing window

**250 ms** per FR-077. Implementation: a `Map<string, ReturnType<typeof setTimeout>>` keyed
on absolute normalized path. When a chokidar event fires for path P:

1. If `coalescingMap.has(P)`, `clearTimeout(coalescingMap.get(P))`.
2. Set a new timer for 250 ms. On fire: delete the key, emit `AssetIndexUpdatedEvent`.

This collapses any number of same-path events within a 250 ms window into a single emission.
The 250 ms window also absorbs atomic-write double-events (delete + create within ≤ 100 ms).

### 5. Dependency additions

- `chokidar` added to `sidecar/package.json` `dependencies` via `bun add chokidar`.
- `@types/chokidar` is not needed — chokidar v3+ ships its own TypeScript declarations.

### 6. Error semantics for invalid watch roots

When a watch root becomes invalid (path does not exist, permission denied, file-descriptor
exhaustion):

- **On `project:open` with missing `.claude/` directory:** do not add the watch root. Emit
  `WatcherErrorEvent { type: "watcher:error", root, reason: "project_claude_missing" }` over
  IPC.
- **On chokidar `error` event during operation:** log the error via the sidecar `log` helper
  at WARN level (not ERROR — the watcher instance continues running). Emit `WatcherErrorEvent`
  with `reason: error.message`. The rest of the watcher instance continues watching other
  roots unaffected.
- **On graceful shutdown:** call `watcher.close()`. The sidecar lifecycle log records the
  count of watch roots dropped at shutdown.
- **Out-of-root events:** chokidar only emits events for explicitly added roots, so FR-033
  watcher-root gating is satisfied by chokidar's design. A defensive `console.debug` (gated
  by `DEBUG=watcher:*`) is emitted if an unexpected path arrives at the handler boundary.

## Consequences

**Positive:**

- Zero Rust churn — the Tauri binary does not change. ADR-002 and ADR-003 invariants are
  unaffected.
- Asset indexing pipeline is fully co-located in the sidecar process. Watcher events drive
  the indexer (Stories 3.3–3.5) without any IPC hop.
- chokidar's FSEvents binding absorbs macOS atomic-write edge cases automatically. The
  250 ms application debounce provides a second collapse layer at no implementation cost.
- Single-instance-multiple-roots pattern is idiomatic chokidar; the API maps exactly to the
  project lifecycle events (`project:open` → `.add()`, `project:close` → `.unwatch()`).

**Negative:**

- chokidar is an additional npm dependency (~6 kB gzipped). chokidar v5 uses `node:fs.watch`
  internally and does not bundle a native addon (unlike v3/v4 which required the `fsevents`
  binary on macOS). The sidecar is compiled to a single Bun binary via `bun build --compile`;
  cross-platform behavior should be verified on the CI matrix (macOS, Windows, Linux) before
  first tagged release.
- The sidecar HTTP loopback IPC (Sprint 1 design) requires adding an SSE event stream or
  polling endpoint for the UI to receive `AssetIndexUpdatedEvent`. Story 3.2 introduces a
  minimal SSE endpoint (`GET /events`). This extends the sidecar HTTP surface — planned, not
  incidental.

**Neutral:**

- The `withGlobalTauri: true` flag in `src-tauri/tauri.conf.json` remains in place for
  now (Sprint 1.12 mandate). Revert to `false` is a pre-Epic-04 task per SPRINT-2-CARRYOVERS.
- The Tauri-side FB-015 dynamic FS scope extension (Story 3.7) is still needed for Tauri
  commands (`assets.rs`, Reveal in Finder) to access per-project `.claude/` directories.
  This ADR does not change that requirement — it only clarifies that the sidecar watcher
  itself does not use Tauri's FS capability model.

## Symlinked Watch Roots (`followSymlinks: true`)

**Amendment date: 2026-05-16 (CR-5)**

The ZoePlane sidecar runs with `followSymlinks: true`. The PAI deployment model ships
`~/.claude/{skills,agents,commands,teams,workflows}` as symbolic links into a
version-controlled `pai-config/` tree. chokidar 5.0.0's symlink dispatch in `_addToNodeFs`
(handler.js:602) routes symlinked watch roots through a code path that **skips the recursive
directory walk** when `followSymlinks` is false — only the symlink entry itself in the parent
directory is watched, producing the symptom that events fire for file-typed roots (e.g.,
`settings.json`) but not for any path inside a directory-typed root.

chokidar v5 walks subdirectories manually via `readdirp` (it does NOT use `fs.watch`'s
`recursive` option). The walk is gated on `stats.isDirectory()`, which `lstat` reports as
`false` for symlinks. `followSymlinks: true` switches the stat method to `stat`, which
follows the symlink and reports `isDirectory: true` for symlinked directories — enabling the
recursive walk.

Trade-off accepted: chokidar will follow symlinks recursively inside watched trees, bounded
by its internal `_symlinkPaths` visited-set to prevent cycles. For v1 the watch roots are
operator-controlled paths; untrusted symlink injection is not a concern. If untrusted project
trees become a watched surface (Epic 04 plugin sandbox, multi-tenant workspaces), revisit
with an explicit `ignored` matcher that rejects symlink targets outside the watch root.

## Observability

Startup logs include `symlink: boolean` and `target: string | null` fields on every
"Watcher: registered global root" and "Watcher: registered project root" log line. A `true`
symlink field with the resolved `realpath` target means: this root is a symlink and chokidar
is following it into the real directory tree. This field surfaces the CR-5 class of bug
without code archaeology — if a future regression flips `followSymlinks` back to `false`,
the `symlink: true` entries in startup logs will immediately identify which roots were
affected.

## Alternatives Considered

### Rust `notify` crate (Option A — rejected)

Rejected for the reasons in the Context section: requires adding `tokio` + `notify` to
`src-tauri/Cargo.toml`, requires manual FSEvents atomic-write coalescing, requires a new
Rust ↔ sidecar coordination protocol, and extends the Rust core beyond its established
responsibility boundary (ADR-002). Reconsider if benchmarks show the sidecar path adds
unacceptable per-event latency at high event volume (>1000 events/sec sustained) — but this
threshold is not anticipated for the `~/.claude/` tree at typical usage.

### `followSymlinks: false` — REJECTED

Silently breaks on any symlinked watch root with zero diagnostics. Discovered 2026-05-16
(CR-5). PAI/chezmoi/yadm/stow dotfile managers and corporate shared-config setups routinely
symlink the watched roots (`~/.claude/skills`, `~/.claude/agents`, etc.). With
`followSymlinks: false`, chokidar registers the symlink entry in the parent directory but
never walks the subtree, so no child events fire. The bug is silent — no error, no warning,
no diagnostic — making it extremely difficult to diagnose without reading chokidar internals.

### Bun's native `watch` API

Bun exposes `fs.watch()` (wraps FSEvents on macOS). It is less battle-tested than chokidar
for production-level recursive watching, has no `.add()` / `.unwatch()` API for dynamic root
management, and does not handle the atomic-write coalescing that chokidar's FSEvents binding
provides. Rejected in favor of chokidar.

## Relationship to Prior ADRs

- **ADR-001** (Bundle Identifier): Orthogonal. No bundle-ID impact.
- **ADR-002** (Tauri 2.x Capability Model): This decision explicitly preserves ADR-002 —
  the Tauri capability model governs only Tauri-side commands. The sidecar watcher bypasses
  Tauri's FS capability gating by design (it reads directly via Node.js `fs`). ADR-002 still
  governs `tauri-plugin-fs` calls from the UI layer.
- **ADR-003** (Tauri 2.x Runtime Scope): ADR-003's invariant that Tauri commands need runtime
  scope coverage for per-project paths is unchanged. Story 3.7 (FB-015) adds the
  `fs_scope().allow_directory()` call for Tauri commands. This ADR governs only the sidecar
  watcher, which does not use Tauri's FS scope.
- **ADR-004** (Design System Architecture): Orthogonal.
- **ADR-006** (Visual Coverage Posture): Orthogonal.
