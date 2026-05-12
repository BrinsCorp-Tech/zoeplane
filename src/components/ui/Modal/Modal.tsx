/** @see docs/design/components/Modal-spec.md */
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon/Icon";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModalVariant = "default" | "destructive" | "expanded-scope-confirmation";
export type ModalSize = "sm" | "md" | "lg";

// ─── ModalRoot / ModalTrigger ─────────────────────────────────────────────────

/** ModalRoot — open-state controller. */
const ModalRoot = DialogPrimitive.Root;

/** ModalTrigger — element that opens the modal. Receives aria-haspopup="dialog". */
const ModalTrigger = DialogPrimitive.Trigger;

// ─── ModalScrim ────────────────────────────────────────────────────────────────

/**
 * ModalScrim — full-window backdrop.
 *
 * A-07/A-08: Scrim fades in 200ms on open, fades out 150ms on close.
 */
const ModalScrim = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50",
      // A-07 open: fade-in 200ms
      "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200",
      // A-08 close: fade-out 150ms
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150",
      className,
    )}
    {...props}
  />
));
ModalScrim.displayName = "ModalScrim";

// ─── ModalContent ──────────────────────────────────────────────────────────────

export interface ModalContentProps extends Omit<
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  "role"
> {
  /** Visual variant governing color framing and interaction contract. */
  variant?: ModalVariant;
  /** Max-width tier: sm = 400px, md = 560px (default), lg = 720px. */
  size?: ModalSize;
  /**
   * When false, clicking the scrim does NOT dismiss the modal.
   * Always false for destructive variant (operator decision 4).
   */
  dismissOnScrim?: boolean;
  /**
   * Semantic role. Use "alertdialog" for destructive confirmations.
   * Defaults to "dialog".
   */
  role?: "dialog" | "alertdialog";
  /**
   * Ref to the element that should receive focus on open.
   * Destructive variant should point at the Cancel button
   * (prevents Enter confirming destruction on open — spec §4).
   */
  initialFocus?: React.RefObject<HTMLElement | null>;
  /**
   * Ref to the element that should receive focus when the modal closes
   * (used when modal was opened programmatically without a ModalTrigger).
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const SIZE_MAP: Record<ModalSize, string> = {
  sm: "max-w-[400px]",
  md: "max-w-[560px]",
  lg: "max-w-[720px]",
};

/**
 * ModalContent — portaled dialog frame.
 *
 * Owns: focus trap, Escape dismiss, scroll lock.
 * Does NOT own: custom keyboard logic — Radix handles it.
 *
 * Token contract:
 *   - bg-surface-overlay
 *   - border border-border
 *   - radius-lg
 *   - shadow-lg
 *
 * Motion (A-07/A-08):
 *   - Open:  scrim fade 200ms; frame fade + scale 0.96→1.0 over 200ms
 *   - Close: scrim fade 150ms; frame fade + scale 1.0→0.96 over 150ms
 *   - Reduced-motion: frame fade only (scale zeroed by token cascade)
 */
const ModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ModalContentProps
>(
  (
    {
      className,
      children,
      variant = "default",
      size = "md",
      dismissOnScrim,
      role = "dialog",
      initialFocus,
      returnFocusRef,
      ...props
    },
    ref,
  ) => {
    // Destructive variant: scrim dismiss is off by default (operator decision 4)
    const noScrimDismiss =
      dismissOnScrim === false || (variant === "destructive" && dismissOnScrim !== true);

    function handlePointerDownOutside(
      e: Parameters<
        NonNullable<
          React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>["onPointerDownOutside"]
        >
      >[0],
    ) {
      if (noScrimDismiss) e.preventDefault();
    }

    function handleOpenAutoFocus(e: Event) {
      if (initialFocus?.current) {
        e.preventDefault();
        initialFocus.current.focus();
      }
    }

    function handleCloseAutoFocus(e: Event) {
      if (returnFocusRef?.current) {
        e.preventDefault();
        returnFocusRef.current.focus();
      }
    }

    return (
      <DialogPrimitive.Portal>
        <ModalScrim />
        <DialogPrimitive.Content
          ref={ref}
          role={role}
          onPointerDownOutside={handlePointerDownOutside}
          onOpenAutoFocus={handleOpenAutoFocus}
          onCloseAutoFocus={handleCloseAutoFocus}
          className={cn(
            // Positioning
            "fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
            // Sizing
            "w-[calc(100vw-var(--space-8,2rem))]",
            SIZE_MAP[size],
            // Surface
            "border-border bg-surface-overlay grid gap-0 rounded-lg border shadow-lg",
            // Max-height with sticky header/footer — body scrolls
            "max-h-[calc(100vh-var(--space-16,4rem))]",
            // A-07 open: fade + scale 0.96→1.0 over 200ms
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.96] data-[state=open]:duration-200",
            // A-08 close: fade + scale 1.0→0.96 over 150ms
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.96] data-[state=closed]:duration-150",
            // Slide from center on enter/exit
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            className,
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
ModalContent.displayName = "ModalContent";

// ─── ModalHeader ──────────────────────────────────────────────────────────────

/** ModalHeader — container for title + description + close button. */
const ModalHeader = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <header ref={ref} className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
  ),
);
ModalHeader.displayName = "ModalHeader";

// ─── ModalTitle ───────────────────────────────────────────────────────────────

/**
 * ModalTitle — REQUIRED for a11y (labels the dialog via aria-labelledby).
 * If a visual title is not desired, wrap in Radix VisuallyHidden.
 */
const ModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-foreground text-lg leading-none font-semibold tracking-tight", className)}
    {...props}
  />
));
ModalTitle.displayName = "ModalTitle";

// ─── ModalDescription ─────────────────────────────────────────────────────────

/**
 * ModalDescription — optional; referenced via aria-describedby.
 * Sets the dialog's purpose context.
 */
const ModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-foreground-muted text-sm", className)}
    {...props}
  />
));
ModalDescription.displayName = "ModalDescription";

// ─── ModalFooter ──────────────────────────────────────────────────────────────

/**
 * ModalFooter — right-aligned action row.
 * Convention: Cancel on left, primary action on right.
 */
const ModalFooter = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <footer
      ref={ref}
      className={cn(
        "border-border flex items-center justify-end gap-2 border-t px-6 py-4",
        className,
      )}
      {...props}
    />
  ),
);
ModalFooter.displayName = "ModalFooter";

// ─── ModalBody ────────────────────────────────────────────────────────────────

/**
 * ModalBody — scrollable content region.
 *
 * Modal-spec §8 (edge cases): "ModalContent sets max-height; body region gets
 * `overflow-y: auto`. Header and footer remain pinned."
 *
 * Place ModalBody between ModalHeader and ModalFooter when content may overflow
 * the max-height constraint. Header and footer stay sticky; only the body scrolls.
 */
const ModalBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-4", className)}
      {...props}
    />
  ),
);
ModalBody.displayName = "ModalBody";

// ─── ModalClose ───────────────────────────────────────────────────────────────

/**
 * ModalClose — icon-only × button in the top-right of the header.
 * Not rendered for alertdialog (destructive) variant per spec §6.
 */
const ModalClose = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Close
    ref={ref}
    aria-label="Close"
    className={cn(
      "absolute top-4 right-4 rounded-sm opacity-70",
      "ring-offset-background transition-opacity",
      "hover:opacity-100",
      "focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none",
      "disabled:pointer-events-none",
      className,
    )}
    {...props}
  >
    <Icon name="x" size="sm" aria-hidden="true" />
  </DialogPrimitive.Close>
));
ModalClose.displayName = "ModalClose";

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  ModalRoot,
  ModalTrigger,
  ModalScrim,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose,
};
