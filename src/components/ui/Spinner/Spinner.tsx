/** @see docs/design/components/Spinner-spec.md */
import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Size scale (Spinner-spec §2) ─────────────────────────────────────────────
// Mirrors Icon's xs/sm/md/lg/xl token names so a swap between Spinner and Icon
// at the same call site never changes layout dimensions. xs is 14 px (not 12)
// to match the Loader2 stub Button.tsx previously used (14×14).

const SIZE_CLASSES = {
  xs: "h-[14px] w-[14px] border-[1.5px]",
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-6 w-6 border-[2.5px]",
  xl: "h-8 w-8 border-[3px]",
} as const;

export type SpinnerSize = keyof typeof SIZE_CLASSES;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Size from the 5-step scale: xs (14px), sm (16px), md (20px), lg (24px), xl (32px).
   * Mirrors Icon's size scale so Spinner and Icon are layout-interchangeable.
   * Default: sm.
   */
  size?: SpinnerSize;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Spinner — CSS-only indeterminate rotational loading indicator.
 *
 * Two modes (Spinner-spec §4):
 *  - Decorative (default): aria-hidden="true". Use inside an interactive parent
 *    (Button with loading=true) that carries the busy semantics.
 *  - Standalone: pass role="status" + aria-label="<message>". Component drops
 *    aria-hidden and falls back to aria-label="Loading" if none supplied (dev
 *    warning emitted in development mode).
 *
 * Color flows through currentColor — parent's text-* utility cascades through.
 * No color prop. No SVG. Animation is GPU-composited transform only.
 *
 * @see docs/design/components/Spinner-spec.md
 */
const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ size = "sm", className, role, "aria-label": ariaLabel, ...props }, ref) => {
    const isStandalone = role === "status";

    // Dev warning: standalone mode without an aria-label (Spinner-spec §4)
    if (isStandalone && !ariaLabel && import.meta.env.DEV) {
      console.warn(
        '[Spinner] role="status" supplied without aria-label. ' +
          'Falling back to aria-label="Loading". ' +
          "Provide a specific label for better screen reader context " +
          '(e.g. aria-label="Loading skills").',
      );
    }

    // In standalone mode: expose to AT via role="status" + aria-label.
    // In decorative mode: aria-hidden="true", no role.
    const a11yProps = isStandalone
      ? {
          role: "status" as const,
          "aria-label": ariaLabel ?? "Loading",
        }
      : {
          "aria-hidden": true as const,
        };

    return (
      <span
        ref={ref}
        className={cn(
          // Layout: square, circular
          "inline-block rounded-full",
          // Arc: three border sides use currentColor; top-right quarter transparent
          "border-current border-t-transparent",
          // Animation: 1.2s linear infinite rotation (literal value — not a motion
          // token; continuous keyframes are the approved exception per Spinner-spec §5
          // and Button-spec §5).
          // motion-reduce: animation removed; static 270° arc preserved as affordance.
          "animate-spin motion-reduce:animate-none",
          SIZE_CLASSES[size],
          className,
        )}
        {...a11yProps}
        {...props}
      />
    );
  },
);

Spinner.displayName = "Spinner";

export { Spinner };
export default Spinner;
