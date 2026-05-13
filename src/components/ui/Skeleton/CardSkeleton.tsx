/**
 * CardSkeleton — single-card C2 loading placeholder.
 *
 * Matches the canonical 240×140 card dimensions from Card-spec / ux-spec §7.5
 * and §7.8.7. Internal layout calibrated against HookCard (the densest canonical
 * card) — 5-row structure reserves space for: title, secondary lines, scope chip,
 * state chip, footer.
 *
 * Composition strategy (LoadingSkeletons-spec §5.1):
 *   - Composes base Skeleton primitive (Batch G). No shimmer re-implementation.
 *   - Reduced-motion, forced-colors, and aria-hidden are all inherited from Skeleton.
 *
 * Accessibility (LoadingSkeletons-spec §7.3):
 *   - aria-hidden="true" on the outer card wrap — CardSkeleton is a composition
 *     primitive that lives inside a region (LibraryShell's loading state or
 *     RouteSkeleton's outer region). NEVER carries its own role="status".
 *
 * @see docs/design/components/LoadingSkeletons-spec.md §1.2
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./Skeleton";

export interface CardSkeletonProps {
  /**
   * Optional className applied to the outer card wrap. Used by RouteSkeleton's
   * grid and by LibraryShell's loading state.
   */
  className?: string;
}

export function CardSkeleton({ className }: CardSkeletonProps): React.ReactElement {
  return (
    /*
     * Outer wrap matches Card-spec default chrome exactly — same border,
     * radius, padding — so the swap from CardSkeleton to a real card is CLS-free.
     * aria-hidden="true" per LoadingSkeletons-spec §7.3.
     */
    <div
      aria-hidden="true"
      className={cn(
        "border-border bg-surface flex h-[140px] flex-col gap-2 rounded-lg border p-3",
        className,
      )}
    >
      {/* Row 1 — title placeholder */}
      <Skeleton variant="text" className="h-5 w-3/4" />

      {/* Row 2 — secondary / description lines (ragged paragraph) */}
      <div className="space-y-1">
        <Skeleton variant="text" className="h-3 w-full" />
        <Skeleton variant="text" className="h-3 w-5/6" />
      </div>

      {/* Rows 3+4 — scope chip + state chip (pill-shaped) */}
      <div className="flex gap-2">
        <Skeleton variant="text" className="h-4 w-16 rounded-full" />
        <Skeleton variant="text" className="h-4 w-16 rounded-full" />
      </div>

      {/* Row 5 — footer / last-modified placeholder (pushed to bottom) */}
      <Skeleton variant="text" className="mt-auto h-3 w-1/3" />
    </div>
  );
}

export default CardSkeleton;
