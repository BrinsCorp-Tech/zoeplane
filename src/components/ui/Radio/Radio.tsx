/** @see docs/design/components/Radio-spec.md */
import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

// ─── RadioGroup ───────────────────────────────────────────────────────────────

export type RadioGroupProps = React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>;

/**
 * RadioGroup — mutually-exclusive selection group root.
 *
 * Composes RadioGroupItem rows; manages selected value + roving-tabindex.
 * Wrap in FormField with groupRole="radiogroup" for form contexts — this
 * renders <fieldset> + <legend> for proper AT group-label association.
 *
 * Orientation:
 *   - vertical (default): stacked rows, gap-3 (12px)
 *   - horizontal: inline row, gap-6 — only when labels are ≤ 12 chars
 *     and there is no per-option explanatory copy (spec §2)
 *
 * @see docs/design/components/Radio-spec.md
 */
const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupProps
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    className={cn("group flex flex-col gap-3", className)}
    {...props}
  />
));
RadioGroup.displayName = "RadioGroup";

// ─── RadioGroupItem ───────────────────────────────────────────────────────────

export type RadioGroupItemProps = React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>;

/**
 * RadioGroupItem — individual radio circle button (role="radio").
 *
 * States (Radio-spec §3):
 *   - unchecked: bg-input, border-2 border-border, rounded-full
 *   - unchecked + hover: border-border-strong 150ms ease-out (A-10)
 *   - unchecked + focus-visible: border-accent + ring-ring 2px offset
 *   - checked: border-accent (hollow ring), Indicator renders 8×8 dot bg-accent
 *   - error (group-level): border-danger on unchecked items (injected by FormField)
 *   - disabled: opacity-60, cursor-not-allowed
 *
 * Selected indicator: Radix native RadioGroup.Indicator styled as an 8×8
 * rounded-full dot in bg-accent. NOT the Icon primitive (spec §1 — avoids
 * circle icon allowlist pollution; Radix native gives pixel-perfect centering).
 *
 * A-33 dot animation: scale 0→1 + fade-in 150ms on select.
 * Reduced motion: instant via globals.css class cascade.
 *
 * @see docs/design/components/Radio-spec.md §1 (anatomy + indicator decision)
 */
const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      // Layout: 16×16 circle
      "aspect-square h-4 w-4 shrink-0 rounded-full",
      // Border: 2px, hollow ring
      "border-border border-2",
      // Token: unchecked surface
      "bg-input",
      // A-10 hover: border-strong 150ms ease-out
      "transition-colors duration-150 ease-out",
      "hover:border-border-strong",
      // Checked: accent-colored ring
      "data-[state=checked]:border-accent",
      // Focus-visible: ring
      "focus-visible:ring-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      // Error: border-danger on unchecked items (injected via aria-invalid on RadioGroup)
      // Note: the group root carries aria-invalid; item-level styling uses group selector
      "group-aria-[invalid=true]:border-danger",
      // Disabled
      "disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
    {...props}
  >
    {/* Radix native Indicator — 8×8 dot, bg-accent, centered.
        A-33: scale 0→1 + fade-in 150ms on select; reduced-motion: instant. */}
    <RadioGroupPrimitive.Indicator
      className={cn(
        "flex items-center justify-center",
        // The dot itself
        "after:bg-accent after:block after:h-2 after:w-2 after:rounded-full",
        // A-33 dot scale-in animation
        "data-[state=checked]:animate-in data-[state=checked]:fade-in-0 data-[state=checked]:zoom-in-0 data-[state=checked]:duration-150",
        // Reduced-motion: handled by globals.css duration cascade
      )}
    />
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = "RadioGroupItem";

// ─── RadioGroupIndicator (re-export for flexible composition) ─────────────────

/**
 * RadioGroupIndicator — Radix indicator slot re-export.
 * Consumers can use this directly for custom indicator styling.
 * Prefer the RadioGroupItem default for standard use.
 */
const RadioGroupIndicator = RadioGroupPrimitive.Indicator;

// ─── Exports ──────────────────────────────────────────────────────────────────

export { RadioGroup, RadioGroupItem, RadioGroupIndicator };
