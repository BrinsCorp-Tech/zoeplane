# FS Watchers & Asset Indexer (`sidecar/src/indexer/`)

The indexer watches `~/.claude/` (and project-scoped `.claude/` directories) for
file changes and maintains the in-memory + SQLite asset index.

Epic 03, Sprint 3.

## What it indexes

Per PRD §1.9 resource taxonomy:

- Skills: `~/.claude/skills/<name>/SKILL.md`
- Agents: `~/.claude/agents/<name>.md`
- Commands: `~/.claude/commands/<name>.md`
- Teams: `~/.claude/teams/<name>.md`
- Workflows: `~/.claude/workflows/<name>.md`
- Hooks: entries within `~/.claude/settings.json` and project `settings.json` files

## Key properties

- **File-native:** the SQLite index is DERIVED from disk. If deleted, it rebuilds from `~/.claude/` on next startup (per PRD §1.1 Principle 1 and ux-spec Principle 1).
- **External-change detection:** when a file changes while ZoePlane is open, the FS watcher fires and the indexer re-parses the file. The UI surfaces an "external change" indicator (per ux-spec §7 DiffViewer pattern).
- **Cold-launch sequence:** on startup, the indexer does a full directory scan before the UI renders Library views. Loading state is C2 (skeleton) per loading-architecture.md.

## Implemented (Story 3.2)

- `watcher.ts` — FS watcher service. Single chokidar v5 FSWatcher instance with
  multiple watch roots (ADR-005: single-watcher-multiple-roots pattern). Provides:
  - `startGlobalWatcher()` — registers `~/.claude/{skills,agents,commands,teams,workflows,settings.json}` at startup.
  - `startProjectWatcher(projectRoot)` — adds `<projectRoot>/.claude/` on `project:open`.
  - `stopProjectWatcher(projectRoot)` — removes the project root on `project:close`.
  - `stopWatcher()` — graceful async shutdown (cancels timers, calls chokidar.close()).
  - `subscribeToWatcherEvents(callback)` — event bus for the SSE endpoint in `index.ts`.
  - 250 ms coalescing window per-path (FR-077) via a `Map<path, setTimeout>` debounce table.
  - Emits `AssetIndexUpdatedEvent`, `WatcherStartedEvent`, `WatcherErrorEvent`
    (types defined in `packages/shared-types/src/watcher.ts`).
  - IPC: events fan out over the `GET /events` SSE endpoint added to `sidecar/src/index.ts`.
  - Watcher-root gating satisfied by chokidar design (FR-033) + defensive debug log.

## TODO (Epic 03, Sprint 3+)

- `scanner.ts` — cold-launch full directory scan (Story 3.3)
- `parsers/skill.ts`, `parsers/agent.ts`, etc. — per-resource YAML/Markdown parsers (Story 3.5)
- `parsers/hook.ts` — settings.json hook entry parser + normalizer (Story 3.6)
- `asset-index.ts` — in-memory index with SQLite persistence (Story 3.3)
