/** @see docs/design/components/Button-spec.md */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner/Spinner";

// ─── Variants ─────────────────────────────────────────────────────────────────

const buttonVariants = cva(
  // Base: layout, typography, transitions, focus ring
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
    "ring-offset-background transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    // SVG children (icon slots) — pointer-events passthrough, predictable sizing
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    // Disabled: pointer-events-none + reduced opacity (spec §3 disabled state)
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        // Primary — accent tokens (Button-spec §2)
        default: "bg-primary text-primary-foreground hover:bg-accent-hover active:bg-accent-active",
        // Destructive — danger tokens
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
        // Outline — transparent background with border
        outline:
          "border border-input bg-transparent text-foreground hover:bg-muted active:bg-muted",
        // Secondary — surface-muted background
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",
        // Ghost — transparent, hover overlay only
        ghost: "bg-transparent text-foreground hover:bg-muted active:bg-muted/80",
        // Link — inline text link; no background; no padding override
        link: "text-primary underline-offset-4 hover:underline bg-transparent p-0 h-auto",
      },
      size: {
        // Spec §2: sm = h-32px text-xs px-3; default = h-36px text-sm px-4;
        //          lg = h-40px text-base px-6; icon = 36×36 square
        sm: "h-8 min-w-8 rounded-md px-3 text-xs",
        default: "h-9 min-w-9 px-4 text-sm",
        lg: "h-10 min-w-10 rounded-md px-6 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /**
   * When true renders a Radix Slot instead of <button> so the consumer's child
   * element receives all button props. Use for link-as-button patterns.
   */
  asChild?: boolean;
  /**
   * Loading state: shows a Spinner (size="xs", 14×14 px) before children, sets
   * aria-busy="true" and aria-disabled="true", blocks interaction.
   * The visible label is NOT replaced — preserving layout dimensions.
   */
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Button — the primary interactive primitive.
 *
 * - 6 variants: default / secondary / destructive / outline / ghost / link
 * - 4 sizes: sm / default / lg / icon
 * - `loading` prop: Spinner (size="xs") + aria-busy, label preserved (no CLS)
 * - `asChild` prop: renders Radix Slot for link-as-button patterns
 * - All spec §4 accessibility contracts: focus-visible ring, aria-label for icon-only
 *
 * @see docs/design/components/Button-spec.md
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    // Loading state: interaction blocked but element stays in tab order (spec §3 loading).
    // We use aria-disabled + pointer-events-none rather than the native disabled attribute
    // so screen readers retain context about the element.
    const loadingProps = loading
      ? {
          "aria-busy": true as const,
          "aria-disabled": true as const,
          "aria-live": "polite" as const,
          // Block pointer interaction without removing from tab order
          style: { pointerEvents: "none" as const },
        }
      : {};

    return (
      <Comp
        ref={ref}
        disabled={disabled}
        className={cn(buttonVariants({ variant, size }), className)}
        {...loadingProps}
        {...props}
      >
        {loading && (
          // Spinner size="xs" = 14×14 px — preserves the exact visual contract
          // previously held by <Loader2 width={14} height={14} aria-hidden="true" />.
          // Button carries aria-busy="true" + aria-live="polite" (loadingProps above);
          // Spinner is decorative here (aria-hidden by Spinner's default). (Spinner-spec §4)
          <Spinner size="xs" aria-hidden="true" />
        )}
        {children}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
