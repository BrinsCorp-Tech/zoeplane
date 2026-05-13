/** @see docs/design/components/Tabs-spec.md */
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TabsVariant = "underline" | "pill";
export type TabsSize = "sm" | "md" | "lg";

// ─── Size scale (Tabs-spec §2) ────────────────────────────────────────────────

const TABS_SIZE_MAP: Record<TabsSize, string> = {
  sm: "h-8",
  md: "h-9",
  lg: "h-10",
};

// ─── TabsRoot ─────────────────────────────────────────────────────────────────

/** TabsRoot — selection-state controller. `value` / `defaultValue` / `onValueChange`. */
const TabsRoot = TabsPrimitive.Root;

// ─── TabsList ─────────────────────────────────────────────────────────────────

export interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  /**
   * Visual variant: underline (default) or pill.
   * - underline: full-width strip with border-b; active tab has 2px accent underline.
   * - pill: muted track; active tab gets bg-surface rounded pill.
   */
  variant?: TabsVariant;
  /**
   * Height tier: sm (32px) / md (36px, default) / lg (40px).
   * Applied to each Tab via CSS var or className threading.
   */
  size?: TabsSize;
}

/**
 * TabsList — container for Tab triggers (role="tablist").
 *
 * Variant treatment (Tabs-spec §1 + §2):
 *   - underline: border-b border-border; active tab carries 2px border-b-accent
 *   - pill: bg-surface-muted p-1 rounded-md track; active tab bg-surface shadow-sm
 *
 * @see docs/design/components/Tabs-spec.md
 */
const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant = "underline", size: _size, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      data-variant={variant}
      className={cn(
        "flex items-center",
        // Underline variant: border-b track
        variant === "underline" && "border-border gap-0 border-b",
        // Pill variant: muted track container
        variant === "pill" && "bg-surface-muted inline-flex gap-1 rounded-md p-1",
        className,
      )}
      {...props}
    />
  ),
);
TabsList.displayName = "TabsList";

// ─── Tab ─────────────────────────────────────────────────────────────────────

export interface TabProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  /**
   * Visual variant — inherited from TabsList when using the compound pattern.
   * Pass explicitly when using Tab standalone.
   */
  variant?: TabsVariant;
  /** Height tier — inherited from TabsList compound pattern. */
  size?: TabsSize;
}

/**
 * Tab — single tab trigger (role="tab").
 *
 * States (Tabs-spec §3):
 *   - default (inactive): text-foreground-muted, transparent bg
 *   - hover: text-foreground, bg-hover-overlay 150ms (A-10)
 *   - focus-visible: ring-ring 2px offset
 *   - active (data-state="active"):
 *       underline — text-foreground + 2px border-b-accent
 *       pill — text-foreground + bg-surface + shadow-sm
 *   - disabled: opacity-50, cursor-not-allowed
 *
 * Active-tab text weight does NOT shift (spec §6 — no visual jitter).
 *
 * @see docs/design/components/Tabs-spec.md
 */
const Tab = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, TabProps>(
  ({ className, variant = "underline", size = "md", ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        // Layout
        "inline-flex items-center justify-center gap-2 px-3 text-sm font-medium whitespace-nowrap",
        "outline-none select-none",
        // Height
        TABS_SIZE_MAP[size],
        // A-10 hover/focus color transition 150ms ease-out
        "transition-colors duration-150 ease-out",
        "motion-reduce:transition-none",
        // Inactive: muted text
        "text-foreground-muted",
        // Hover: text + overlay
        "hover:text-foreground hover:bg-hover-overlay",
        // Focus-visible: ring
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2",
        // Active: shared
        "data-[state=active]:text-foreground",
        // Underline variant active: 2px bottom border in accent
        variant === "underline" && [
          "mb-[-2px] border-b-2 border-transparent",
          "data-[state=active]:border-b-accent",
          // No additional bg change in underline — active indicator IS the border
          "data-[state=active]:bg-transparent",
          // Hover should not compete with active marker
          "data-[state=active]:hover:bg-transparent",
          "rounded-none",
        ],
        // Pill variant active: bg-surface + shadow
        variant === "pill" && [
          "rounded-sm",
          "data-[state=active]:bg-surface data-[state=active]:shadow-sm",
          "data-[state=active]:hover:bg-surface",
        ],
        // Disabled
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Tab.displayName = "Tab";

// ─── TabPanel ─────────────────────────────────────────────────────────────────

export interface TabPanelProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Content
> {
  /**
   * When true, always mounts the panel even when inactive (Radix `forceMount`).
   * Useful when the panel owns state that should persist across tab switches.
   * Trade-off: all panels render simultaneously — heavier initial render.
   */
  forceMount?: true;
}

/**
 * TabPanel — content region (role="tabpanel").
 *
 * Panel content swap (Tabs-spec §3 + §5):
 *   - Default: 100ms fade-in on newly-active panel. Previous panel unmounts.
 *   - Reduced-motion: instant swap, no fade.
 *
 * @see docs/design/components/Tabs-spec.md
 */
const TabPanel = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, TabPanelProps>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-2 outline-none",
        // Focus-visible: ring for keyboard users who Tab into the panel
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2",
        // Panel content fade-in 100ms on activation (A-10 family)
        "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-100",
        // Reduced-motion: handled by globals.css duration cascade
        "motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  ),
);
TabPanel.displayName = "TabPanel";

// ─── Exports ──────────────────────────────────────────────────────────────────

export { TabsRoot, TabsList, Tab, TabPanel };
