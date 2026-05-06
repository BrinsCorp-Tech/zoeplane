# ZoePlane Zustand Stores (`src/stores/`)

Global application state via Zustand. Feature-specific store slices are authored
in `src/features/<feature>/store/` and combined here.

## Architecture

ZoePlane uses a **combined Zustand store** pattern: each feature slice exports its
store creator, and the root store combines them via `zustand/middleware` slices.

```typescript
// Conceptual shape (implemented in Sprint 2)
interface ZoePlaneStore {
  // Layout
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  activeRoute: RouteId;

  // Theme
  theme: 'system' | 'light' | 'dark';
  setTheme: (theme: 'system' | 'light' | 'dark') => void;

  // Command palette
  commandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  // Feature slices (added by each epic)
  // skills: SkillsSlice;   — Epic 06
  // tasks: TasksSlice;     — Epic 07
  // hooks: HooksSlice;     — Epic 09
}
```

## Store conventions

- Use Zustand with Immer middleware for nested state mutations.
- Persist only lightweight preferences to `localStorage` (or SQLite via Tauri IPC).
  - DO persist: theme, sidebarCollapsed, inspectorOpen, per-library view-mode (v1.x)
  - DO NOT persist: task streams, file watcher state, evaluator results (derived from disk)
- Never persist Claude session telemetry — SQLite holds derived state only.
- Selectors must be stable (use `useShallow` or selector memoization) to avoid
  unnecessary re-renders in streaming surfaces.

## Planned store slices

| Slice | Epic | Sprint |
|-------|------|--------|
| `layout` | Epic 02 | 2 |
| `theme` | Epic 02 | 1 |
| `commandPalette` | Epic 02 | 2 |
| `skills` | Epic 06 | 3 |
| `agents` | Epic 06 | 3 |
| `tasks` | Epic 07 | 5 |
| `hooks` | Epic 09 | 8.5 |
| `plugins` | Epic 04 | 7 |
