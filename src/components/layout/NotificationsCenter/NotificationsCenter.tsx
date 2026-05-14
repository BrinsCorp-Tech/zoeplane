/**
 * NotificationsCenter — persistent notification log overlay (Story 2.10)
 *
 * Slide-in panel from the right edge of the viewport rendered as a dialog
 * overlay (via ModalRoot + ModalContent). Using the Modal primitive provides
 * an accessible focus trap, Escape-to-dismiss, and consistent scrim behaviour.
 *
 * A11y choice: `role="dialog"` via ModalContent (Radix Dialog) with
 * aria-label="Notifications panel". This is cleaner than `role="region"` here
 * because:
 *   (a) the panel is triggered by explicit user action (bell button / Cmd+Shift+N)
 *   (b) it overlays the entire UI and needs a focus trap
 *   (c) dismissing it via Escape should work consistently with the rest of the app
 *
 * Keyboard shortcut: Cmd+Shift+N (macOS) / Ctrl+Shift+N (Win/Linux) — toggles
 * the center open/closed via useNotificationsStore.toggleCenter().
 *
 * Reduced-motion: slide-in animation disabled under prefers-reduced-motion
 * (same pattern as CommandPalette and CollapsiblePane).
 *
 * Quarantine toast: the .notification-quarantine-toast class is defined here
 * for use by useNotification()'s toast.error() quarantine override.
 *
 * @see src/stores/notifications.ts
 * @see src/hooks/useNotification.ts
 * @see src/components/ui/Modal/Modal.tsx
 * @see docs/design/ux-spec.md §6.9 — Notifications overlay
 */
import * as React from "react";
import { ModalRoot, ModalContent, ModalTitle } from "@/components/ui/Modal/Modal";
import { useNotificationsStore, type NotificationLevel } from "@/stores/notifications";

// ─── Styles ────────────────────────────────────────────────────────────────────

const REDUCED_MOTION_STYLE = `
@media (prefers-reduced-motion: reduce) {
  .notifications-center-overlay {
    transition-duration: 0ms !important;
    animation-duration: 0ms !important;
  }
}

/* Quarantine toast override — applied by useNotification() hook */
.notification-quarantine-toast {
  background: var(--color-quarantine, oklch(48% 0.17 320)) !important;
  color: var(--color-quarantine-foreground) !important;
  border-color: var(--color-quarantine, oklch(48% 0.17 320)) !important;
}
`;

// ─── Utilities ─────────────────────────────────────────────────────────────────

/** Level → CSS color token mapping. */
const LEVEL_COLOR: Record<NotificationLevel, string> = {
  info: "var(--color-accent)",
  warning: "var(--color-warning, oklch(75% 0.18 80))",
  error: "var(--color-danger)",
  quarantine: "var(--color-quarantine, oklch(48% 0.17 320))",
};

/** Level → CSS foreground token mapping (pairs with LEVEL_COLOR). */
const LEVEL_FOREGROUND: Record<NotificationLevel, string> = {
  info: "var(--color-accent-foreground)",
  warning: "var(--color-warning-foreground)",
  error: "var(--color-danger-foreground)",
  quarantine: "var(--color-quarantine-foreground)",
};

/** Level → label. */
const LEVEL_LABEL: Record<NotificationLevel, string> = {
  info: "Info",
  warning: "Warning",
  error: "Error",
  quarantine: "Quarantine",
};

/**
 * Format a Unix timestamp (ms) as a relative time string.
 * Simple impl — no i18n required in Sprint 2.
 */
function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

// ─── NotificationsCenter ──────────────────────────────────────────────────────

export interface NotificationsCenterProps {
  /** Optional className applied to the content panel. */
  className?: string;
}

/**
 * NotificationsCenter — right-edge overlay showing the persistent notification log.
 *
 * Mount once inside HostShell (portals via Modal — doesn't affect CSS Grid layout).
 * All open-state management is driven by useNotificationsStore.centerOpen.
 */
export function NotificationsCenter({
  className: _className,
}: NotificationsCenterProps): React.ReactElement {
  const { entries, centerOpen, closeCenter, toggleCenter, markRead, clearAll } =
    useNotificationsStore();

  // ── Keyboard shortcut: Cmd+Shift+N / Ctrl+Shift+N ─────────────────────────

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "n") {
        event.preventDefault();
        toggleCenter();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleCenter]);

  // ── Category filter state (local — not persisted) ──────────────────────────

  const [activeFilter, setActiveFilter] = React.useState<NotificationLevel | "all">("all");

  // Newest first
  const sortedEntries = React.useMemo(() => [...entries].reverse(), [entries]);

  const filteredEntries = React.useMemo(() => {
    if (activeFilter === "all") return sortedEntries;
    return sortedEntries.filter((e) => e.level === activeFilter);
  }, [sortedEntries, activeFilter]);

  const unreadCount = entries.filter((e) => !e.read).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{REDUCED_MOTION_STYLE}</style>

      <ModalRoot open={centerOpen} onOpenChange={(open) => !open && closeCenter()}>
        <ModalContent
          size="md"
          aria-label="Notifications panel"
          aria-describedby={undefined}
          className="notifications-center-overlay"
          style={{
            // Override Modal centering — slide in from right edge
            top: "0",
            right: "0",
            left: "auto",
            bottom: "0",
            transform: "none",
            borderRadius: "0",
            borderLeft: "1px solid var(--color-border)",
            borderTop: "none",
            borderRight: "none",
            borderBottom: "none",
            maxHeight: "100vh",
            height: "100vh",
            width: "380px",
            maxWidth: "90vw",
            display: "flex",
            flexDirection: "column",
            background: "var(--color-surface-overlay)",
            padding: 0,
          }}
        >
          {/*
           * Radix Dialog requires a DialogTitle for screen reader accessibility.
           * ModalTitle renders as DialogPrimitive.Title. It is visually hidden
           * here because the panel header already shows "Notifications" visually.
           */}
          <ModalTitle>
            <span
              style={{
                position: "absolute",
                width: "1px",
                height: "1px",
                padding: 0,
                margin: "-1px",
                overflow: "hidden",
                clip: "rect(0,0,0,0)",
                whiteSpace: "nowrap",
                borderWidth: 0,
              }}
            >
              Notifications
            </span>
          </ModalTitle>

          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-4)",
              borderBottom: "1px solid var(--color-border)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--weight-semibold)",
                  color: "var(--color-foreground)",
                }}
              >
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} unread`}
                  style={{
                    fontSize: "var(--text-xs)",
                    background: "var(--color-danger)",
                    color: "var(--color-danger-foreground)",
                    borderRadius: "9999px",
                    padding: "1px 6px",
                    fontWeight: "var(--weight-semibold)",
                    minWidth: "18px",
                    textAlign: "center",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              {entries.length > 0 && (
                <button
                  onClick={clearAll}
                  aria-label="Clear all notifications"
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-foreground-muted)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "var(--space-1) var(--space-2)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Category filter chips */}
          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
              padding: "var(--space-3) var(--space-4)",
              borderBottom: "1px solid var(--color-border)",
              flexShrink: 0,
              flexWrap: "wrap",
            }}
            role="group"
            aria-label="Filter notifications by category"
          >
            {(["all", "info", "warning", "error", "quarantine"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                aria-pressed={activeFilter === filter}
                aria-label={`Filter: ${filter}`}
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "2px var(--space-2)",
                  borderRadius: "9999px",
                  border: "1px solid var(--color-border)",
                  cursor: "pointer",
                  background: activeFilter === filter ? "var(--color-accent)" : "transparent",
                  color:
                    activeFilter === filter
                      ? "var(--color-accent-foreground)"
                      : "var(--color-foreground-muted)",
                  fontWeight: activeFilter === filter ? "var(--weight-semibold)" : "normal",
                  transition: "background 120ms, color 120ms",
                }}
              >
                {filter === "all" ? "All" : LEVEL_LABEL[filter]}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <div
            role="list"
            aria-label="Notification entries"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "var(--space-2) 0",
            }}
          >
            {filteredEntries.length === 0 ? (
              <div
                role="listitem"
                style={{
                  padding: "var(--space-6) var(--space-4)",
                  textAlign: "center",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-foreground-muted)",
                }}
              >
                No notifications yet.
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  role="listitem"
                  aria-label={`${LEVEL_LABEL[entry.level]} notification: ${entry.title}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-1)",
                    padding: "var(--space-3) var(--space-4)",
                    borderBottom: "1px solid var(--color-border)",
                    background: entry.read
                      ? "transparent"
                      : "color-mix(in oklch, var(--color-surface) 95%, var(--color-accent) 5%)",
                    position: "relative",
                  }}
                >
                  {/* Top row: level chip + title + unread dot + timestamp */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    {/* Level chip */}
                    <span
                      aria-label={`Level: ${LEVEL_LABEL[entry.level]}`}
                      style={{
                        fontSize: "var(--text-xs)",
                        padding: "1px 6px",
                        borderRadius: "9999px",
                        background: LEVEL_COLOR[entry.level],
                        color: LEVEL_FOREGROUND[entry.level],
                        fontWeight: "var(--weight-semibold)",
                        flexShrink: 0,
                      }}
                    >
                      {LEVEL_LABEL[entry.level]}
                    </span>

                    {/* Unread dot */}
                    {!entry.read && (
                      <span
                        aria-label="Unread"
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: "var(--color-accent)",
                          flexShrink: 0,
                          display: "inline-block",
                        }}
                      />
                    )}

                    {/* Title */}
                    <span
                      style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: "var(--weight-semibold)",
                        color: "var(--color-foreground)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.title}
                    </span>

                    {/* Timestamp */}
                    <span
                      aria-label={`Received ${formatRelativeTime(entry.timestamp)}`}
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-foreground-subtle, var(--color-foreground-muted))",
                        flexShrink: 0,
                      }}
                    >
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </div>

                  {/* Description */}
                  {entry.description && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "var(--text-xs)",
                        color: "var(--color-foreground-muted)",
                        lineHeight: "1.5",
                      }}
                    >
                      {entry.description}
                    </p>
                  )}

                  {/* Actions row */}
                  {!entry.read && (
                    <div>
                      <button
                        onClick={() => markRead(entry.id)}
                        aria-label={`Mark "${entry.title}" as read`}
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-accent)",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: "0",
                          textDecoration: "underline",
                        }}
                      >
                        Mark read
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ModalContent>
      </ModalRoot>
    </>
  );
}

export default NotificationsCenter;
