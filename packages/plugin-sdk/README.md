# @zoeplane/plugin-sdk

**Apache 2.0. The public plugin contract for ZoePlane.**

ZoePlane is the OSS cockpit and plugin host for Claude-Code-native teams. This SDK
defines the extension points, capability model, and communication contract that
third-party plugins (including BrinsCorp's own Zoe-Mem) use to extend ZoePlane.

> This SDK is at v0.1.0 — pre-stable. APIs marked `@experimental` may change before
> the 1.0 stable release. We commit to semver backwards compatibility from 1.0 onward.

## What plugins can do

| Extension point | What it enables |
|----------------|-----------------|
| `navigation` | Add a nav item to ZoePlane's sidebar |
| `view` | Contribute a full-screen view (rendered in a sandboxed iframe) |
| `runStreamObserver` | Subscribe to task run events (read-only) |
| `resourceEnricher` | Add panels to skill/agent/hook/team detail views |
| `settingsPanel` | Add a settings page under Settings → [Plugin Name] |

## What plugins cannot do

- Write to `~/.claude/settings.json` (hooks are user-authored only)
- Access raw filesystem beyond declared paths
- Modify task state or inject into agent runs
- Use host semantic tokens for new colors not in the host's token layer
- Bypass the capability gate

## Getting started (Epic 04 — implementation pending)

```typescript
// manifest.json (in your .zoeplugin bundle)
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "minHostVersion": "0.1.0",
  "capabilities": { "observeRunStream": true },
  "extensions": {
    "navigation": {
      "id": "my-view",
      "label": "My View",
      "icon": "...",
      "position": "secondary"
    }
  }
}
```

See the sample plugin in `packages/plugin-sdk/examples/` (added Sprint 7 / Epic 04).

## Token inheritance

Plugins automatically receive the host's design tokens (both light and dark) via the
SDK bootstrap. Consume `var(--color-background)`, `var(--color-foreground)`, etc.
inside your iframe — they stay in sync with the host theme.

**Do NOT use `prefers-color-scheme` directly.** Listen to the `THEME_CHANGE` host event
via `window.__zoeplaneHost.on("THEME_CHANGE", handler)`.

## Repository

`github.com/BrinsCorp-Tech/zoeplane` (Apache 2.0)
