/**
 * @zoeplane/plugin-sdk — Public extension contract for ZoePlane plugins
 *
 * Apache 2.0. This SDK is the public API surface between ZoePlane (the host)
 * and third-party plugins (including BrinsCorp's own Zoe-Mem).
 *
 * STABILITY NOTE: This SDK is at version 0.1.0 — pre-stable. APIs marked
 * @experimental may change before 1.0. APIs marked @stable are committed to
 * semver backwards compatibility from their first stable release.
 *
 * @see docs/architecture/PRD.md §7 (Plugin SDK contract)
 * @see packages/plugin-sdk/README.md (plugin author cookbook)
 */

// ============================================================
// Extension Points
// ============================================================

/**
 * The complete set of extension points a plugin can declare.
 * Plugins declare which points they use in their manifest; undeclared
 * points are not accessible even if the plugin calls them.
 *
 * @experimental — full spec in Epic 04
 *
 * @see PRD §4.2
 */
export interface PluginExtensionPoints {
  /** Contribute a nav item to ZoePlane's sidebar navigation */
  navigation?: NavigationExtension;
  /** Contribute a full-screen view reachable via the nav item */
  view?: ViewExtension;
  /** Subscribe to the active task's run stream (read-only) */
  runStreamObserver?: RunStreamObserverExtension;
  /** Enrich skill/agent/team/workflow detail views with additional panels */
  resourceEnricher?: ResourceEnricherExtension;
  /** Contribute a settings panel under Settings → [Plugin Name] */
  settingsPanel?: SettingsPanelExtension;
}

/** @experimental */
export interface NavigationExtension {
  id: string;
  label: string;
  icon: string; // SVG string or named icon from host icon set
  position: "primary" | "secondary" | "bottom";
}

/** @experimental */
export interface ViewExtension {
  navigationId: string; // must match a declared NavigationExtension.id
  component: string;    // URL of the plugin iframe entry point
}

/** @experimental */
export interface RunStreamObserverExtension {
  // Plugin receives read-only copies of structured run events.
  // Plugins CANNOT write to the run stream or modify task state.
  onEvent?: string; // name of the plugin's exported handler function
}

/** @experimental */
export interface ResourceEnricherExtension {
  resourceKind: ("skill" | "agent" | "command" | "team" | "workflow" | "hook")[];
  component: string; // URL of the enricher panel iframe
}

/** @experimental */
export interface SettingsPanelExtension {
  component: string; // URL of the settings panel iframe
}

// ============================================================
// Plugin Manifest
// ============================================================

/**
 * The plugin manifest declares identity, capabilities, and extension points.
 * Bundled as `manifest.json` at the root of a `.zoeplugin` archive.
 *
 * @experimental — full schema in Epic 04
 */
export interface PluginManifest {
  id: string;              // Reverse-DNS: com.example.my-plugin
  name: string;
  version: string;         // semver
  description: string;
  author: string;
  license: string;         // SPDX expression
  minHostVersion: string;  // minimum ZoePlane version required
  capabilities: PluginCapabilities;
  extensions: PluginExtensionPoints;
}

/**
 * Declared capabilities gate what the plugin host runtime permits.
 * Plugins cannot access capabilities not listed here.
 *
 * @experimental
 */
export interface PluginCapabilities {
  /** Read asset metadata (skill names, agent names, etc.) from the host index */
  readAssetIndex?: boolean;
  /** Subscribe to run stream events */
  observeRunStream?: boolean;
  /** Store data in the plugin's own scoped storage (NOT host SQLite) */
  pluginStorage?: boolean;
  /** Open OS URLs (for external links in settings panels) */
  openUrl?: boolean;
}

// ============================================================
// SDK Bootstrap (injected into plugin iframes by the host)
// ============================================================

/**
 * The ZoePlane host object available to plugins via `window.__zoeplaneHost`.
 * Injected by the plugin host runtime at iframe initialization.
 *
 * @experimental — typed stub; implemented in Epic 04
 *
 * @see PRD §7.1
 */
export interface ZoePlaneHostBridge {
  /** Current theme: "light" | "dark" */
  readonly theme: "light" | "dark";
  /** Plugin's declared capabilities (host-enforced) */
  readonly capabilities: PluginCapabilities;
  /** Subscribe to host events */
  on(event: HostEventType, handler: (data: unknown) => void): () => void;
  /** Call a host-provided API (capability-gated) */
  call(method: string, args?: unknown): Promise<unknown>;
}

/** @experimental */
export type HostEventType =
  | "THEME_CHANGE"
  | "ROUTE_CHANGE"
  | "RUN_EVENT"
  | "ASSET_INDEX_CHANGE";

// ============================================================
// TODO markers for Epic 04 implementation
// ============================================================

// TODO (Epic 04 Sprint 7): implement the Plugin SDK bootstrap helper
//   export { createPluginBootstrap } from "./bootstrap";
//
// TODO (Epic 04 Sprint 7): implement the typed RPC client
//   export { createHostClient } from "./client";
//
// TODO (Epic 04 Sprint 7): export token type definitions from Style Dictionary output
//   export type { ZoePlaneTokens } from "./tokens";
//
// TODO (Epic 04 Sprint 7): export the Plugin SDK React hooks (optional helper layer)
//   export { useHostTheme, useHostEvent } from "./react";
