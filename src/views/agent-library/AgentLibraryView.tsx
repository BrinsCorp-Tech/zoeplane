/**
 * AgentLibraryView — Agent Library view.
 *
 * Renders the card grid of global agents from the sidecar GET /assets API.
 * Uses:
 *   - TanStack Query for data fetching + caching
 *   - SSE /events stream for cache invalidation on LibraryRefreshEvent
 *   - LibraryShell (cards-only mode) for layout + loading/empty/error states
 *   - AgentCard for individual card rendering
 *
 * Cache key: ['assets', 'agent', 'global']
 * Invalidation: LibraryRefreshEvent where event.kind === 'agent' (ADR-009 §5)
 *
 * Story: 6.2 — Agent Library (FR-010)
 */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssetSummary } from "@zoeplane/shared-types";
import { LibraryShell } from "@/components/library-shell/LibraryShell";
import { AgentCard } from "@/components/agent-card/AgentCard";
import { fetchAssets } from "@/lib/fetch-assets";
import { getSidecarBaseUrl, subscribeSidecarPort } from "@/lib/sidecar-client";
import { AgentLibraryEmptyState } from "./empty-state";
import { AgentLibraryErrorState } from "./error-state";

// ---------------------------------------------------------------------------
// SSE invalidation hook (ADR-009 §5)
// ---------------------------------------------------------------------------

/**
 * Subscribe to the sidecar SSE /events stream and invalidate the assets cache
 * when a LibraryRefreshEvent with kind='agent' arrives.
 *
 * Reconnects automatically when the sidecar base URL becomes available.
 * Cleans up EventSource on unmount or base URL change.
 */
function useAgentLibrarySSE(enabled: boolean): void {
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
          (data as Record<string, unknown>).kind === "agent"
        ) {
          // Invalidate agent assets cache (ADR-009 §5)
          void queryClient.invalidateQueries({ queryKey: ["assets", "agent"] });
        }
      } catch {
        // Ignore malformed SSE messages
      }
    });

    return () => {
      es.close();
    };
  }, [enabled, queryClient]);
}

// ---------------------------------------------------------------------------
// Search predicate (memoised at module scope — no new reference per render)
// ---------------------------------------------------------------------------

function agentSearchPredicate(item: AssetSummary, term: string): boolean {
  const lc = term.toLowerCase();
  const name = (
    typeof item.frontMatter?.name === "string" ? item.frontMatter.name : item.name
  ).toLowerCase();
  return name.includes(lc);
}

// ---------------------------------------------------------------------------
// AgentLibraryView
// ---------------------------------------------------------------------------

/**
 * AgentLibraryView — the top-level Agent Library view.
 *
 * Manages the full data lifecycle (fetch → render → SSE invalidation).
 * LibraryShell handles layout, loading, empty, and error states.
 */
export function AgentLibraryView(): React.JSX.Element {
  // useSyncExternalStore ensures React re-renders when the sidecar port is
  // announced after initial mount (Finding 1 — non-reactive module variable fix).
  const sidecarReady = React.useSyncExternalStore(
    subscribeSidecarPort,
    () => getSidecarBaseUrl() !== null,
    () => false, // SSR/initial server snapshot — never true on server
  );
  const baseUrl = sidecarReady ? getSidecarBaseUrl() : null;

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data, isPending, isError, error, refetch } = useQuery<{
    assets: AssetSummary[];
    truncated: boolean;
    totalCount: number;
  }>({
    queryKey: ["assets", "agent", "global"],
    queryFn: () => fetchAssets({ kind: "agent", scope: "global", baseUrl: baseUrl ?? undefined }),
    enabled: sidecarReady,
    staleTime: 60_000,
  });

  // ── SSE cache invalidation ─────────────────────────────────────────────────

  useAgentLibrarySSE(sidecarReady);

  // ── Derived state ──────────────────────────────────────────────────────────

  const assets = data?.assets ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <LibraryShell<AssetSummary>
      items={assets}
      renderCard={(asset) => (
        <AgentCard
          key={asset.id}
          asset={asset}
          onActivate={(a) => {
            // TODO: Story 6.6 — navigate to Agent Detail view
            if (import.meta.env.DEV) {
              console.log("[AgentLibraryView] agent activated:", a.id);
            }
          }}
        />
      )}
      ariaLabel="Agents library"
      loading={isPending}
      error={isError ? (error instanceof Error ? error : new Error(String(error))) : null}
      emptyState={<AgentLibraryEmptyState />}
      errorState={<AgentLibraryErrorState onRetry={() => void refetch()} />}
      searchPlaceholder="Search agents…"
      searchPredicate={agentSearchPredicate}
    />
  );
}
