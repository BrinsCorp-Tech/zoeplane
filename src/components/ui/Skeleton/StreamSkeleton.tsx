/**
 * StreamSkeleton — C3 streaming-surface placeholder.
 *
 * Represents the brief liminal state between "user invoked a streaming surface"
 * and "first token arrives." Used by Epic 07 Task Console agent panes, Skill
 * Builder right pane, and evaluator report streaming.
 *
 * Visual: 5 lines (default) with progressively decreasing opacity (1.0 → 0.4),
 * and ragged widths (full → narrower → narrowest). The static opacity gradient
 * conveys "content is arriving from above" — distinct from the stable-block
 * pattern of CardSkeleton / RouteSkeleton.
 *
 * NOTE: StreamSkeleton is NOT a placeholder for the ENTIRE streaming duration.
 * It appears only during the pre-first-token interval (typically 1–3 s). Once
 * the first token arrives, the consumer unmounts StreamSkeleton and renders
 * the streaming-text UI. Using it for longer violates the C3 rule from
 * loading-architecture.md ("The mistake to avoid: showing a skeleton for C3 work").
 *
 * Composition strategy (LoadingSkeletons-spec §5.1):
 *   - Composes base Skeleton (Batch G). No shimmer re-implementation.
 *   - The opacity tapering is STATIC CSS — not animated. The shimmer is
 *     inherited from each composed Skeleton. Adding motion to the opacity
 *     cascade would compete with shimmer and create vestibular trigger risk.
 *
 * Accessibility (LoadingSkeletons-spec §7.4):
 *   - Root role="status" aria-busy="true" aria-live="polite" aria-label.
 *   - Single screen-reader announcement on mount.
 *
 * @see docs/design/components/LoadingSkeletons-spec.md §1.3
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./Skeleton";

export interface StreamSkeletonProps {
  /**
   * Number of skeleton lines to render. Default 5. Range 3–8.
   * Lines render with progressively decreasing opacity from top to bottom.
   */
  lines?: number;
  /**
   * Accessible label for the live region. Required.
   * Examples: "Connecting to Zoe…", "Waiting for first token from the researcher agent".
   */
  ariaLabel: string;
  /**
   * Optional className applied to the root <div>.
   */
  className?: string;
}

// Static opacity values per line index (0 = top = full opacity, descending).
// LoadingSkeletons-spec §1.3: 1.0 → 0.85 → 0.70 → 0.55 → 0.40.
// The minimum is 0.40 in light theme; per §9 edge case this may fade to near-
// invisible in dark theme — accepted: it reinforces the "tapering off" metaphor.
const LINE_CONFIG: Array<{ widthClass: string; opacityClass: string }> = [
  { widthClass: "w-full", opacityClass: "opacity-100" },
  { widthClass: "w-11/12", opacityClass: "opacity-85" },
  { widthClass: "w-4/5", opacityClass: "opacity-70" },
  { widthClass: "w-2/3", opacityClass: "opacity-55" },
  { widthClass: "w-1/3", opacityClass: "opacity-40" },
  // Extended lines for consumers who request > 5 (interleaved widths)
  { widthClass: "w-3/4", opacityClass: "opacity-30" },
  { widthClass: "w-1/2", opacityClass: "opacity-25" },
  { widthClass: "w-2/5", opacityClass: "opacity-20" },
];

export function StreamSkeleton({
  lines = 5,
  ariaLabel,
  className,
}: StreamSkeletonProps): React.ReactElement {
  // Clamp to spec range 3–8
  const clampedLines = Math.min(8, Math.max(3, lines));

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={ariaLabel}
      className={cn("w-full space-y-2", className)}
    >
      {Array.from({ length: clampedLines }).map((_, i) => {
        const config = LINE_CONFIG[i] ?? LINE_CONFIG[LINE_CONFIG.length - 1];
        return (
          <Skeleton
            key={i}
            variant="text"
            className={cn("h-4", config.widthClass, config.opacityClass)}
          />
        );
      })}
    </div>
  );
}
