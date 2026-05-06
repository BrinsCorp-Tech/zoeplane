# ZoePlane Custom Hooks (`src/hooks/`)

Global React hooks that are not feature-specific live here. Feature-specific hooks
belong in `src/features/<feature>/hooks/`.

## Planned global hooks

| Hook | Epic | Purpose |
|------|------|---------|
| `useTheme()` | Epic 02 | Read/write `[data-theme]` attribute; persist to user_preferences.theme |
| `useCommandPalette()` | Epic 02 | Open/close Cmd-K palette; register actions |
| `useTauriCommand<T>()` | Epic 01 | Typed wrapper around Tauri `invoke()` |
| `useFileWatcher()` | Epic 03 | Subscribe to FS watcher events from sidecar |
| `useStreamingTask()` | Epic 07 | Subscribe to task event stream |
| `usePlugin()` | Epic 04 | Access plugin runtime host from within plugin extension points |

## Hook conventions

- All hooks must be TypeScript strict-mode compatible (no `any`).
- Hooks that call Tauri IPC must handle loading, error, and success states.
- Hooks that set up subscriptions (FS watcher, streaming) must clean up in the
  useEffect return function.
- No hook may branch on theme (`data-theme === 'dark'`). Theme is CSS-only per Principle 5.
