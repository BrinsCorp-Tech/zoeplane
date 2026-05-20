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
 * Register the Tauri "sidecar-ready" event listener AND immediately query
 * the current sidecar status via IPC. The IPC fallback closes a pub/sub
 * race: Rust emits "sidecar-ready" at sidecar-spawn time which can land
 * before the React app finishes mounting + registering its listener. The
 * IPC `sidecar_status` command returns the current port if the sidecar is
 * already running, catching the case where the one-shot event was missed.
 *
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

    // IPC fallback for the pub/sub race: query the current sidecar status. If
    // the sidecar is already running, the response includes the port and we
    // populate _sidecarPort directly. Retries on a short backoff if the
    // sidecar isn't ready yet, since we may be racing the very first health-check.
    void pollSidecarStatusUntilRunning();
  } catch {
    // Ignore — Tauri not available
  }
}

/**
 * Polls `sidecar_status` via IPC every 500ms until the sidecar reports
 * running with a known port. Sets _sidecarPort and notifies subscribers,
 * then stops. The "sidecar-ready" listener registered in parallel will
 * still fire for future port changes (sidecar restart, etc.) — this poll
 * only covers the cold-start race.
 */
async function pollSidecarStatusUntilRunning(): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    for (let attempt = 0; attempt < 60; attempt += 1) {
      // Stop if the event listener beat us to it.
      if (_sidecarPort !== null) return;
      try {
        const status = (await invoke("sidecar_status")) as {
          running?: boolean;
          port?: number | null;
        };
        if (status?.running && typeof status.port === "number") {
          _sidecarPort = status.port;
          _listeners.forEach((l) => l());
          return;
        }
      } catch {
        // ignore transient IPC failures during startup
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch {
    // Non-Tauri environment — ignore
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
