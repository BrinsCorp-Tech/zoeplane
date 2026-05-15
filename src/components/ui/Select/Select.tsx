/** @see docs/design/components/Select-spec.md */
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon/Icon";

// ─── Size scale (Select-spec §2) ───────────────────────────────────────────────

export type SelectTriggerSize = "sm" | "md" | "lg";

const TRIGGER_SIZE_MAP: Record<SelectTriggerSize, string> = {
  sm: "h-8",
  md: "h-9",
  lg: "h-10",
};

// ─── Root / Value / Icon ────────────────────────────────────────────────────────

/** SelectRoot — open-state + value controller. `value` / `onValueChange`. */
const SelectRoot = SelectPrimitive.Root;

/** SelectGroup — logical grouping (no visual output). */
const SelectGroup = SelectPrimitive.Group;

/**
 * SelectValue — renders the current value's label (or placeholder when unset).
 * Placeholder copy: "Select <object>…" pattern per spec §6.
 */
const SelectValue = SelectPrimitive.Value;

// ─── SelectIcon ───────────────────────────────────────────────────────────────

/** SelectIcon — chevron-down trailing affix on the trigger. */
const SelectIcon = SelectPrimitive.Icon;

// ─── SelectTrigger ────────────────────────────────────────────────────────────

export interface SelectTriggerProps extends React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Trigger
> {
  /**
   * Height tier: sm (32 px) / md (36 px, default) / lg (40 px).
   * md matches Input default height for visual alignment in forms.
   */
  size?: SelectTriggerSize;
}

/**
 * SelectTrigger — the button surface.
 *
 * Token contract (Select-spec §1 + §3):
 *   - bg-input background, border, rounded-md
 *   - text-foreground (value) / text-foreground-subtle (placeholder)
 *   - hover: border-strong 150ms ease-out (A-10)
 *   - focus-visible: border-accent + ring-ring 2px offset
 *   - open: chevron rotates 180°
 *   - error: border-danger (injected via aria-invalid from FormField)
 *   - disabled: bg-surface-muted, text-foreground-disabled, opacity-60
 *
 * @see docs/design/components/Select-spec.md
 */
const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, size = "md", ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      // Layout
      "group flex w-full items-center justify-between gap-2 rounded-md border px-3 text-sm",
      "outline-none select-none",
      // Height tier
      TRIGGER_SIZE_MAP[size],
      // Token: surface
      "bg-input border-border text-foreground",
      // Placeholder
      "data-[placeholder]:text-foreground-subtle",
      // Hover: border strengthens (A-10 150ms ease-out)
      "transition-colors duration-150 ease-out",
      "hover:border-border-strong",
      // Focus-visible: accent border + ring
      "focus-visible:border-accent",
      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2",
      // Error: injected via aria-invalid from FormField
      "aria-[invalid=true]:border-danger",
      // Disabled
      "disabled:bg-surface-muted disabled:text-foreground-disabled disabled:cursor-not-allowed disabled:opacity-60",
      // Truncate value text
      "[&>span]:truncate [&>span]:whitespace-nowrap",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      {/* Chevron rotates 180° when open (A-10). motion-reduce: no rotation. */}
      <span
        className={cn(
          "shrink-0 transition-transform duration-150 ease-out",
          "motion-reduce:transition-none",
          "group-data-[state=open]:rotate-180",
        )}
      >
        <Icon name="chevron-down" size="sm" aria-hidden="true" />
      </span>
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

// ─── SelectScrollUpButton / SelectScrollDownButton ────────────────────────────

/**
 * SelectScrollUpButton — renders at top of listbox when items overflow.
 * Auto-renders; no manual wiring needed.
 */
const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <Icon name="chevron-up" size="sm" aria-hidden="true" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = "SelectScrollUpButton";

/**
 * SelectScrollDownButton — renders at bottom of listbox when items overflow.
 * Auto-renders; no manual wiring needed.
 */
const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <Icon name="chevron-down" size="sm" aria-hidden="true" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = "SelectScrollDownButton";

// ─── SelectContent ────────────────────────────────────────────────────────────

export type SelectContentProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>;

/**
 * SelectContent — portaled listbox panel.
 *
 * Token contract (Select-spec §1):
 *   - bg-surface-overlay, border-border, rounded-md, shadow-md
 *
 * Motion (A-11 family — Select-spec §5):
 *   - Open: 150ms fade-in + scale 0.97→1.0
 *   - Close: 100ms fade-out + scale 1.0→0.97
 *   - Reduced-motion: fade only (globals.css duration zeroing)
 *
 * @see docs/design/components/Select-spec.md
 */
const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = "popper", sideOffset = 4, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={sideOffset}
      className={cn(
        // Layout
        "relative z-50 min-w-[8rem] overflow-hidden rounded-md border",
        // Token: surface
        "bg-surface-overlay border-border text-foreground shadow-md",
        // Collision-aware height cap
        "max-h-[--radix-select-content-available-height] overflow-x-hidden overflow-y-auto",
        // A-11 open: fade-in 150ms + scale 0.97→1.0
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=open]:duration-150",
        // A-11 close: fade-out 100ms + scale 1.0→0.97
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] data-[state=closed]:duration-100",
        // Side slide-ins
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        "origin-[--radix-select-content-transform-origin]",
        // Popper offset (match trigger width, align below trigger)
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

// ─── SelectLabel ──────────────────────────────────────────────────────────────

/**
 * SelectLabel — non-interactive section heading inside SelectContent.
 * Use to group related options (Select-spec §6 grouping rules).
 */
const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("text-foreground-muted py-1.5 pr-2 pl-2 text-xs font-semibold", className)}
    {...props}
  />
));
SelectLabel.displayName = "SelectLabel";

// ─── SelectItem ───────────────────────────────────────────────────────────────

/**
 * SelectItem — individual option row (role="option").
 *
 * States (Select-spec §3):
 *   - default: text-foreground, transparent bg, pl-8 for check indicator space
 *   - highlighted (data-highlighted): bg-accent-muted
 *   - selected (data-state="checked"): check glyph in text-accent
 *   - disabled: opacity-50, pointer-events-none
 */
const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      // Layout — pl-8 reserves space for check indicator on selected item
      "relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm",
      "outline-none select-none",
      // Token: default
      "text-foreground",
      // Highlighted (arrow-key focus)
      "data-[highlighted]:bg-accent-muted data-[highlighted]:text-foreground",
      // Disabled
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    {/* Check glyph — only renders when this item is selected */}
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Icon name="check" size="xs" className="text-accent" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";

// ─── SelectItemIndicator ──────────────────────────────────────────────────────

/** SelectItemIndicator — re-export for consumers who need explicit control. */
const SelectItemIndicator = SelectPrimitive.ItemIndicator;

// ─── SelectSeparator ──────────────────────────────────────────────────────────

/**
 * SelectSeparator — visual divider between option groups (role="separator").
 */
const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("bg-border -mx-1 my-1 h-px", className)}
    {...props}
  />
));
SelectSeparator.displayName = "SelectSeparator";

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  SelectRoot,
  SelectGroup,
  SelectValue,
  SelectIcon,
  SelectTrigger,
  SelectScrollUpButton,
  SelectScrollDownButton,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectItemIndicator,
  SelectSeparator,
};
