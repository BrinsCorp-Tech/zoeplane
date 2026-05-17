/**
 * PrimaryWorkArea — main content slot (Story 2.9, Layout tier P0)
 *
 * - <main role="main"> wrapper with flex: 1 and overflow-y: auto
 * - Renders {children} — zustand-driven content slot pattern
 * - Epic 03 wires actual content routing into this slot
 * - NO react-router-dom dependency — per AC #7 fallback (zustand-driven)
 *
 * This component intentionally has no routing logic. It is a semantic
 * wrapper that signals "primary content area" to assistive technology.
 * The HostShell (Story 2.8) places this in the center of the flex layout
 * alongside Sidebar and Inspector.
 *
 * @see docs/design/ux-spec.md §8.2 Layout tier
 */
import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PrimaryWorkAreaProps {
  /** Route content rendered inside the main region. */
  children?: React.ReactNode;

  /**
   * Accessible label for the main region.
   * @default "Main content"
   */
  "aria-label"?: string;

  /** Optional className for the root element. */
  className?: string;
}

// ─── PrimaryWorkArea ───────────────────────────────────────────────────────────

/**
 * PrimaryWorkArea — semantic main content slot.
 *
 * Flex: 1 ensures it fills all remaining horizontal space between Sidebar
 * and Inspector in the HostShell layout. overflow-y: auto enables per-route
 * independent scrolling.
 */
export function PrimaryWorkArea({
  children,
  "aria-label": ariaLabel = "Main content",
  className,
}: PrimaryWorkAreaProps): React.ReactElement {
  return (
    <main
      role="main"
      aria-label={ariaLabel}
      className={cn("primary-work-area", className)}
      style={{
        flex: 1,
        overflowY: "auto",
        background: "var(--color-background)",
        color: "var(--color-foreground)",
        // Minimum width prevents layout collapse when Sidebar + Inspector are
        // both expanded. Content scrolls rather than overflows.
        minWidth: 0,
      }}
    >
      {children ?? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "var(--color-foreground-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          No content — Epic 03 wires route rendering here.
        </div>
      )}
    </main>
  );
}
