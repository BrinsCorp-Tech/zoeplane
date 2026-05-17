/**
 * TitleBar — application chrome title bar (Story 2.9, Layout tier P0)
 *
 * - role="banner"
 * - App title via prop (default: "ZoePlane")
 * - Draggable strip via inline style={{ WebkitAppRegion: "drag" }} on the
 *   drag zone; interactive controls inside use WebkitAppRegion: "no-drag"
 * - No Tauri IPC calls — CSS-only drag implementation
 * - Operates in decorated mode (tauri.conf.json decorations: true); the
 *   draggable strip is additive — standard OS title bar controls remain
 *
 * IMPORTANT: WebkitAppRegion is a Tauri/Electron-specific CSS property that
 * enables native window dragging. It is NOT a standard CSS property and
 * TypeScript's CSSProperties does not include it. We use type assertion
 * (`as React.CSSProperties`) to pass it through.
 *
 * @see docs/architecture/sprint-context.md — PASS H1 (decorations: true)
 * @see https://tauri.app/v1/guides/features/window-customization/#draggable-region
 */
import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TitleBarProps {
  /**
   * Application title displayed in the center/left of the title bar.
   * @default "ZoePlane"
   */
  title?: string;

  /**
   * Optional slot for controls rendered on the right side of the title bar
   * (e.g., window controls, menu buttons). These receive WebkitAppRegion:
   * "no-drag" automatically.
   */
  rightControls?: React.ReactNode;

  /**
   * Optional slot for controls rendered on the left side of the title bar.
   * These receive WebkitAppRegion: "no-drag" automatically.
   */
  leftControls?: React.ReactNode;

  /** Optional className for the root element. */
  className?: string;
}

// ─── TitleBar ──────────────────────────────────────────────────────────────────

/**
 * TitleBar — application header with native window drag support.
 *
 * The entire bar is draggable except for the leftControls/rightControls slots
 * which carry WebkitAppRegion: "no-drag".
 */
export function TitleBar({
  title = "ZoePlane",
  rightControls,
  leftControls,
  className,
}: TitleBarProps): React.ReactElement {
  // WebkitAppRegion is not a standard CSSProperties key; we extend via
  // type assertion. This is intentional and Tauri-documented.
  const dragStyle = {
    WebkitAppRegion: "drag",
  } as React.CSSProperties;

  const noDragStyle = {
    WebkitAppRegion: "no-drag",
  } as React.CSSProperties;

  return (
    <header
      role="banner"
      className={cn("title-bar", className)}
      style={{
        ...dragStyle,
        display: "flex",
        alignItems: "center",
        height: "40px",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        userSelect: "none",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {/* Left controls (no-drag zone) */}
      {leftControls && (
        <div
          style={{
            ...noDragStyle,
            display: "flex",
            alignItems: "center",
            paddingLeft: "var(--space-3)",
            flexShrink: 0,
          }}
        >
          {leftControls}
        </div>
      )}

      {/* Title — centered in the remaining space */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: leftControls ? "0" : "var(--space-4)",
          paddingRight: rightControls ? "0" : "var(--space-4)",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--color-foreground)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </span>
      </div>

      {/* Right controls (no-drag zone) */}
      {rightControls && (
        <div
          style={{
            ...noDragStyle,
            display: "flex",
            alignItems: "center",
            paddingRight: "var(--space-3)",
            gap: "var(--space-2)",
            flexShrink: 0,
          }}
        >
          {rightControls}
        </div>
      )}
    </header>
  );
}
