/** @see docs/design/components/Skeleton-spec.md */
import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Variant map (Skeleton-spec §2) ───────────────────────────────────────────
// Four shape variants — only border-radius and default dimensions differ.
// Color, animation, and accessibility behavior are identical across all variants.

const VARIANT_CLASSES = {
  // Single-line text placeholder — h-4 w-full, rounded-md (4 px)
  text: "h-4 w-full rounded-md",
  // Circular avatar placeholder — h-10 w-10, rounded-full
  avatar: "h-10 w-10 rounded-full",
  // Full-card placeholder — h-30 w-60, rounded-lg (matches Card component)
  card: "h-[120px] w-60 rounded-lg",
  // Escape hatch — caller MUST provide dimensions and border-radius via className
  custom: "",
} as const;

export type SkeletonVariant = keyof typeof VARIANT_CLASSES;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement | HTMLDivElement> {
  /**
   * Shape variant (Skeleton-spec §2):
   *  - text   — h-4 w-full rounded-md. Default. Stack for paragraphs.
   *  - avatar — h-10 w-10 rounded-full. Circular user/agent/skill placeholder.
   *  - card   — h-[120px] w-60 rounded-lg. Full SkillCard-sized placeholder.
   *              Renders as <div> (block-level, per Skeleton-spec §1 anatomy table).
   *  - custom — no defaults. Caller provides dimensions + border-radius via className.
   *              Renders as <span> (inline-compatible; callers dictate display).
   */
  variant?: SkeletonVariant;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Skeleton — theme-aware placeholder primitive for Category-C2 loading (200 ms – 2 s).
 *
 * Accessibility contract (Skeleton-spec §4):
 *  - Individual Skeleton instances are decorative (aria-hidden="true" by default).
 *  - The WRAPPING REGION carries role="status" aria-live="polite" aria-busy="true".
 *  - Never put role="status" on individual Skeleton elements in a grid/list — it
 *    would fire N announcements for one logical loading region.
 *
 * Shimmer implementation (Skeleton-spec §5):
 *  - Base: --color-surface-muted; highlight: --color-surface-raised.
 *  - --color-surface-raised is used (not --color-surface) because in dark theme
 *    --color-surface and --color-surface-muted both resolve to gray-900, making
 *    the shimmer invisible. --color-surface-raised resolves to gray-850 in dark
 *    and white in light — visible lift in both themes.
 *  - Animation uses literal 1.2s (not a motion token): continuous keyframes are
 *    the approved exception per Skeleton-spec §5 + Spinner-spec §5.
 *  - Reduced motion: animation removed, gradient removed, solid muted fill retained.
 *
 * @see docs/design/components/Skeleton-spec.md
 */
const Skeleton = React.forwardRef<HTMLSpanElement | HTMLDivElement, SkeletonProps>(
  ({ variant = "text", className, ...props }, ref) => {
    // card is block-level (per Skeleton-spec §1 anatomy table); all others are
    // inline-compatible spans. custom stays span so callers can use it inline.
    const Element = variant === "card" ? "div" : "span";
    return (
      <>
        {/*
         * Shimmer keyframe injected once via a global <style> tag.
         * Using a CSS class + keyframe avoids inline-style limitations with
         * background-position animation, and avoids importing a separate CSS file
         * per component instance. The style tag is idempotent — the browser
         * de-dupes identical <style> text nodes.
         *
         * Reduced-motion: the @media block removes both animation and gradient,
         * leaving a solid --color-surface-muted fill at the same dimensions.
         */}
        <style>{`
          @keyframes skeleton-shimmer {
            0%   { background-position: -200% 0; }
            100% { background-position:  200% 0; }
          }
          .skeleton-shimmer {
            background-color: var(--color-surface-muted);
            background-image: linear-gradient(
              90deg,
              transparent 0%,
              var(--color-surface-raised) 50%,
              transparent 100%
            );
            background-size: 200% 100%;
            background-repeat: no-repeat;
            animation: skeleton-shimmer 1.2s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .skeleton-shimmer {
              animation: none;
              background-image: none;
            }
          }
        `}</style>
        <Element
          ref={ref as React.Ref<HTMLDivElement & HTMLSpanElement>}
          aria-hidden="true"
          className={cn("skeleton-shimmer block", VARIANT_CLASSES[variant], className)}
          {...props}
        />
      </>
    );
  },
);

Skeleton.displayName = "Skeleton";

export { Skeleton };
export default Skeleton;
