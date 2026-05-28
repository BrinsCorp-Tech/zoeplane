/**
 * CommandsLibraryView — Commands Library view.
 *
 * Renders the card grid of global + project commands from the sidecar GET /assets API.
 * No scope filter is passed — the sidecar returns both global and project rows per
 * ADR-009 §2. CommandCard's scope badge differentiates "Global" from "Project" (AC #1).
 *
 * Uses:
 *   - TanStack Query for data fetching + caching
 *   - SSE /events stream for cache invalidation on LibraryRefreshEvent
 *   - LibraryShell (cards-only mode) for layout + loading/empty/error states
 *   - CommandCard for individual card rendering
 *
 * Cache key: ['assets', 'command']
 * Invalidation: LibraryRefreshEvent where event.kind === 'command' (ADR-009 §5)
 *
 * F-001 fix: onActivate passes asset.sourcePath (not asset.id) to
 * useAssetNav.open("command", …). AssetDetailView line ~145 detects that
 * selectedAssetId.includes("/") and treats it as a path directly, bypassing
 * the UUID-resolution fetch that was hardcoded to scope=global. This makes
 * navigation work for BOTH global and project-scoped commands without
 * touching the shared AssetDetailView code.
 *
 * AC #2: when no project is active, sidecar returns only global rows (scope="global").
 * The view renders whatever rows come back — no client-side project-detection needed.
 * A missing project/.claude/commands/ directory is handled gracefully by the sidecar;
 * the response will simply contain zero project rows (AC #4).
 *
 * TODO(ADR-009 R-3): truncated banner not yet implemented — shared concern across
 * skill/agent/command library views; implement together in a dedicated story.
 *
 * Story: 6.6 — Commands Library (FR-011)
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { AssetSummary } from "@zoeplane/shared-types";
import { LibraryShell } from "@/components/library-shell/LibraryShell";
import { CommandCard } from "@/components/command-card/CommandCard";
import { fetchAssets } from "@/lib/fetch-assets";
import { assetNameSearchPredicate } from "@/lib/asset-search";
import { getSidecarBaseUrl, subscribeSidecarPort } from "@/lib/sidecar-client";
import { CommandsLibraryEmptyState } from "./empty-state";
import { CommandsLibraryErrorState } from "./error-state";
import { useLibrarySSE } from "@/hooks/useLibrarySSE";
import { useAssetNav } from "@/stores/asset-nav";

// ---------------------------------------------------------------------------
// CommandsLibraryView
// ---------------------------------------------------------------------------

/**
 * CommandsLibraryView — the top-level Commands Library view.
 *
 * Manages the full data lifecycle (fetch → render → SSE invalidation).
 * LibraryShell handles layout, loading, empty, and error states.
 */
export function CommandsLibraryView(): React.JSX.Element {
  // useSyncExternalStore ensures React re-renders when the sidecar port is
  // announced after initial mount (Finding 1 — non-reactive module variable fix).
  const sidecarReady = React.useSyncExternalStore(
    subscribeSidecarPort,
    () => getSidecarBaseUrl() !== null,
    () => false, // SSR/initial server snapshot — never true on server
  );
  const baseUrl = sidecarReady ? getSidecarBaseUrl() : null;

  // ── Data fetching ──────────────────────────────────────────────────────────

  // No scope filter — returns both global and project rows per ADR-009 §2 (AC #1).
  const { data, isPending, isError, error, refetch } = useQuery<{
    assets: AssetSummary[];
    truncated: boolean;
    totalCount: number;
  }>({
    queryKey: ["assets", "command"],
    queryFn: () => fetchAssets({ kind: "command", baseUrl: baseUrl ?? undefined }),
    enabled: sidecarReady,
    staleTime: 60_000,
  });

  // ── SSE cache invalidation ─────────────────────────────────────────────────

  useLibrarySSE("command", sidecarReady);

  // ── Derived state ──────────────────────────────────────────────────────────

  const assets = data?.assets ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <LibraryShell<AssetSummary>
      items={assets}
      renderCard={(asset) => (
        <CommandCard
          key={asset.id}
          asset={asset}
          onActivate={(a) => {
            // F-001 fix: pass sourcePath as the assetId so AssetDetailView's
            // path-detection branch (selectedAssetId.includes("/")) resolves
            // directly to the file — avoiding the UUID-resolution fetch that
            // was hardcoded to scope=global and would fail for project-scoped commands.
            useAssetNav.getState().open("command", a.sourcePath);
          }}
        />
      )}
      ariaLabel="Commands library"
      loading={isPending}
      error={isError ? (error instanceof Error ? error : new Error(String(error))) : null}
      emptyState={<CommandsLibraryEmptyState />}
      errorState={<CommandsLibraryErrorState onRetry={() => void refetch()} />}
      searchPlaceholder="Search commands…"
      searchPredicate={assetNameSearchPredicate}
    />
  );
}
