/**
 * useLibrarySSE — shared SSE invalidation hook for library views.
 *
 * Subscribes to the sidecar SSE /events stream and invalidates the TanStack Query
 * assets cache when a LibraryRefreshEvent for the given kind arrives.
 *
 * Per ADR-009 §5. Lifecycle is tied to the `enabled` flag — callers typically
 * drive `enabled` via React.useSyncExternalStore on the sidecar port handle.
 *
 * When `enabled === false` or `getSidecarBaseUrl()` returns null, no EventSource
 * is opened. Reactive resubscription on sidecar port becoming available is the
 * caller's responsibility (driven by useSyncExternalStore at the call site).
 *
 * Malformed SSE messages are silently swallowed (non-blocking error handling per
 * ADR-009 §5 — matching the original inline hook pattern).
 *
 * Usage:
 *   useLibrarySSE("agent", sidecarReady);
 *   useLibrarySSE("skill", sidecarReady);
 *
 * @see src/views/agent-library/AgentLibraryView.tsx — original consumer (Story 6.2)
 * @see src/views/skill-library/SkillLibraryView.tsx — original consumer (Story 6.3)
 * @see docs/stories/epic-06/story-6.12-library-sse-hook-extraction.md — extraction story
 */

import * as React from "react";
import type { ResourceKind } from "@zoeplane/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { getSidecarBaseUrl } from "@/lib/sidecar-client";

/**
 * Subscribe to the sidecar SSE /events stream and invalidate the assets cache
 * when a LibraryRefreshEvent for the given kind arrives.
 *
 * @param kind - The asset kind to subscribe for. Typed as Exclude<ResourceKind, "hook">
 *   to restrict to asset-only kinds (skill | agent | command | team | workflow).
 * @param enabled - When false, the hook is a no-op. Typically driven by
 *   useSyncExternalStore on the sidecar port handle.
 */
export function useLibrarySSE(kind: Exclude<ResourceKind, "hook">, enabled: boolean): void {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!enabled) return;

    const baseUrl = getSidecarBaseUrl();
    if (baseUrl === null) return;

    const es = new EventSource(`${baseUrl}/events`);

    es.addEventListener("message", (event: MessageEvent<string>) => {
      try {
        const data: unknown = JSON.parse(event.data);
        if (
          typeof data === "object" &&
          data !== null &&
          "type" in data &&
          (data as Record<string, unknown>).type === "library:refresh" &&
          "kind" in data &&
          (data as Record<string, unknown>).kind === kind
        ) {
          // Invalidate assets cache for this kind (ADR-009 §5)
          void queryClient.invalidateQueries({ queryKey: ["assets", kind] });
        }
      } catch {
        // Ignore malformed SSE messages
      }
    });

    return () => {
      es.close();
    };
  }, [enabled, kind, queryClient]);
}
