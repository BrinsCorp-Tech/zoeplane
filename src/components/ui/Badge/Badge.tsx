/** @see docs/design/components/Badge-spec.md */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon/Icon";

// ─── Variants ─────────────────────────────────────────────────────────────────

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "border-border text-foreground bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /**
   * When provided, renders a dismiss (×) button inside the badge.
   * The dismiss button has aria-label="Dismiss" and an inflated 32×32 hit area.
   * The badge root remains a <span>; only the inner button is interactive.
   *
   * Dismiss label can be customised via `dismissLabel` for more specific announcements
   * e.g. "Dismiss filter: Global".
   */
  onDismiss?: () => void;
  /** Accessible label for the dismiss button. Defaults to "Dismiss". */
  dismissLabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Badge — inline-flex status indicator.
 *
 * - Four variants: default / secondary / destructive / outline.
 * - Optional dismiss button via `onDismiss` prop.
 * - Icons are decorative (aria-hidden); pair with visible text for WCAG 1.3.1.
 *
 * @see docs/design/components/Badge-spec.md
 */
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, onDismiss, dismissLabel = "Dismiss", children, ...props }, ref) => {
    return (
      <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
        {children}
        {onDismiss && (
          <button
            type="button"
            aria-label={dismissLabel}
            onClick={onDismiss}
            className={cn(
              // Inflated touch target: negative margin + padding keeps layout compact
              // while expanding the hit area toward the 32×32 minimum.
              "-my-0.5 -mr-0.5 ml-0.5 rounded-full p-0.5",
              "hover:bg-hover-overlay",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
            )}
          >
            <Icon name="x" size="xs" aria-hidden={true} />
          </button>
        )}
      </span>
    );
  },
);

Badge.displayName = "Badge";

export { Badge, badgeVariants };
