/**
 * Inspector — right-hand context detail pane (Story 2.9, Layout tier P0)
 *
 * - role="complementary" with aria-label="Inspector"
 * - Collapsible; collapse state persisted to localStorage key
 *   "zoeplane:inspector:collapsed"
 * - Toggle button at top-right with aria-expanded
 * - Reduced-motion: handled by CollapsiblePane (transition-duration: 0ms)
 * - Content slot for consumer-supplied inspector panels (Epic 05+)
 *
 * @see src/components/layout/CollapsiblePane/CollapsiblePane.tsx
 * @see docs/design/ux-spec.md §8.2 Layout tier
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { CollapsiblePane } from "../CollapsiblePane/CollapsiblePane";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface InspectorProps {
  /**
   * Content to render inside the inspector panel.
   * Placeholder by default for Storybook; Epic 05+ wires real content.
   */
  children?: React.ReactNode;

  /**
   * Accessible label for the inspector region.
   * @default "Inspector"
   */
  "aria-label"?: string;

  /**
   * Expanded width of the inspector panel.
   * @default "280px"
   */
  expandedWidth?: string;

  /** Optional className for the outer wrapper. */
  className?: string;
}

// ─── Inspector ─────────────────────────────────────────────────────────────────

/**
 * Inspector — right-hand complementary panel.
 *
 * Collapse state persisted to localStorage key "zoeplane:inspector:collapsed".
 * Toggle button is positioned at the top-left edge of the pane.
 */
export function Inspector({
  children,
  "aria-label": ariaLabel = "Inspector",
  expandedWidth = "280px",
  className,
}: InspectorProps): React.ReactElement {
  // We need access to collapsed state to position the toggle button correctly.
  // CollapsiblePane's renderToggle prop provides it.

  return (
    <div
      className={cn("inspector-root", className)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        height: "100%",
      }}
    >
      <CollapsiblePane
        storageKey="zoeplane:inspector:collapsed"
        defaultCollapsed={false}
        direction="horizontal"
        expandedSize={expandedWidth}
        role="complementary"
        aria-label={ariaLabel}
        contentClassName="inspector-content"
        renderToggle={({ collapsed, toggle }) => (
          // The toggle button is rendered AFTER the pane in CollapsiblePane's
          // fragment. Keyboard focus order follows visual position in the host
          // layout — Story 2.8's HostShell composition determines the perceived
          // focus order. If a "toggle first" invariant becomes required, extend
          // CollapsiblePane with a `togglePosition: 'before' | 'after'` prop
          // (deferred — not in 2.9 scope).
          <button
            aria-label={collapsed ? "Expand inspector" : "Collapse inspector"}
            aria-expanded={!collapsed}
            onClick={toggle}
            style={{
              width: "24px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRight: "none",
              cursor: "pointer",
              flexShrink: 0,
              alignSelf: "center",
              borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)",
              color: "var(--color-foreground-muted)",
              fontSize: "10px",
            }}
          >
            <span aria-hidden="true">{collapsed ? "‹" : "›"}</span>
          </button>
        )}
      >
        <div
          style={{
            height: "100%",
            background: "var(--color-surface)",
            borderLeft: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {/* Inspector header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "var(--space-3) var(--space-4)",
              borderBottom: "1px solid var(--color-border)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-semibold)",
                color: "var(--color-foreground)",
              }}
            >
              Inspector
            </span>
          </div>

          {/* Content slot */}
          <div
            style={{
              flex: 1,
              padding: "var(--space-4)",
              overflowY: "auto",
            }}
          >
            {children ?? (
              <p
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-foreground-muted)",
                }}
              >
                No selection. Select an item to inspect its details.
              </p>
            )}
          </div>
        </div>
      </CollapsiblePane>
    </div>
  );
}

export default Inspector;
