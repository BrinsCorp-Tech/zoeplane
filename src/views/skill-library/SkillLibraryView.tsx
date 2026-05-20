/**
 * SkillLibraryView — Skill Library view.
 *
 * Renders the card grid of global skills from the sidecar GET /assets API.
 * Uses:
 *   - TanStack Query for data fetching + caching
 *   - SSE /events stream for cache invalidation on LibraryRefreshEvent
 *   - LibraryShell (cards-only mode) for layout + loading/empty/error states
 *   - SkillCard for individual card rendering
 *
 * Cache key: ['assets', 'skill', 'global']
 * Invalidation: LibraryRefreshEvent where event.kind === 'skill' (ADR-009 §5)
 *
 * Performance: provenance-level memoisation (Finding 4 from Story 6.2).
 * SkillCard.tsx memoises its derivePluginSource call at the provenance reference level.
 *
 * Story: 6.3 — Skill Library (FR-002)
 */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssetSummary } from "@zoeplane/shared-types";
import { LibraryShell } from "@/components/library-shell/LibraryShell";
import { SkillCard } from "@/components/skill-card/SkillCard";
import { fetchAssets } from "@/lib/fetch-assets";
import { getSidecarBaseUrl, subscribeSidecarPort } from "@/lib/sidecar-client";
import { SkillLibraryEmptyState } from "./empty-state";
import { SkillLibraryErrorState } from "./error-state";

// ---------------------------------------------------------------------------
// SSE invalidation hook (ADR-009 §5)
// ---------------------------------------------------------------------------

/**
 * Subscribe to the sidecar SSE /events stream and invalidate the assets cache
 * when a LibraryRefreshEvent with kind='skill' arrives.
 *
 * Reconnects automatically when the sidecar base URL becomes available.
 * Cleans up EventSource on unmount or base URL change.
 *
 * IMPORTANT: Only invalidates on event.kind === 'skill' — not on 'agent' or any other kind.
 */
function useSkillLibrarySSE(enabled: boolean): void {
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
          (data as Record<string, unknown>).kind === "skill"
        ) {
          // Invalidate skill assets cache (ADR-009 §5)
          void queryClient.invalidateQueries({ queryKey: ["assets", "skill"] });
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
// Search predicate (module-scope — stable reference, no new object per render)
// ---------------------------------------------------------------------------

function skillSearchPredicate(item: AssetSummary, term: string): boolean {
  const lc = term.toLowerCase();
  const name = (
    typeof item.frontMatter?.name === "string" ? item.frontMatter.name : item.name
  ).toLowerCase();
  return name.includes(lc);
}

// ---------------------------------------------------------------------------
// SkillLibraryView
// ---------------------------------------------------------------------------

/**
 * SkillLibraryView — the top-level Skill Library view.
 *
 * Manages the full data lifecycle (fetch → render → SSE invalidation).
 * LibraryShell handles layout, loading, empty, and error states.
 */
export function SkillLibraryView(): React.JSX.Element {
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
    queryKey: ["assets", "skill", "global"],
    queryFn: () => fetchAssets({ kind: "skill", scope: "global", baseUrl: baseUrl ?? undefined }),
    enabled: sidecarReady,
    staleTime: 60_000,
  });

  // ── SSE cache invalidation ─────────────────────────────────────────────────

  useSkillLibrarySSE(sidecarReady);

  // ── Derived state ──────────────────────────────────────────────────────────

  const assets = data?.assets ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <LibraryShell<AssetSummary>
      items={assets}
      renderCard={(asset) => (
        <SkillCard
          key={asset.id}
          asset={asset}
          onActivate={(a) => {
            // TODO: Story 6.7 — navigate to Skill Detail view
            if (import.meta.env.DEV) {
              console.log("[SkillLibraryView] skill activated:", a.id);
            }
          }}
        />
      )}
      ariaLabel="Skills library"
      loading={isPending}
      error={isError ? (error instanceof Error ? error : new Error(String(error))) : null}
      emptyState={<SkillLibraryEmptyState />}
      errorState={<SkillLibraryErrorState onRetry={() => void refetch()} />}
      searchPlaceholder="Search skills…"
      searchPredicate={skillSearchPredicate}
    />
  );
}
