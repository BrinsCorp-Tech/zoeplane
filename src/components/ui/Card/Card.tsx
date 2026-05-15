/** @see docs/design/components/Card-spec.md */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ─── Root card variants ───────────────────────────────────────────────────────

const cardVariants = cva(
  // Base: bg, border, radius, shadow
  "rounded-md border bg-card text-card-foreground",
  {
    variants: {
      variant: {
        default: "border-card-border shadow-sm",
        raised: "border-card-border shadow-md",
        muted: "bg-muted border-card-border shadow-sm",
      },
      interactive: {
        true: [
          "cursor-pointer",
          "transition-colors duration-150",
          // Hover: border shifts to border-strong (A-10 timing)
          "hover:border-border-strong",
          // Focus ring (A-11: instant, never animated)
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        ],
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      interactive: false,
    },
  },
);

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  /**
   * When true the card adopts hover/focus/active states and becomes keyboard-navigable.
   * Used for asset cards (SkillCard, HookCard, AgentCard) that are click targets.
   * The consumer chooses the semantic (role="button" + keydown handlers, or asChild + <a>).
   */
  interactive?: boolean;
}

// ─── Card root ───────────────────────────────────────────────────────────────

/**
 * Card — layout container primitive.
 *
 * - Three variants: default / raised / muted (see spec §2).
 * - `interactive` prop adds hover/focus affordances and tabIndex={0}.
 * - Sub-parts (CardHeader/Title/Description/Content/Footer) compose inside.
 *
 * @see docs/design/components/Card-spec.md
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive = false, tabIndex, ...props }, ref) => {
    // tabIndex: interactive cards are focusable (0); static cards are skipped (-1 unless overridden).
    const resolvedTabIndex = interactive ? (tabIndex ?? 0) : tabIndex;

    return (
      <div
        ref={ref}
        tabIndex={resolvedTabIndex}
        className={cn(cardVariants({ variant, interactive }), className)}
        {...props}
      />
    );
  },
);

Card.displayName = "Card";

// ─── CardHeader ──────────────────────────────────────────────────────────────

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1 p-6 pb-4", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

// ─── CardTitle ───────────────────────────────────────────────────────────────

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-foreground text-lg leading-snug font-semibold", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

// ─── CardDescription ─────────────────────────────────────────────────────────

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-muted-foreground text-sm leading-normal", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

// ─── CardContent ─────────────────────────────────────────────────────────────

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-6 pt-0 pb-6", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

// ─── CardFooter ──────────────────────────────────────────────────────────────

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2 px-6 pt-0 pb-6", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

// ─── Exports ─────────────────────────────────────────────────────────────────

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
