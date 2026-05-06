# FS Watchers & Asset Indexer (`sidecar/src/indexer/`)

The indexer watches `~/.claude/` (and project-scoped `.claude/` directories) for
file changes and maintains the in-memory + SQLite asset index.

Epic 03, Sprint 2.

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

## TODO (Epic 03, Sprint 2)

Implement:
- `watcher.ts` — FS watcher (cross-platform: chokidar or Bun's native watch API)
- `scanner.ts` — cold-launch full directory scan
- `parsers/skill.ts`, `parsers/agent.ts`, etc. — per-resource YAML/Markdown parsers
- `parsers/hook.ts` — settings.json hook entry parser + normalizer
- `asset-index.ts` — in-memory index with SQLite persistence
