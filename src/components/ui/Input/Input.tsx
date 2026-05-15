/** @see docs/design/components/Input-spec.md */
import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InputProps extends React.ComponentProps<"input"> {
  /**
   * Optional leading affix (e.g., a search icon, currency symbol, or "http://" prefix).
   * When set the input receives additional left-padding to clear the affix content.
   * The affix is absolute-positioned inside the input border.
   */
  leadingAffix?: React.ReactNode;
  /**
   * Optional trailing affix (e.g., a clear button, show/hide password toggle, or unit suffix).
   * When set the input receives additional right-padding to clear the affix content.
   * The affix is absolute-positioned inside the input border.
   */
  trailingAffix?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Input — text input primitive.
 *
 * - Raw shadcn primitive with leading/trailing affix slot props.
 * - Does NOT render a label — use FormField (Batch E) for labelled fields.
 * - Numeric inputs: use `type="text" inputMode="numeric" pattern="[0-9]*"` (not type="number").
 * - Error state: apply `aria-invalid="true"` and `className="border-danger"` from the consumer.
 *
 * @see docs/design/components/Input-spec.md
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leadingAffix, trailingAffix, ...props }, ref) => {
    // When affixes are present we wrap in a relative container and absolute-position them.
    if (leadingAffix || trailingAffix) {
      return (
        <div className="relative flex items-center">
          {leadingAffix && (
            <div className="text-muted-foreground pointer-events-none absolute left-3 flex items-center">
              {leadingAffix}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            className={cn(
              // Base styles — matches spec §3 default state
              "border-input bg-input text-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm",
              // Placeholder
              "placeholder:text-muted-foreground",
              // Focus
              "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              // Hover — border-strong in 150 ms (A-10); relies on tokens zeroing durations for reduced-motion
              "transition-colors duration-150",
              // Disabled state
              "disabled:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60",
              // Read-only state (bg-surface-muted but NOT disabled color, so user can read)
              "read-only:bg-surface-muted read-only:cursor-default",
              // Affix padding overrides
              leadingAffix ? "pl-9" : "",
              trailingAffix ? "pr-9" : "",
              className,
            )}
            {...props}
          />
          {trailingAffix && (
            <div className="text-muted-foreground absolute right-3 flex items-center">
              {trailingAffix}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "border-input bg-input text-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm",
          "placeholder:text-muted-foreground",
          "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          "transition-colors duration-150",
          "disabled:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60",
          "read-only:bg-surface-muted read-only:cursor-default",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
