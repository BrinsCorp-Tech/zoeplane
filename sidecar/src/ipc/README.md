# Sidecar IPC (`sidecar/src/ipc/`)

Tauri IPC contract types and handler stubs for sidecar ↔ Tauri shell communication.

## Contract

The sidecar communicates with the Tauri Rust shell via a transport to be decided in Epic 01.
The shared types live in `packages/shared-types/src/ipc.ts`.

## Planned handler modules

| File | Epic | Commands |
|------|------|---------|
| `server.ts` | Epic 01 | Start/stop IPC server, health check |
| `indexer.ts` | Epic 03 | read_dir_recursive, watch_path, stop_watch |
| `evaluator.ts` | Epic 05 | run_evaluator, get_evaluator_result |
| `task.ts` | Epic 07 | spawn_task, stream_task_events, cancel_task |
| `hooks.ts` | Epic 09 | read_hooks, write_hook, delete_hook |
| `plugin.ts` | Epic 04 | load_plugin, unload_plugin, list_plugins |

## TODO (Epic 01)

Implement `server.ts` with the chosen IPC transport (stdout/stdin JSON-RPC or Unix socket).
All other handler modules stub out until their respective epics.
