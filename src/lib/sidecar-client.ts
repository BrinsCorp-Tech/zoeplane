/**
 * sidecar-client — minimal HTTP loopback client for sidecar requests.
 *
 * The sidecar announces its bound port via the Tauri "sidecar-ready" event
 * (lib.rs: `app.emit("sidecar-ready", port)`). This module listens once,
 * stores the port, and provides `getSidecarBaseUrl()` for consumers.
 *
 * Architecture note: the React UI speaks directly to the sidecar HTTP loopback
 * for read-heavy Library queries (GET /assets, etc.). Write operations and
 * security-sensitive commands still route through Tauri IPC (src-tauri/ipc.rs).
 * This split keeps Library query latency low (~<5ms loopback vs. IPC overhead).
 *
 * Test / non-Tauri environments: when the Tauri API is unavailable (e.g., Storybook,
 * Vitest), the port falls back to the VITE_SIDECAR_PORT env var or 0.
 * Callers that rely on this function in tests should inject a base URL directly.
 *
 * Story: 6.2 — Agent Library
 */

let _sidecarPort: number | null = null;

// ---------------------------------------------------------------------------
// Subscriber pattern for useSyncExternalStore (Finding 1)
// ---------------------------------------------------------------------------

type SidecarListener = () => void;
const _listeners = new Set<SidecarListener>();

/**
 * Subscribe to sidecar port changes. Used with useSyncExternalStore so React
 * re-renders when the port is announced after initial mount.
 * Returns an unsubscribe function.
 */
export function subscribeSidecarPort(cb: SidecarListener): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

/**
 * Register the Tauri "sidecar-ready" event listener.
 * Call once at app startup (e.g., in main.tsx or App.tsx).
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initSidecarClient(): void {
  if (_sidecarPort !== null) return; // already initialised

  // Attempt to subscribe to the Tauri event. Fails gracefully in non-Tauri contexts.
  try {
    // Dynamic import keeps Tauri out of the bundle when running in Storybook/tests.
    import("@tauri-apps/api/event")
      .then(({ listen }) => {
        void listen<number>("sidecar-ready", (event) => {
          _sidecarPort = event.payload;
          // Notify all subscribers so React re-renders via useSyncExternalStore
          _listeners.forEach((l) => l());
        });
      })
      .catch(() => {
        // Non-Tauri environment (Storybook, tests) — ignore
      });
  } catch {
    // Ignore — Tauri not available
  }
}

/**
 * Returns the sidecar HTTP base URL (e.g., "http://127.0.0.1:9432").
 * Returns null if the sidecar port has not been announced yet.
 *
 * Consumers should handle the null case by either waiting for the sidecar
 * or using TanStack Query's `enabled: sidecarUrl !== null` guard.
 */
export function getSidecarBaseUrl(): string | null {
  // Dev override via env var (useful for Storybook and integration tests)
  if (import.meta.env.VITE_SIDECAR_PORT) {
    return `http://127.0.0.1:${import.meta.env.VITE_SIDECAR_PORT}`;
  }

  if (_sidecarPort === null) return null;
  return `http://127.0.0.1:${_sidecarPort}`;
}
