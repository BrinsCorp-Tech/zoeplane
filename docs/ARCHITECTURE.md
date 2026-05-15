# Architecture — ZoePlane

## Overview

ZoePlane is a desktop application that wraps the `claude` and `codex` CLIs into a structured, file-native, keyboard-first cockpit for Claude-Code-native teams. It is a Tauri 2.0 application (Rust shell + WebView UI) combined with a Node.js sidecar process and a public Plugin SDK. The source of truth for all user data is `~/.claude/`; SQLite holds derived state only and is never the primary store.

The project is Apache 2.0 OSS steered by BrinsCorp-Tech. Proprietary capabilities (e.g., Zoe-Mem) ship as separately signed plugin bundles and are not part of this repository.

## Component Map

```
ZoePlane/
├── src/                        React UI (Vite-bundled, served in Tauri WebView)
│   ├── main.tsx                Entry point; ThemeProvider + QueryClientProvider tree
│   ├── App.tsx                 Root component; mounts HostShell
│   ├── components/
│   │   ├── theme/
│   │   │   └── ThemeProvider.tsx   Theme preference manager + useTheme() hook
│   │   ├── ui/                 Foundation tier (16 P0 components)
│   │   │   ├── Button/         Button.tsx + variants (cva), stories, a11y tests
│   │   │   ├── Card/           Card, CardHeader, CardContent, CardFooter
│   │   │   ├── Badge/          Badge (7 semantic variants)
│   │   │   ├── Input/          Input (text/email/search)
│   │   │   ├── Icon/           Icon (Lucide wrapper, size system)
│   │   │   ├── Modal/          Modal (Radix Dialog wrapper)
│   │   │   ├── Toast/          Toast + Toaster (Radix Toast)
│   │   │   ├── Tooltip/        Tooltip (Radix Tooltip)
│   │   │   ├── Dropdown/       Dropdown (Radix DropdownMenu)
│   │   │   ├── FormField/      FormField (label+input grouper, groupRole)
│   │   │   ├── Select/         Select (Radix Select)
│   │   │   ├── Checkbox/       Checkbox (Radix Checkbox)
│   │   │   ├── Radio/          Radio (Radix RadioGroup)
│   │   │   ├── Tabs/           Tabs (Radix Tabs)
│   │   │   ├── Skeleton/       Skeleton + CardSkeleton/RouteSkeleton/StreamSkeleton
│   │   │   ├── Spinner/        Spinner (4 sizes)
│   │   │   ├── EvaluatorStatusBadge/  Status badge (16-state matrix)
│   │   │   └── index.ts        Single-tier barrel export
│   │   ├── layout/             Layout tier (9 P0 regions)
│   │   │   ├── HostShell/      HostShell.tsx — CSS Grid compositor (composition root)
│   │   │   ├── Sidebar/        Sidebar (role="navigation", CollapsiblePane)
│   │   │   ├── Inspector/      Inspector (role="complementary", CollapsiblePane)
│   │   │   ├── TitleBar/       TitleBar (role="banner", drag-region, macOS traffic lights)
│   │   │   ├── StatusBar/      StatusBar (role="contentinfo", sidecar health poll)
│   │   │   ├── TabStrip/       TabStrip (Zustand-managed tabs)
│   │   │   ├── PrimaryWorkArea/ PrimaryWorkArea (flex: 1, scrollable content host)
│   │   │   ├── CommandPalette/ CommandPalette (Cmd+K palette, Radix Dialog portal)
│   │   │   ├── NotificationsCenter/ NotificationsCenter (right-edge dialog portal)
│   │   │   └── CollapsiblePane/ Cross-cutting collapse primitive (used by Sidebar + Inspector)
│   │   └── library-shell/
│   │       └── LibraryShell.tsx  Cross-library card-grid primitive
│   ├── stores/
│   │   ├── app.ts              Zustand: shell readiness + projectRoot + TabStrip slices
│   │   ├── notifications.ts    Zustand: notification queue
│   │   └── commandPalette.ts   Zustand: palette open/closed state + query
│   ├── styles/
│   │   ├── tokens.css          GENERATED — Style Dictionary v4 output (gitignored)
│   │   ├── globals.css         Global reset, Tailwind directives, reduced-motion nuclear block
│   │   └── animations.css      Animation catalog A-01..A-41 (41 keyframe/transition classes)
│   └── test/
│       ├── contrast-harness.a11y.test.ts   WCAG 2.2 AA contrast harness (culori engine)
│       ├── fixtures/semantic-token-pairs.ts Token pair fixtures (26 pairs × 2 themes)
│       └── helpers/runAxe.ts   Canonical axe-core runner + formatViolations
├── src-tauri/                  Tauri Rust shell
│   ├── src/main.rs             Thin binary entry — calls lib.rs::run()
│   ├── src/lib.rs              App setup: tracing, sidecar lifecycle, plugin init
│   ├── src/ipc.rs              Tauri commands: ping, sidecar_status
│   ├── src/commands/
│   │   └── fs.rs               FS allowlist-violation logger (FB-016)
│   ├── capabilities/default.json  Tauri 2.x capability grants (ADR-002)
│   └── tauri.conf.json         Bundle identifier, window config, plugin config
├── sidecar/                    Node.js sidecar (bun-compiled single-binary)
│   ├── src/index.ts            HTTP loopback server + DB init + signal handlers
│   ├── src/log.ts              Structured JSON stderr logger
│   └── src/db/
│       ├── runner.ts           SQLite migration runner
│       └── migrations/         Ordered .sql migration files
├── packages/
│   ├── plugin-sdk/             @zoeplane/plugin-sdk (Apache 2.0, published to npm)
│   ├── shared-types/           @zoeplane/shared-types (private monorepo package)
│   └── design-tokens/          DTCG JSON → Style Dictionary v4 pipeline
│       ├── src/tokens.seed.json    DTCG W3C v1 primitive + motion token source
│       └── style-dictionary.config.mjs  Custom zoeplaneTokensCSS formatter
└── .storybook/
    ├── main.ts                 Storybook 8 configuration
    └── preview.ts              Global decorators: theme toggle + reduced-motion toggle
```

## Component Responsibilities

**Tauri Rust shell (`src-tauri/`)** owns the OS layer. It spawns and supervises the sidecar process, registers the `zoeplane://` deep-link URL scheme with the host OS, enforces the filesystem allowlist on all file operations, manages the application window, and bridges the React UI to sidecar services via typed Tauri IPC commands. It never delegates OS-level operations to JavaScript. The Tauri shell is the sole process that speaks to the OS; the React UI and sidecar speak only to the Tauri shell.

**Node.js sidecar (`sidecar/`)** is a bun-compiled single-binary process that the Tauri shell spawns at startup. It hosts an HTTP loopback server on `127.0.0.1` at a kernel-assigned ephemeral port, runs the SQLite migration runner, and announces its port to the Tauri shell via a single-line JSON on stdout (`{"port": N}`). Future epics extend it to host Path A (Direct Claude SDK calls), Path B (CLI harness wrapping `claude` and `codex`), the Skill Safety Evaluator, and the FS watcher/asset indexer. The sidecar writes structured JSON to stderr; the Tauri shell forwards these lines to its own tracing output.

**React UI (`src/`)** is a Vite-bundled React 18 / TypeScript / Tailwind v4 application rendered in Tauri's WebView. The UI communicates exclusively with the Tauri shell via `invoke()` — it never makes direct HTTP calls to the sidecar or raw filesystem calls. Sprint 2 delivered the complete design system layer: design tokens pipeline, 16 foundation components, 9 layout regions, the HostShell composition root, and Zustand state stores.

**Design system layer** consists of three integrated subsystems introduced in Sprint 2 per **ADR-004**:

- _Design tokens pipeline_ (`packages/design-tokens/`) — converts `tokens.seed.json` (DTCG W3C v1) into `src/styles/tokens.css` via Style Dictionary v4 using a custom `zoeplaneTokensCSS` formatter. The output file is a gitignored build artifact; it is regenerated by `bun run tokens:build` and validated by the `design-tokens-check` CI job.
- _Component library_ (`src/components/ui/` and `src/components/layout/`) — 16 foundation-tier and 9 layout-tier components, all consuming semantic tokens exclusively via CSS custom properties. No hardcoded hex values are present in any component. All 25 components have Storybook stories and per-component axe-core structural accessibility tests.
- _Animation library_ (`src/styles/animations.css`) — 41 named animation classes (A-01..A-41) consuming motion tokens (`--motion-duration-*`, `--motion-easing-*`). Each class with an infinite loop carries an explicit `animation: none` override in the `.prefers-reduced-motion` class block. The `animations-reduced-motion.a11y.test.tsx` guard test enforces this invariant.

**ThemeProvider (`src/components/theme/ThemeProvider.tsx`)** manages theme preference (`light` | `dark` | `system`) with FOUC prevention (inline `<script>` in `index.html` runs before React mount), `localStorage` persistence under the key `zoeplane:theme`, OS `matchMedia` subscription for `system` preference, and `useLayoutEffect`-based `data-theme` attribute writes. Components never read the theme value or branch their JSX on it — all theming is expressed as CSS custom property resolution under `[data-theme="dark"]` on `<html>`.

**HostShell (`src/components/layout/HostShell/HostShell.tsx`)** is the composition root for the six UX-spec §6.1 layout regions, arranged as a CSS Grid (`"title title title" / "sidebar content inspector" / "status status status"`, column widths: `240px 1fr 320px`). CommandPalette and NotificationsCenter mount as portal siblings outside the grid to avoid layout flow impact. HostShell replaces the Sprint 1 `PageLayout.tsx` / `SectionLayout.tsx` scaffold.

**Zustand stores (`src/stores/`)** manage global UI state. `app.ts` holds shell readiness, `projectRoot`, and TabStrip state. `notifications.ts` holds the notification queue. `commandPalette.ts` holds palette open/closed state and query text. In `DEV` mode these stores are exposed on `window` (`useAppStore`, `useCommandPaletteStore`, `useNotificationsStore`) via `Object.assign` guarded by `import.meta.env.DEV` — this code is tree-shaken from production builds.

**Plugin SDK (`packages/plugin-sdk/`)** is the public extension contract for third-party ZoePlane plugins. It is published to npm as `@zoeplane/plugin-sdk`. The SDK defines the types for plugin manifests, declared capabilities, and extension points (navigation, views, run-stream observers, resource enrichers, settings panels). The runtime implementation ships in Epic 04; the package is a typed stub establishing the public API surface.

**Shared types (`packages/shared-types/`)** is a private monorepo package (`@zoeplane/shared-types`) containing TypeScript types shared between the React UI and the sidecar — resource taxonomies, IPC message envelopes, run event shapes, user preference types, and the `project-open` event shape (added Sprint 2).

## Design System Architecture

ZoePlane's design system follows a DTCG W3C v1 three-tier cascade locked by **ADR-004**:

```
Layer 1 — Primitives (tokens.base)
  OKLCH color ramps: gray-50..gray-975, accent-50..accent-800,
  success/warn/danger/info/quarantine (400/500/600),
  event-family hues (tool/session/prompt/compact × 500/muted/muted-dark)
  Source: packages/design-tokens/src/tokens.seed.json
  Output: @layer tokens.base { :root { --gray-50: oklch(...); ... } }

        ↓ referenced by semantic layer only

Layer 2 — Semantic (tokens.semantic)  ← only layer that branches on theme
  Light: :root, :root[data-theme="light"] { --color-background: var(--gray-50); ... }
  Dark:  :root[data-theme="dark"]         { --color-background: var(--gray-950); ... }
  Governs: surfaces, text, borders, brand/interactive, status, event-family tones,
           selection, hover overlays, code blocks, canvas, pane tints, scrollbars

        ↓ referenced by component layer only

Layer 3 — Component (tokens.component)  ← theme-invariant
  --button-primary-bg: var(--color-accent);
  --card-bg: var(--color-surface);
  --input-border: var(--color-border-strong);
  ... (expands each epic as components are built)
```

Additional theme-invariant layers: `tokens.typography` (fluid type scale via `clamp()`), `tokens.spacing` (4px base grid), `tokens.shape` (radii + elevation shadows), `tokens.motion` (duration fast/base/slow + easing standard/decelerate/accelerate), `tokens.layout` (breakpoints).

**No-theme-branch rule** (ADR-004 invariant): components must never read `[data-theme]` in JSX or apply conditional class logic based on light/dark mode. All variation is upstream in the semantic layer. The `no-theme-branch.test.ts` guard test (`src/components/__tests__/no-theme-branch.test.ts`) enforces this statically across the full component tree.

**Build pipeline**: `bun run tokens:build` → Style Dictionary v4 reads `packages/design-tokens/src/tokens.seed.json` → `zoeplaneTokensCSS` custom formatter writes `src/styles/tokens.css`. The pre-commit hook (`.husky/pre-commit`) blocks direct edits to `tokens.css`. The `design-tokens-check` CI job validates pipeline health (rebuild + non-empty assertion).

**WCAG 2.2 AA compliance**: The contrast harness (`src/test/contrast-harness.a11y.test.ts`) verifies 26 semantic token pairs × both themes using `culori v4` OKLCH-native math (4.5:1 body / 3.0:1 large text + non-text UI). See `docs/ACCESSIBILITY.md` for the full accessibility posture.

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

### Three-way Tauri 2.x scope model (ADR-003)

ADR-002 established the configuration/capability split. Manual smoke testing after Story 1.11 surfaced a third, distinct concept — the **plugin runtime scope state** — formalized in **ADR-003**. Every Tauri 2.x plugin has up to three independent scope layers:

1. **Plugin runtime configuration** — fields the plugin's `Config` struct deserializes from `tauri.conf.json plugins.<name>`. Examples: `plugins.deep-link.desktop.schemes`, `plugins.shell.open`. Read once at plugin init; never mutated at runtime.
2. **Capability permissions** — IPC-dispatch ACL entries in `capabilities/default.json`. Gate which commands the webview may invoke and, for scope-bearing entries (e.g., `fs:scope`), constrain argument values consumed by the plugin's built-in IPC handlers via Tauri's `GlobalScope<T>` extractor.
3. **Plugin runtime scope state** — an in-memory mutable object owned by the plugin, accessed via an extension trait (e.g., `app.fs_scope()` from `tauri_plugin_fs::FsExt`). Populated programmatically at app setup via `allow_directory` / `allow_file` calls, and dynamically by user actions (file picker, drag-drop). This is the scope queried by custom Rust IPC wrappers such as `commands/fs.rs::fs_*` via `is_allowed(...)`. Capability `fs:scope` entries do **not** populate it — the two are independent storage locations.

For `tauri-plugin-fs`, the runtime scope is initialized empty by the plugin and must be populated at app setup from `lib.rs::run().setup`. ZoePlane registers the three canonical allowlist paths (`$HOME/.claude/**`, `$APPDATA/com.brinscorp.zoeplane/**`, `$APP/**`) via `app.fs_scope().allow_directory(...)` at startup, resolving variable prefixes through `app.path()` to guarantee physical-path equivalence with the capability file's scope entries. See ADR-003 for the full rationale and the source-of-truth discipline between the capability file and the setup code.

### Adding a new plugin or capability

Future plugin additions follow the pattern established by ADR-002 and ADR-003:

1. Add the plugin crate to `src-tauri/Cargo.toml` and register it via `.plugin(tauri_plugin_<name>::init())` in `lib.rs`.
2. Add the required `<plugin>:allow-<method>` identifiers to `capabilities/default.json` (or a new per-feature capability file if window-scoped restriction is needed).
3. If the plugin requires instance configuration (allowlist scopes, URL schemes), add a `plugins.<name>` block to `tauri.conf.json` containing **only** configuration — never method permissions.
4. If the plugin uses sidecar or external-binary execution, add a `shell:allow-execute` entry to `capabilities/default.json` — never to `tauri.conf.json`.
5. If a custom Rust IPC command checks the plugin's runtime scope (e.g., `app.<plugin>_scope().is_allowed(...)`), populate that scope programmatically in the `.setup()` closure — capability file entries alone will not populate it (see ADR-003).

## Architectural Decisions

See `docs/architecture/decisions/README.md` for the full ADR index.

- **ADR-001** — Retains `com.brinscorp.zoeplane` as the permanent bundle identifier. Rationale: honest correspondence with the BrinsCorp-Tech signing trust root; changing after first release would require Apple notarization re-binding, Homebrew tap updates, winget renamespace, data migration, and deep-link re-registration.
- **ADR-002** — Adopts Tauri 2.x's capability model in full, with four invariants: single capability file at `src-tauri/capabilities/default.json` for Sprint 1; enumerate every permission (no blanket `<plugin>:default` where the surface exceeds need); sidecar grants live in `capabilities/default.json`, never in `tauri.conf.json`; hard separation between plugin configuration (`tauri.conf.json`) and plugin permissions (capability files). See section above and ADR-002 for full rationale. Note: invariant 4 is partially superseded by ADR-003.
- **ADR-003** — Formalizes the three-way Tauri 2.x scope model (plugin configuration / capability permissions / plugin runtime scope state) and mandates programmatic population of `app.fs_scope()` at app setup. Establishes that capability `fs:scope` entries do not populate the runtime scope, and that custom Rust IPC wrappers must use the runtime scope for defense-in-depth. See "Three-way Tauri 2.x scope model" section above.
- **ADR-004** — Design System Architecture. Locks five invariants: DTCG W3C v1 three-tier cascade (primitives → semantic → component); OKLCH primitive color space with HSL fallback as contingency only; Style Dictionary v4 as the sole token build tool; shadcn/ui as the component scaffold (not a dependency — copied-and-owned); Storybook 8 + Chromatic for visual regression in advisory mode until the Chromatic baseline is locked. Establishes the no-theme-branch-in-component rule (verified by guard test) and requires semantic equivalence proof for any migration between hand-authored and generated `tokens.css`. See "Design System Architecture" section above.

## Glossary

**Sidecar** — The bun-compiled Node.js binary that the Tauri shell spawns at startup. Named "sidecar" per Tauri's external binary embedding terminology (`externalBin` in `tauri.conf.json`). Responsible for all Claude API/CLI work and the FS indexer.

**FS allowlist** — The set of filesystem paths the Tauri app is permitted to access. In production: `$HOME/.claude/**`, `$APPDATA/com.brinscorp.zoeplane/**`, and `$APP/**`. Method-level permissions are granted in `src-tauri/capabilities/default.json`; path scope is enforced by both the capability ACL and the runtime `app.fs_scope()` state per ADR-003. All filesystem operations route through `commands/fs.rs` wrappers that enforce this allowlist and log violations.

**IPC** — Inter-process communication. ZoePlane uses two IPC layers: (1) Tauri commands (`invoke()`) between React UI and Rust shell, and (2) HTTP loopback on `127.0.0.1` between the Rust shell and the sidecar.

**Path A / Path B** — Two modes for invoking Claude. Path A: direct Anthropic SDK calls from the sidecar. Path B: shell harness wrapping the `claude` CLI. Both are sidecar-side; neither is implemented in Sprint 1 or Sprint 2.

**Plugin host** — The ZoePlane runtime that loads, sandboxes, and manages third-party `.zoeplugin` bundles. Plugin host runtime is Epic 04; `@zoeplane/plugin-sdk` 0.0.1 defines the typed contract.

**Bundle identifier** — The reverse-DNS string `com.brinscorp.zoeplane` used by Tauri to identify the app to the OS. Determines the app data directory path, the deep-link registration key, the macOS bundle ID, and the Windows AppUserModelID. See ADR-001.

**Semantic token** — A CSS custom property in Layer 2 (`tokens.semantic`) that maps a primitive color value to a named role (e.g., `--color-accent`, `--color-foreground-muted`). Components consume semantic tokens exclusively; consuming primitive tokens directly is a policy violation per ADR-004.

**DTCG** — Design Tokens Community Group. The W3C-adjacent specification (October 2025 draft) that defines the JSON format for design tokens used in `packages/design-tokens/src/tokens.seed.json`.

**HostShell** — The CSS Grid compositor at `src/components/layout/HostShell/HostShell.tsx` that arranges the six layout regions (TitleBar, Sidebar, Inspector, TabStrip, PrimaryWorkArea, StatusBar) into the full application chrome. It is the composition root for the Epic 02 UI layer.

---

_Last reviewed: 2026-05-15 by tech-writer agent against Sprint 2 (Stories 2.1–2.13, 2.22–2.26; ADR-004)._
