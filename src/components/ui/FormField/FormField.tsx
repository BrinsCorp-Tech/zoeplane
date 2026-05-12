/** @see docs/design/components/FormField-spec.md */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

// ─── Context ───────────────────────────────────────────────────────────────────

interface FormFieldContextValue {
  controlId: string;
  helperId: string;
  errorId: string;
  required: boolean;
  error: string | undefined;
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

function useFormFieldContext(): FormFieldContextValue {
  const ctx = React.useContext(FormFieldContext);
  if (!ctx) {
    throw new Error(
      "[FormField] FormLabel / FormControl / FormHelperText / FormErrorText must be rendered inside <FormField>.",
    );
  }
  return ctx;
}

// ─── FormField (root) ─────────────────────────────────────────────────────────

export interface FormFieldProps {
  /** When true, injects aria-required on the control and appends the * marker to the label. */
  required?: boolean;
  /**
   * Inline validation error string. When defined:
   *   - FormErrorText renders it (with A-32 reveal animation).
   *   - FormControl receives aria-invalid="true" and aria-describedby links to the error id.
   */
  error?: string;
  /**
   * Layout direction.
   * - `stacked` (default): vertical column.
   * - `inline`: label-left, control-right (compact rows in Settings panes).
   */
  layout?: "stacked" | "inline";
  className?: string;
  children: React.ReactNode;
}

/**
 * FormField — accessible form field wrapper.
 *
 * Composes FormLabel + FormControl (Radix Slot) + FormHelperText + FormErrorText
 * into a single label-associated, error-aware unit. Uses React.useId() to generate
 * stable IDs — no developer-supplied name prop required.
 *
 * @see docs/design/components/FormField-spec.md
 */
function FormField({
  required = false,
  error,
  layout = "stacked",
  className,
  children,
}: FormFieldProps) {
  const stem = React.useId();
  const controlId = `${stem}-control`;
  const helperId = `${stem}-helper`;
  const errorId = `${stem}-error`;

  const ctx = React.useMemo<FormFieldContextValue>(
    () => ({ controlId, helperId, errorId, required, error }),
    [controlId, helperId, errorId, required, error],
  );

  return (
    <FormFieldContext.Provider value={ctx}>
      <div
        className={cn(
          layout === "stacked"
            ? "flex flex-col gap-[var(--space-1_5,0.375rem)]"
            : "grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-[var(--space-1_5,0.375rem)]",
          className,
        )}
      >
        {children}
      </div>
    </FormFieldContext.Provider>
  );
}

// ─── FormLabel ────────────────────────────────────────────────────────────────

export type FormLabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

/**
 * FormLabel — visible label associated with the FormControl slot.
 * Automatically renders the required * marker when FormField has required=true.
 */
const FormLabel = React.forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ className, children, ...props }, ref) => {
    const { controlId, required } = useFormFieldContext();

    return (
      <label
        ref={ref}
        htmlFor={controlId}
        className={cn("text-foreground text-sm leading-none font-medium", className)}
        {...props}
      >
        {children}
        {required && (
          <span className="text-danger ml-0.5" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
    );
  },
);
FormLabel.displayName = "FormLabel";

// ─── FormControl ──────────────────────────────────────────────────────────────

export interface FormControlProps {
  /**
   * When true renders a Radix Slot — the child receives all injected ARIA props.
   * Use asChild when wrapping a custom control (Input, Textarea, etc.).
   * Default: renders a <div> (rarely needed, use asChild for real controls).
   */
  asChild?: boolean;
  children: React.ReactNode;
}

/**
 * FormControl — injects id, aria-required, aria-invalid, and aria-describedby
 * onto the wrapped form control via Radix Slot.
 */
function FormControl({ asChild = false, children }: FormControlProps) {
  const { controlId, helperId, errorId, required, error } = useFormFieldContext();

  // Build aria-describedby per spec §4:
  //   - When error is active: list errorId first, then helperId (AT reads error then helper).
  //   - When no error: list only helperId (if FormHelperText is mounted, the ID is meaningful).
  // We always include both IDs so the wiring is stable regardless of whether FormHelperText
  // is rendered — a stale ID pointing to nothing is harmless for AT.
  const describedBy =
    [error ? errorId : undefined, helperId].filter(Boolean).join(" ") || undefined;

  const injected: Record<string, unknown> = {
    id: controlId,
    ...(required ? { "aria-required": "true" } : {}),
    ...(error ? { "aria-invalid": "true" as const } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
  };

  const Comp = asChild ? Slot : "div";

  return <Comp {...injected}>{children}</Comp>;
}

// ─── FormHelperText ───────────────────────────────────────────────────────────

export type FormHelperTextProps = React.HTMLAttributes<HTMLParagraphElement>;

/**
 * FormHelperText — optional supplementary copy beneath the control.
 * Renders as a <p> with text-xs foreground-muted styling.
 */
const FormHelperText = React.forwardRef<HTMLParagraphElement, FormHelperTextProps>(
  ({ className, ...props }, ref) => {
    const { helperId } = useFormFieldContext();

    return (
      <p
        ref={ref}
        id={helperId}
        className={cn("text-foreground-muted text-xs", className)}
        {...props}
      />
    );
  },
);
FormHelperText.displayName = "FormHelperText";

// ─── FormErrorText ────────────────────────────────────────────────────────────

export type FormErrorTextProps = React.HTMLAttributes<HTMLParagraphElement>;

/**
 * FormErrorText — inline validation error announcement.
 *
 * Carries role="alert" AND aria-live="polite" (operator decision 5 — non-blocking
 * inline validation canonical pattern: role="alert" for semantic, aria-live="polite"
 * overrides role="alert"'s implicit assertive priority).
 *
 * A-32 reveal animation: 200ms slide-down + fade-in; reduced-motion = 100ms fade only.
 */
const FormErrorText = React.forwardRef<HTMLParagraphElement, FormErrorTextProps>(
  ({ className, children, ...props }, ref) => {
    const { errorId } = useFormFieldContext();

    return (
      <p
        ref={ref}
        id={errorId}
        role="alert"
        aria-live="polite"
        className={cn(
          "text-danger text-xs",
          // A-32: slide-down + fade reveal
          "animate-in fade-in-0 slide-in-from-top-1 duration-200",
          // A-32 reduced-motion: no slide, instant fade handled by globals.css
          className,
        )}
        {...props}
      >
        {children}
      </p>
    );
  },
);
FormErrorText.displayName = "FormErrorText";

// ─── Exports ──────────────────────────────────────────────────────────────────

export { FormField, FormLabel, FormControl, FormHelperText, FormErrorText };
