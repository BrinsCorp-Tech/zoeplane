# Plugin SDK Reference — ZoePlane

## Stability Notice

`@zoeplane/plugin-sdk` is at version `0.0.1`. This is a **typed stub** — all interfaces are defined and exported, but the runtime implementation (plugin host, iframe injection, capability enforcement) ships in Epic 04. APIs marked `@experimental` in the source may change before 1.0. No APIs are yet marked `@stable`.

Plugin authors who integrate against this SDK should pin to an exact version and expect breaking changes until 1.0.

Source: `packages/plugin-sdk/src/index.ts`.

## What a Plugin Can Do

A ZoePlane plugin is a signed `.zoeplugin` archive with a `manifest.json` at its root. Plugins are loaded by the ZoePlane host (Epic 04) and rendered as sandboxed iframes. The extension points a plugin may use are declared in its manifest under `extensions`.

Available extension points (`PluginExtensionPoints`):

| Extension | Interface | Description |
|---|---|---|
| `navigation` | `NavigationExtension` | Contribute a nav item to ZoePlane's sidebar (primary, secondary, or bottom position) |
| `view` | `ViewExtension` | Contribute a full-screen view linked to a declared nav item |
| `runStreamObserver` | `RunStreamObserverExtension` | Subscribe to the active task's run stream (read-only) |
| `resourceEnricher` | `ResourceEnricherExtension` | Enrich skill/agent/command/team/workflow/hook detail views with additional panels |
| `settingsPanel` | `SettingsPanelExtension` | Contribute a settings panel under Settings → [Plugin Name] |

All extension types are `@experimental`.

## What a Plugin Cannot Do

These constraints are architectural, not configurable. They cannot be overridden by any manifest declaration or capability flag.

- **Cannot install lifecycle hooks.** Hooks are user-authored only. The Tauri IPC command set registered in `src-tauri/src/lib.rs:82-91` does not include hook-write or settings-write commands. See `SECURITY.md` and `CONTRIBUTING.md`.
- **Cannot write `settings.json`.** Plugins have no IPC path to the user's Claude Code settings.
- **Cannot access capabilities not declared in their manifest.** The plugin host runtime (Epic 04) enforces declared `PluginCapabilities`; undeclared capabilities are denied even if the plugin iframe attempts to call them.
- **Cannot write to host SQLite.** Plugins may use `pluginStorage` (their own scoped storage, declared as a capability) but cannot access the host's `zoeplane.db` tables.
- **Cannot access the filesystem directly.** Plugin iframes run sandboxed and have no direct Tauri IPC access to `fs_read_file` or other FS commands.
- **Cannot observe run streams without declaring `observeRunStream` in their manifest capabilities.** And when permitted, the stream is read-only — plugins cannot modify task state.

For the full security model, see `docs/SECURITY.md`.

## Plugin Lifecycle

The full lifecycle is Epic 04 territory. The manifest types that govern it are established in Sprint 1:

1. **Install** — operator drops a signed `.zoeplugin` archive into ZoePlane's plugin directory. The host runtime verifies the bundle signature.
2. **Activate** — ZoePlane reads `manifest.json`, checks `minHostVersion` against the running ZoePlane version, and registers declared extension points.
3. **Runtime** — the host injects `window.__zoeplaneHost` (a `ZoePlaneHostBridge`) into the plugin iframe at initialization. The plugin calls `window.__zoeplaneHost.on()` to subscribe to events and `window.__zoeplaneHost.call()` to invoke capability-gated host APIs.
4. **Deactivate** — the host tears down the iframe and unregisters extension points.
5. **Uninstall** — operator removes the plugin; the host cleans up plugin storage if `pluginStorage` was declared.

Source: `packages/plugin-sdk/src/index.ts:81-93`.

## SDK API Reference

All types below are exported from `@zoeplane/plugin-sdk` (entry point: `packages/plugin-sdk/src/index.ts`).

### `PluginManifest`

The root manifest type. Bundle as `manifest.json` at the root of a `.zoeplugin` archive.

```typescript
interface PluginManifest {
  id: string;              // Reverse-DNS: e.g., "com.example.my-plugin"
  name: string;
  version: string;         // semver
  description: string;
  author: string;
  license: string;         // SPDX expression
  minHostVersion: string;  // minimum ZoePlane version required (semver)
  capabilities: PluginCapabilities;
  extensions: PluginExtensionPoints;
}
```

### `PluginCapabilities`

Declared capabilities gate what the plugin host runtime permits. Undeclared capabilities are denied.

```typescript
interface PluginCapabilities {
  readAssetIndex?: boolean;    // Read skill/agent/team metadata from host index
  observeRunStream?: boolean;  // Subscribe to run stream events (read-only)
  pluginStorage?: boolean;     // Store data in plugin's own scoped storage
  openUrl?: boolean;           // Open OS URLs from settings panels
}
```

### `PluginExtensionPoints`

```typescript
interface PluginExtensionPoints {
  navigation?: NavigationExtension;
  view?: ViewExtension;
  runStreamObserver?: RunStreamObserverExtension;
  resourceEnricher?: ResourceEnricherExtension;
  settingsPanel?: SettingsPanelExtension;
}
```

### `NavigationExtension`

```typescript
interface NavigationExtension {
  id: string;
  label: string;
  icon: string;                              // SVG string or named icon from host icon set
  position: "primary" | "secondary" | "bottom";
}
```

### `ViewExtension`

```typescript
interface ViewExtension {
  navigationId: string;  // Must match a declared NavigationExtension.id
  component: string;     // URL of the plugin iframe entry point
}
```

### `RunStreamObserverExtension`

Plugins receive read-only copies of structured run events. Plugins cannot write to the run stream or modify task state.

```typescript
interface RunStreamObserverExtension {
  onEvent?: string;  // Name of the plugin's exported handler function
}
```

### `ResourceEnricherExtension`

```typescript
interface ResourceEnricherExtension {
  resourceKind: ("skill" | "agent" | "command" | "team" | "workflow" | "hook")[];
  component: string;  // URL of the enricher panel iframe
}
```

### `SettingsPanelExtension`

```typescript
interface SettingsPanelExtension {
  component: string;  // URL of the settings panel iframe
}
```

### `ZoePlaneHostBridge`

Injected into plugin iframes by the host runtime at initialization as `window.__zoeplaneHost`. The typed stub is defined in Sprint 1; the runtime implementation ships in Epic 04.

```typescript
interface ZoePlaneHostBridge {
  readonly theme: "light" | "dark";
  readonly capabilities: PluginCapabilities;    // Plugin's declared capabilities
  on(event: HostEventType, handler: (data: unknown) => void): () => void;
  call(method: string, args?: unknown): Promise<unknown>;
}

type HostEventType =
  | "THEME_CHANGE"
  | "ROUTE_CHANGE"
  | "RUN_EVENT"
  | "ASSET_INDEX_CHANGE";
```

`on()` returns an unsubscribe function. Call it to stop receiving events.

`call()` is capability-gated: the host enforces the plugin's declared `PluginCapabilities` on every call. Attempting to call a method that requires an undeclared capability throws an error.

## Distribution

Plugin distribution mechanics are Epic 04 scope. The following is the design intent from the SDK types:

- Plugins are distributed as signed `.zoeplugin` archives.
- The `manifest.json` `id` field follows reverse-DNS convention (e.g., `com.brinscorp.zoe-mem`).
- `minHostVersion` gates compatibility: ZoePlane will refuse to load a plugin whose `minHostVersion` is greater than the installed ZoePlane version.
- ZoePlane itself is Apache 2.0; plugin license is declared in `manifest.json` `license` field (SPDX) and is not constrained by ZoePlane's license.

TBD: plugin registry, signing key requirements, and `.zoeplugin` archive format — pending Epic 04 architecture design.

## Installing the SDK (for plugin authors)

```bash
npm install @zoeplane/plugin-sdk
# or
bun add @zoeplane/plugin-sdk
```

TBD: `@zoeplane/plugin-sdk@0.0.1` is not yet published to npm. The `@zoeplane` npm scope registration is pending operator action as of Sprint 1. It will be published at the first tagged release.

---

*Last reviewed: 2026-05-09 by tech-writer agent against Sprint 1.*
