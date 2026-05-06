# Plugin Host (`sidecar/src/plugin-host/`)

The plugin host runtime loads, sandboxes, and manages ZoePlane plugins.
Epic 04, Sprint 7.

## Architecture

Plugins are distributed as signed bundles (`.zoeplugin` archives). The host:
1. Verifies the bundle signature against the plugin author's public key.
2. Extracts and sandboxes the plugin in an iframe (via the Tauri WebView).
3. Injects the Plugin SDK bootstrap (token stylesheet + IPC channel).
4. Routes plugin SDK calls through the capability-gated host sandbox.

## Sandbox rules (from PRD §7.2)

- Plugins CANNOT write to `settings.json` (hook installation is user-driven only).
- Plugins CANNOT access raw filesystem beyond declared paths in their manifest.
- Plugins CAN subscribe to run stream events via `run.streamObserver` (read-only).
- Plugins CAN contribute nav items, views, and run-stream annotations via declared extension points.

## TODO (Epic 04, Sprint 7)

Implement:
- `loader.ts` — plugin bundle verifier + extractor
- `sandbox.ts` — iframe sandbox lifecycle + Plugin SDK bootstrap injector
- `capability-gate.ts` — IPC interceptor that enforces declared capabilities
- `registry.ts` — in-memory plugin registry (loaded plugins + their extension points)
