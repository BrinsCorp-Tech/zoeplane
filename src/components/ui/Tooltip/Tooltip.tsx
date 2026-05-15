/** @see docs/design/components/Tooltip-spec.md */
import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

// ─── Re-export primitives with ZoePlane naming ─────────────────────────────────

/**
 * TooltipProvider — root-of-tree provider. Manages global delayDuration and
 * skipDelayDuration. Render once near the top of the application (e.g., HostShell).
 *
 * Spec defaults:
 *   - delayDuration={300} — WCAG 1.4.13: 300 ms hover delay
 *   - skipDelayDuration={150} — smooth cascade across adjacent tooltips
 *   - disableHoverableContent={false} — WCAG 1.4.13 "hoverable" compliance
 */
const TooltipProvider = ({
  delayDuration = 300,
  skipDelayDuration = 150,
  disableHoverableContent = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider
    delayDuration={delayDuration}
    skipDelayDuration={skipDelayDuration}
    disableHoverableContent={disableHoverableContent}
    {...props}
  />
);
TooltipProvider.displayName = "TooltipProvider";

/** TooltipRoot — open-state controller for one tooltip. */
const TooltipRoot = TooltipPrimitive.Root;

/**
 * TooltipTrigger — the element that triggers the tooltip.
 * MUST be focusable (WCAG 1.4.13 "trigger by focus" requirement).
 * For disabled buttons, wrap in `<span tabIndex={0}>` — see spec §8.
 */
const TooltipTrigger = TooltipPrimitive.Trigger;

// ─── TooltipContent ────────────────────────────────────────────────────────────

export type TooltipContentProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>;

/**
 * TooltipContent — portaled overlay carrying role="tooltip".
 *
 * Token contract (Tooltip-spec §2):
 *   - bg-surface-overlay  (--color-surface-overlay)
 *   - text-foreground     (--color-foreground)
 *   - radius-sm
 *   - shadow-md
 *   - max-w-[240px]
 *
 * Motion (A-04 family — fade only; Tooltip-spec §5):
 *   - 100ms fade-in on enter, 100ms fade-out on exit.
 *   - No slide — compliant with prefers-reduced-motion out of the box.
 */
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        // Layout & typography
        "border-border z-50 max-w-[240px] overflow-hidden rounded-sm border",
        "bg-surface-overlay text-foreground px-3 py-1.5 text-xs shadow-md",
        // A-04 fade-only animation (100ms; reduced-motion zeroed by token cascade)
        "animate-in fade-in-0 duration-100",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-100",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

// ─── TooltipArrow ──────────────────────────────────────────────────────────────

/** TooltipArrow — optional 6×6px triangle that points at the trigger. */
const TooltipArrow = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Arrow>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Arrow>
>(({ className, width = 6, height = 6, ...props }, ref) => (
  <TooltipPrimitive.Arrow
    ref={ref}
    width={width}
    height={height}
    className={cn("fill-surface-overlay", className)}
    {...props}
  />
));
TooltipArrow.displayName = "TooltipArrow";

// ─── Exports ──────────────────────────────────────────────────────────────────

export { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent, TooltipArrow };
