# ZoePlane Feature Modules (`src/features/`)

Feature modules live here. Each module is a self-contained slice of ZoePlane's
product surface, containing its own components, hooks, services, and store slices.

## Module structure

```
features/
  <feature-name>/
    components/     — feature-specific React components (not design-system primitives)
    hooks/          — feature-specific hooks
    services/       — Tauri IPC callers, data fetchers
    store/          — Zustand slice for this feature's state
    index.ts        — public barrel export
```

## Planned feature modules (by epic)

| Module | Epic | Sprint |
|--------|------|--------|
| `skills/` | Epic 06 | 3–4 |
| `agents/` | Epic 06 | 3–4 |
| `commands/` | Epic 06 | 4 |
| `task-console/` | Epic 07 | 5 |
| `teams/` | Epic 08 | 6 |
| `workflows/` | Epic 08 | 6 |
| `hooks-resource/` | Epic 09 | 8.5 |
| `settings/` | Epic 10 | 7–10 |
| `onboarding/` | Epic 11 | 9 |
| `plugin-host/` | Epic 04 | 7 |

## Rules

- Feature components may import from `src/components/ui/` (design-system primitives).
- Feature components MUST NOT import from other feature modules directly —
  cross-feature communication goes through Zustand stores or Tauri IPC events.
- Feature-specific state slices are combined in `src/stores/index.ts`.
