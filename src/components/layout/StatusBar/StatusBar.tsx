/**
 * StatusBar — application status footer (Story 2.9, Layout tier P0)
 *
 * - role="contentinfo" with aria-label="Status bar"
 * - Four fields per AC #5:
 *   1. Active project root — via useProject(); null → "No project open"
 *   2. Active task count badge — placeholder "0 active tasks" (Epic 07)
 *   3. Cost ticker placeholder — "$0.00" (Epic 07)
 *   4. Connection status — Tauri invoke("sidecar_status") on mount + 5s poll
 *
 * Story 2.10 addition:
 *   5. Bell icon button — toggles NotificationsCenter panel.
 *      - aria-label="Toggle notifications"
 *      - aria-pressed={centerOpen}
 *      - Shows unread count badge when unreadCount > 0
 *      - Bell icon: Lucide Bell; color toggles accent when center is open
 *
 * Sidecar status states:
 *   - Pending (initial fetch in flight):  gray dot + "Connecting…"
 *   - Online (running: true):             green dot + "Sidecar online"
 *   - Offline (running: false or error):  red dot + "Sidecar offline"
 *
 * IMPORTANT: invoke is imported from "@tauri-apps/api/core" — never
 * window.__TAURI__ — forward-compatible with Epic 04 withGlobalTauri revert.
 *
 * @see src/hooks/useProject.ts
 * @see src-tauri/src/ipc.rs — sidecar_status command
 * @see src/stores/notifications.ts
 * @see src/hooks/useNotification.ts
 */
import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/hooks/useProject";
import { useNotificationsStore } from "@/stores/notifications";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Matches the SidecarStatus struct in src-tauri/src/ipc.rs */
interface SidecarStatus {
  running: boolean;
  pid: number | null;
  version: string | null;
}

type ConnectionState = "pending" | "online" | "offline";

// ─── Utilities ─────────────────────────────────────────────────────────────────

/** Middle-ellipsis truncation for long paths (> maxLength chars). */
function truncatePath(path: string, maxLength = 50): string {
  if (path.length <= maxLength) return path;
  const half = Math.floor((maxLength - 3) / 2);
  return `${path.slice(0, half)}…${path.slice(-half)}`;
}

// ─── StatusBar ─────────────────────────────────────────────────────────────────

export interface StatusBarProps {
  /** Optional className for the root element. */
  className?: string;

  /**
   * Poll interval in milliseconds for sidecar status checks.
   * Exposed as a prop so tests can set it to 0 or Infinity.
   * @default 5000
   */
  pollIntervalMs?: number;
}

/**
 * StatusBar — four-field status footer.
 *
 * Fields: project root | task count | cost | connection status.
 */
export function StatusBar({
  className,
  pollIntervalMs = 5000,
}: StatusBarProps): React.ReactElement {
  const project = useProject();

  // ── Notifications bell state ───────────────────────────────────────────────

  const { centerOpen, unreadCount, toggleCenter } = useNotificationsStore();

  // ── Connection status ─────────────────────────────────────────────────────

  const [connectionState, setConnectionState] = React.useState<ConnectionState>("pending");

  const checkSidecarStatus = React.useCallback(async () => {
    try {
      const status = await invoke<SidecarStatus>("sidecar_status");
      setConnectionState(status.running ? "online" : "offline");
    } catch {
      setConnectionState("offline");
    }
  }, []);

  React.useEffect(() => {
    // Initial check on mount
    void checkSidecarStatus();

    if (pollIntervalMs === Infinity || pollIntervalMs <= 0) return;

    // Poll every pollIntervalMs
    const interval = setInterval(() => {
      void checkSidecarStatus();
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [checkSidecarStatus, pollIntervalMs]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const connectionDotColor: Record<ConnectionState, string> = {
    pending: "var(--color-foreground-subtle)",
    online: "var(--color-success)",
    offline: "var(--color-danger)",
  };

  const connectionLabel: Record<ConnectionState, string> = {
    pending: "Connecting…",
    online: "Sidecar online",
    offline: "Sidecar offline",
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <footer
      role="contentinfo"
      aria-label="Status bar"
      className={cn("status-bar", className)}
      style={{
        display: "flex",
        alignItems: "center",
        height: "28px",
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
        paddingLeft: "var(--space-3)",
        paddingRight: "var(--space-3)",
        gap: "var(--space-4)",
        flexShrink: 0,
        fontSize: "var(--text-xs)",
        color: "var(--color-foreground-muted)",
        overflowX: "auto",
        whiteSpace: "nowrap",
      }}
    >
      {/* Field 1: Active project root */}
      <span
        aria-label={project ? `Active project: ${project.projectRoot}` : "No project open"}
        style={{
          color: "var(--color-foreground-muted)",
          flex: "0 1 auto",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {project ? truncatePath(project.projectRoot) : "No project open"}
      </span>

      {/* Separator */}
      <span aria-hidden="true" style={{ color: "var(--color-border)" }}>
        |
      </span>

      {/* Field 2: Active task count (placeholder — Epic 07) */}
      <span aria-label="0 active tasks">0 active tasks</span>

      {/* Separator */}
      <span aria-hidden="true" style={{ color: "var(--color-border)" }}>
        |
      </span>

      {/* Field 3: Cost ticker (placeholder — Epic 07) */}
      <span aria-label="Session cost: $0.00">$0.00</span>

      {/* Push bell + connection status to far right */}
      <span
        style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-3)" }}
      >
        {/* Field 5: Notifications bell (Story 2.10) */}
        <button
          onClick={toggleCenter}
          aria-label="Toggle notifications"
          aria-pressed={centerOpen}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "0",
            color: centerOpen ? "var(--color-accent)" : "var(--color-foreground-muted)",
            lineHeight: 1,
          }}
        >
          <Bell size={12} aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-label={`${unreadCount} unread notifications`}
              style={{
                position: "absolute",
                top: "-4px",
                right: "-4px",
                minWidth: "12px",
                height: "12px",
                borderRadius: "9999px",
                background: "var(--color-danger)",
                color: "var(--color-danger-foreground)",
                fontSize: "9px",
                fontWeight: "var(--weight-semibold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 2px",
                lineHeight: 1,
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Field 4: Connection status */}
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          <span
            aria-hidden="true"
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: connectionDotColor[connectionState],
              flexShrink: 0,
              display: "inline-block",
            }}
          />
          <span
            aria-live="polite"
            aria-label={`Connection status: ${connectionLabel[connectionState]}`}
          >
            {connectionLabel[connectionState]}
          </span>
        </span>
      </span>
    </footer>
  );
}
