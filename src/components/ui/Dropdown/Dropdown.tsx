/** @see docs/design/components/Dropdown-spec.md */
import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Root / Trigger / Portal / Group / RadioGroup ─────────────────────────────

/** DropdownMenuRoot — open-state controller. */
const DropdownMenuRoot = DropdownMenuPrimitive.Root;

/** DropdownMenuTrigger — element opening the menu. Receives aria-haspopup + aria-expanded. */
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

/** DropdownMenuPortal — Radix portal wrapper (used internally by Content). */
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

/** DropdownMenuGroup — logical grouping of items (no visual output). */
const DropdownMenuGroup = DropdownMenuPrimitive.Group;

/** DropdownMenuRadioGroup — mutually exclusive item group. */
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

/** DropdownMenuSub — sub-menu root (v2 scope; exported for forward-compatibility). */
const DropdownMenuSub = DropdownMenuPrimitive.Sub;

// ─── DropdownMenuContent ──────────────────────────────────────────────────────

export type DropdownMenuContentProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
>;

/**
 * DropdownMenuContent — portaled panel carrying role="menu".
 *
 * Token contract (Dropdown-spec §2):
 *   - bg-surface-overlay  (popover alias)
 *   - text-foreground
 *   - radius-md
 *   - shadow-md
 *   - align="start" default (left edge aligns with trigger)
 *
 * Motion (A-11 family — fade + scale 0.97→1.0 / 1.0→0.97; Dropdown-spec §5):
 *   - Open:  150ms fade-in + scale 0.97→1.0
 *   - Close: 100ms fade-out + scale 1.0→0.97
 *   - Reduced-motion: fade only (no scale), handled by globals.css duration zeroing
 */
const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  DropdownMenuContentProps
>(({ className, sideOffset = 4, align = "start", ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cn(
        // Layout
        "border-border z-50 min-w-[8rem] overflow-hidden rounded-md border",
        "bg-surface-overlay text-foreground p-1 shadow-md",
        // Collision-aware height cap
        "max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-x-hidden overflow-y-auto",
        // A-11 open: fade-in 150ms + scale 0.97→1.0
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=open]:duration-150",
        // A-11 close: fade-out 100ms + scale 1.0→0.97
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] data-[state=closed]:duration-100",
        // Collision side slide-ins
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        "origin-[--radix-dropdown-menu-content-transform-origin]",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

// ─── DropdownMenuItem ─────────────────────────────────────────────────────────

export interface DropdownMenuItemProps extends React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Item
> {
  /** When true, indents the item left (for items that align with checkbox/radio items). */
  inset?: boolean;
}

/**
 * DropdownMenuItem — single action row (role="menuitem").
 * Activates on Enter / click. Closes the menu on select.
 */
const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  DropdownMenuItemProps
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      // Layout & typography
      "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none",
      // A-10 item focus/hover: 100ms color transition
      "transition-colors duration-100",
      // Hover / keyboard focus
      "focus:bg-hover-overlay focus:text-foreground",
      // Disabled
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      // SVG sizing (leading icons)
      "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

// ─── DropdownMenuCheckboxItem ─────────────────────────────────────────────────

/**
 * DropdownMenuCheckboxItem — toggleable item (role="menuitemcheckbox").
 * Menu stays open across toggles.
 */
const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none",
      "transition-colors duration-100",
      "focus:bg-hover-overlay focus:text-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="text-accent h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

// ─── DropdownMenuRadioItem ────────────────────────────────────────────────────

/**
 * DropdownMenuRadioItem — mutually exclusive option (role="menuitemradio").
 * Menu closes on selection.
 */
const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none",
      "transition-colors duration-100",
      "focus:bg-hover-overlay focus:text-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="fill-accent text-accent h-2 w-2" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

// ─── DropdownMenuLabel ────────────────────────────────────────────────────────

export interface DropdownMenuLabelProps extends React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Label
> {
  inset?: boolean;
}

/** DropdownMenuLabel — non-interactive section heading (decorative). */
const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  DropdownMenuLabelProps
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "text-foreground-muted px-2 py-1.5 text-xs font-semibold",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

// ─── DropdownMenuSeparator ────────────────────────────────────────────────────

/** DropdownMenuSeparator — visual divider (role="separator"). */
const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("bg-border -mx-1 my-1 h-px", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

// ─── DropdownMenuShortcut ─────────────────────────────────────────────────────

/** DropdownMenuShortcut — tail-aligned keyboard shortcut indicator (decorative). */
const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />
);
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

// ─── DropdownMenuSubTrigger ───────────────────────────────────────────────────

/** DropdownMenuSubTrigger — sub-menu trigger (v2 scope; exported for forward-compatibility). */
const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none",
      "focus:bg-hover-overlay data-[state=open]:bg-hover-overlay",
      "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

/** DropdownMenuSubContent — sub-menu panel (v2 scope; exported for forward-compatibility). */
const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "border-border bg-surface-overlay text-foreground z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-lg",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
      "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
      "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      "origin-[--radix-dropdown-menu-content-transform-origin]",
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuRadioGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
