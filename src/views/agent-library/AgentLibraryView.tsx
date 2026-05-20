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
import { useQuery } from "@tanstack/react-query";
import type { AssetSummary } from "@zoeplane/shared-types";
import { LibraryShell } from "@/components/library-shell/LibraryShell";
import { AgentCard } from "@/components/agent-card/AgentCard";
import { fetchAssets } from "@/lib/fetch-assets";
import { assetNameSearchPredicate } from "@/lib/asset-search";
import { getSidecarBaseUrl, subscribeSidecarPort } from "@/lib/sidecar-client";
import { AgentLibraryEmptyState } from "./empty-state";
import { AgentLibraryErrorState } from "./error-state";
import { useLibrarySSE } from "@/hooks/useLibrarySSE";

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

  useLibrarySSE("agent", sidecarReady);

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
      searchPredicate={assetNameSearchPredicate}
    />
  );
}
