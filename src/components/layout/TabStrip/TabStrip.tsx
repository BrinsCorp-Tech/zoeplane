/**
 * TabStrip — horizontal open-tab navigation strip (Story 2.9, Layout tier P0)
 *
 * - Horizontally arranged tabs with close affordance per tab
 * - Active-tab highlight
 * - Keyboard navigation:
 *   - Cmd+1..9 (macOS) / Ctrl+1..9 (other platforms) selects tab by index
 *   - Delete/Backspace on focused tab closes it
 * - Tab state: reads from Zustand store (src/stores/app.ts tabs slice)
 * - Accepts a `tabs` prop fallback for Storybook rendering without store state
 *
 * Store integration:
 *   - When `tabs` prop is NOT provided, reads from useAppStore
 *   - When `tabs` prop IS provided (Storybook mode), prop wins
 *   - activeTabId and actions always come from the store
 *
 * A11y design:
 *   - Empty state: no role="tablist" (tablist requires role="tab" children)
 *   - Tab items: <button role="tab"> are DIRECT children of role="tablist"
 *   - Close affordance: visual-only close mark (aria-hidden) on each tab;
 *     keyboard users close via Delete/Backspace; mouse users click the mark
 *   - This avoids both "nested-interactive" (button in button) and
 *     "aria-required-children" (no tab children in tablist) violations
 *
 * @see src/stores/app.ts — TabDescriptor, addTab, removeTab, selectTab
 * @see docs/design/ux-spec.md §8.2 Layout tier
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app";
import type { TabDescriptor } from "@/stores/app";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TabStripProps {
  /**
   * Static tabs list for Storybook / testing. When provided, the component
   * uses this instead of reading from the Zustand store. Store actions
   * (selectTab, removeTab) still fire — callers can observe or override.
   */
  tabs?: TabDescriptor[];

  /** Optional className for the root element. */
  className?: string;
}

// ─── TabStrip ──────────────────────────────────────────────────────────────────

/**
 * TabStrip — keyboard-navigable tab bar for open views.
 *
 * Keyboard shortcuts:
 *   Cmd/Ctrl+1..9: select tab by index
 *   Delete/Backspace (when tab focused): close focused tab
 */
export function TabStrip({ tabs: tabsProp, className }: TabStripProps): React.ReactElement {
  // Store bindings
  const storeTabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const selectTab = useAppStore((s) => s.selectTab);
  const removeTab = useAppStore((s) => s.removeTab);

  // Prop wins over store when provided (Storybook / test mode)
  const tabs = tabsProp ?? storeTabs;

  // ── Keyboard shortcuts (Cmd/Ctrl+1..9) ──────────────────────────────────────

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const modifier = e.metaKey || e.ctrlKey;
      if (!modifier) return;

      const digit = parseInt(e.key, 10);
      if (isNaN(digit) || digit < 1 || digit > 9) return;

      const targetIndex = digit - 1;
      if (targetIndex < tabs.length) {
        e.preventDefault();
        selectTab(tabs[targetIndex].id);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [tabs, selectTab]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  //
  // Do NOT render role="tablist" when empty — ARIA requires tablist to own
  // at least one role="tab" child (aria-required-children). Use a plain <div>
  // with aria-label for the empty state instead.

  if (tabs.length === 0) {
    return (
      <div
        aria-label="Open tabs — empty"
        className={cn("tab-strip tab-strip--empty", className)}
        style={{
          display: "flex",
          alignItems: "center",
          height: "36px",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          paddingLeft: "var(--space-3)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-foreground-subtle)",
          }}
        >
          No open tabs
        </span>
      </div>
    );
  }

  // ── Populated state ─────────────────────────────────────────────────────────
  //
  // A11y pattern:
  //   - <button role="tab"> are DIRECT children of role="tablist"
  //   - Each tab button includes the title + a visual-only close mark
  //   - Close mark is aria-hidden; keyboard users press Delete/Backspace to close
  //   - Mouse users can click the close mark area (handled via pointer event
  //     on the aria-hidden span, which does not introduce nested-interactive)
  //
  // This satisfies:
  //   ✓ aria-required-children: tablist > tab (direct parent-child)
  //   ✓ nested-interactive: no button/input inside button
  //   ✓ keyboard: Delete closes; Cmd+N selects by index

  return (
    <div
      role="tablist"
      aria-label="Open tabs"
      className={cn("tab-strip", className)}
      style={{
        display: "flex",
        alignItems: "stretch",
        height: "36px",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        overflowX: "auto",
        flexShrink: 0,
      }}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-label={`${tab.title}${index < 9 ? `, Cmd+${index + 1}` : ""}. Press Delete to close.`}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault();
                removeTab(tab.id);
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              paddingLeft: "var(--space-3)",
              paddingRight: "var(--space-2)",
              height: "100%",
              background: isActive ? "var(--color-background)" : "var(--color-surface)",
              borderRight: "1px solid var(--color-border)",
              borderBottom: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
              borderTop: "none",
              borderLeft: "none",
              cursor: "pointer",
              flexShrink: 0,
              minWidth: "80px",
              maxWidth: "180px",
              fontSize: "var(--text-xs)",
              fontWeight: isActive ? "var(--weight-medium)" : "var(--weight-regular)",
              color: isActive ? "var(--color-foreground)" : "var(--color-foreground-muted)",
              userSelect: "none",
            }}
          >
            {/* Tab title */}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {tab.title}
            </span>

            {/*
             * Close mark — aria-hidden, mouse-clickable via pointer events.
             * Not a <button> — avoids nested-interactive axe violation.
             * Keyboard users: press Delete/Backspace on the focused tab instead.
             */}
            <span
              aria-hidden="true"
              title={`Close ${tab.title}`}
              onClick={(e) => {
                e.stopPropagation();
                removeTab(tab.id);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "14px",
                height: "14px",
                fontSize: "10px",
                color: "var(--color-foreground-muted)",
                borderRadius: "var(--radius-sm)",
                flexShrink: 0,
                cursor: "pointer",
              }}
            >
              ✕
            </span>
          </button>
        );
      })}
    </div>
  );
}
