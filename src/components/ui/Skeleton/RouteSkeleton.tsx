/**
 * RouteSkeleton — full-route C2 loading placeholder.
 *
 * Renders a complete route-level skeleton: header chrome (page title placeholder)
 * + toolbar row (search + filter chips) + a 12-card grid of CardSkeletons.
 * Used as the default skeleton for any cold-launch library route.
 *
 * Composition strategy (LoadingSkeletons-spec §5.1):
 *   - Composes base Skeleton (Batch G) + CardSkeleton.
 *   - The card grid uses the EXACT same `.library-shell-grid` CSS class as
 *     LibraryShell — byte-identical means swap from RouteSkeleton → populated
 *     LibraryShell is CLS = 0 (LoadingSkeletons-spec §9 edge case).
 *
 * Accessibility (LoadingSkeletons-spec §7.2):
 *   - Root role="status" aria-busy="true" aria-live="polite" aria-label.
 *   - Single screen-reader announcement on mount ("Loading skills library").
 *   - CardSkeleton children are aria-hidden — NOT announced individually.
 *
 * @see docs/design/components/LoadingSkeletons-spec.md §1.1
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./Skeleton";
import { CardSkeleton } from "./CardSkeleton";

export interface RouteSkeletonProps {
  /**
   * Accessible label for the live region. Required.
   * Examples: "Loading skills library", "Loading hooks library".
   */
  ariaLabel: string;
  /**
   * Number of card placeholders to render in the grid.
   * Default 12 — matches loading-architecture.md §"Route boundary map" canonical count.
   */
  cardCount?: number;
  /**
   * Optional className applied to the root <div>.
   */
  className?: string;
}

export function RouteSkeleton({
  ariaLabel,
  cardCount = 12,
  className,
}: RouteSkeletonProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={ariaLabel}
      className={cn("w-full", className)}
    >
      {/* Header row — page title placeholder */}
      <div className="mb-4">
        <Skeleton variant="text" className="h-7 w-48" />
      </div>

      {/* Toolbar row — search input + filter chip placeholders */}
      <div className="mb-4 flex gap-2">
        <Skeleton variant="text" className="h-9 w-72" />
        <Skeleton variant="text" className="h-9 w-24" />
        <Skeleton variant="text" className="h-9 w-24" />
      </div>

      {/* Card grid — same .library-shell-grid class as LibraryShell (CLS = 0 swap) */}
      <div className="library-shell-grid">
        {Array.from({ length: cardCount }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
