/** @see docs/design/components/Checkbox-spec.md */
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon/Icon";

// ─── Checkbox ────────────────────────────────────────────────────────────────

export type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

/**
 * Checkbox — boolean-toggle primitive with three-state support.
 *
 * Supported states (Checkbox-spec §3):
 *   - unchecked: bg-input, border-2 border-border
 *   - checked: bg-accent, border-accent, check glyph in text-accent-foreground
 *   - indeterminate: bg-accent, border-accent, minus glyph in text-accent-foreground
 *   - hover (unchecked): border-border-strong 150ms ease-out (A-10)
 *   - hover (checked/indeterminate): bg-accent-hover
 *   - focus-visible: ring-ring 2px offset
 *   - error: border-danger (unchecked only; filled state stays bg-accent per spec)
 *   - disabled: opacity-60, cursor-not-allowed
 *
 * Glyph: <Icon name="check" size="xs" /> for checked;
 *        <Icon name="minus" size="xs" /> for indeterminate.
 * The minus icon was added to the IconName allowlist in Step 0.5 (Batch F).
 *
 * Label association: wrap in FormField (FormControl asChild) for form contexts,
 * or wrap in a <label> directly for inline contexts. Never render standalone.
 *
 * @see docs/design/components/Checkbox-spec.md
 */
const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        // Layout: 16×16 square with centered glyph
        "grid h-4 w-4 shrink-0 place-content-center rounded-sm",
        // Border
        "border-border border-2",
        // Token: unchecked surface
        "bg-input",
        // A-10 hover: border-strong 150ms ease-out (unchecked only)
        "transition-colors duration-150 ease-out",
        "hover:border-border-strong",
        // Checked / indeterminate: filled surface
        "data-[state=checked]:bg-accent data-[state=checked]:border-accent data-[state=checked]:text-accent-foreground",
        "data-[state=indeterminate]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:text-accent-foreground",
        // Focus-visible: ring
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        // Error: border-danger (consumer sets via aria-invalid or directly)
        "aria-[invalid=true]:border-danger",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {/* CheckboxIndicatorGlyph: renders <Check> when checked, <Minus> when indeterminate.
          Radix's <Indicator> already gates the render to checked|indeterminate states;
          this helper picks the glyph based on props.checked. */}
        <CheckboxIndicatorGlyph checked={props.checked} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  ),
);
Checkbox.displayName = "Checkbox";

// ─── CheckboxIndicatorGlyph ────────────────────────────────────────────────────

/**
 * Renders the correct glyph based on the checked prop.
 * - checked = true → check icon
 * - checked = "indeterminate" → minus icon
 * Radix only renders the Indicator slot when state is NOT unchecked,
 * so we don't need to handle the unchecked case here.
 */
function CheckboxIndicatorGlyph({ checked }: { checked?: boolean | "indeterminate" }) {
  if (checked === "indeterminate") {
    return <Icon name="minus" size="xs" aria-hidden="true" />;
  }
  return <Icon name="check" size="xs" aria-hidden="true" />;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { Checkbox };
