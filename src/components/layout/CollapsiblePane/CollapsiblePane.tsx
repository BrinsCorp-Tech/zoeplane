/**
 * CollapsiblePane — shared collapse primitive for Sidebar and Inspector.
 *
 * Handles:
 *   - Expand/collapse state with optional localStorage persistence
 *   - Open/close animation via Story 2.12 animation catalog classes
 *     (animate-A-05-pane-open / animate-A-05-pane-close)
 *   - Toggle button with proper aria-expanded
 *   - Children rendered when expanded; optionally collapsed to zero width/height
 *
 * Per Story 2.9 Technical Notes: Sidebar and Inspector both use this
 * primitive to share collapse behaviour. Reduced-motion is handled by
 * animations.css (A-05 strategy B — animation: none).
 *
 * The pane renders a fixed-width/height container that collapses to 0.
 * Direction: "horizontal" (width collapse — for Sidebar/Inspector) or
 * "vertical" (height collapse — reserved for future use).
 *
 * @see src/components/layout/Sidebar/Sidebar.tsx
 * @see src/components/layout/Inspector/Inspector.tsx
 */
import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CollapsiblePaneProps {
  /** Initial collapsed state. If storageKey is provided, localStorage wins. */
  defaultCollapsed?: boolean;

  /**
   * localStorage key for persisting collapsed state.
   * When provided, collapsed state survives page reloads.
   */
  storageKey?: string;

  /** Collapse direction. "horizontal" collapses width; "vertical" collapses height. */
  direction?: "horizontal" | "vertical";

  /**
   * Expanded size — the CSS width (horizontal) or height (vertical) when expanded.
   * Accepts any valid CSS value: "240px", "20rem", etc.
   * @default "240px"
   */
  expandedSize?: string;

  /** Content rendered inside the pane when expanded. */
  children: React.ReactNode;

  /**
   * Render prop for the toggle button. Receives `{ collapsed, toggle }`.
   * When omitted, no toggle button is rendered (caller is responsible).
   */
  renderToggle?: (props: { collapsed: boolean; toggle: () => void }) => React.ReactNode;

  /** Optional className for the outer wrapper. */
  className?: string;

  /** Optional className for the content container. */
  contentClassName?: string;

  /** aria-label for the pane container. */
  "aria-label"?: string;

  /** ARIA role override. Default: no role (inherited from consumer). */
  role?: React.AriaRole;
}

// ─── localStorage helpers ──────────────────────────────────────────────────────

function readStorage(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return stored === "true";
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage errors (private browsing, quota exceeded)
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * CollapsiblePane — animate-in/out pane with localStorage persistence.
 * Open/close animations: animate-A-05-pane-open / animate-A-05-pane-close
 * (Story 2.12 catalog). Reduced-motion: handled by animations.css A-05
 * overrides (animation: none — instant per ux-spec §5.1).
 */
export function CollapsiblePane({
  defaultCollapsed = false,
  storageKey,
  direction = "horizontal",
  expandedSize = "240px",
  children,
  renderToggle,
  className,
  contentClassName,
  "aria-label": ariaLabel,
  role,
}: CollapsiblePaneProps): React.ReactElement {
  // Initialise from localStorage if a key is provided, else use defaultCollapsed.
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (storageKey) return readStorage(storageKey, defaultCollapsed);
    return defaultCollapsed;
  });

  // Track previous collapsed state to choose open vs close animation class.
  const prevCollapsed = React.useRef(collapsed);
  const [animClass, setAnimClass] = React.useState<string>(() =>
    collapsed ? "animate-A-05-pane-close" : "animate-A-05-pane-open",
  );

  const toggle = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (storageKey) writeStorage(storageKey, next);
      // Update animation class: opening → pane-open; closing → pane-close
      setAnimClass(next ? "animate-A-05-pane-close" : "animate-A-05-pane-open");
      prevCollapsed.current = next;
      return next;
    });
  }, [storageKey]);

  // Horizontal pane: width collapses; vertical: height collapses.
  const sizeProperty = direction === "horizontal" ? "width" : "height";
  const overflowProperty = direction === "horizontal" ? "overflowX" : "overflowY";

  const containerStyle: React.CSSProperties = {
    [sizeProperty]: collapsed ? "0" : expandedSize,
    overflow: "hidden",
    [overflowProperty]: "hidden",
    flexShrink: 0,
  };

  return (
    <>
      <div
        className={cn("collapsible-pane-container", animClass, className)}
        style={containerStyle}
        role={role}
        aria-label={ariaLabel}
      >
        <div
          className={cn("collapsible-pane-content", contentClassName)}
          style={{
            // Keep the content at fixed size so it doesn't reflow while animating.
            [sizeProperty]: expandedSize,
            height: direction === "horizontal" ? "100%" : undefined,
            width: direction === "vertical" ? "100%" : undefined,
            display: "flex",
            flexDirection: "column",
          }}
          // Hide from AT when collapsed — content is invisible and non-interactive
          aria-hidden={collapsed}
          // inert is a progressive enhancement — not yet in React's HTMLAttributes
          // typings for this TS target. Cast to HTMLAttributes to pass it through.
          {...(collapsed ? { inert: "" } : ({} as React.HTMLAttributes<HTMLDivElement>))}
        >
          {children}
        </div>
      </div>

      {renderToggle && renderToggle({ collapsed, toggle })}
    </>
  );
}

export default CollapsiblePane;
