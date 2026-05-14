/**
 * useNotification — unified notification dispatch hook (Story 2.10)
 *
 * Bridges two notification channels:
 *   1. Transient toast (via sonner) — visible for a short duration, then gone
 *   2. Persistent store entry (via useNotificationsStore) — lives in the
 *      NotificationsCenter panel until the user clears or marks it read
 *
 * Both channels fire on every `notify()` call so the user sees an immediate
 * toast AND has access to a permanent log in the Notifications panel.
 *
 * Quarantine level uses toast.error with a quarantine CSS class override so
 * the `--color-quarantine` design token is applied. The quarantine class is
 * defined in the NotificationsCenter component stylesheet.
 *
 * @see src/stores/notifications.ts
 * @see src/components/layout/NotificationsCenter/NotificationsCenter.tsx
 */

import { toast } from "sonner";
import { useNotificationsStore, type NotificationLevel } from "../stores/notifications";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface NotifyOptions {
  /** Optional longer description shown below the title in the center panel. */
  description?: string;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useNotification — dispatch and read notifications.
 *
 * Usage:
 *   const { notify } = useNotification();
 *   notify("error", "Build failed", { description: "See output panel for details." });
 */
export function useNotification() {
  const store = useNotificationsStore();

  /**
   * Dispatch a notification.
   *
   * Fires a sonner toast (transient) AND appends a persistent entry to the
   * notifications store (surfaced in NotificationsCenter).
   *
   * @param level    Severity: "info" | "warning" | "error" | "quarantine"
   * @param title    Short notification title
   * @param options  Optional: description text
   * @returns        The generated notification entry id
   */
  function notify(level: NotificationLevel, title: string, options?: NotifyOptions): string {
    const id = store.addEntry(level, title, options);

    const toastOptions = options?.description ? { description: options.description } : undefined;

    switch (level) {
      case "info":
        toast.info(title, toastOptions);
        break;
      case "warning":
        toast.warning(title, toastOptions);
        break;
      case "error":
        toast.error(title, toastOptions);
        break;
      case "quarantine":
        // Quarantine uses toast.error with a CSS class override so the
        // --color-quarantine design token is applied via the
        // .notification-quarantine-toast class defined in NotificationsCenter.
        toast.error(title, {
          ...toastOptions,
          className: "notification-quarantine-toast",
        });
        break;
    }

    return id;
  }

  return {
    // ── Dispatch ───────────────────────────────────────────────────────────────

    /** Dispatch a notification (toast + persistent entry). Returns entry id. */
    notify,

    // ── Read ──────────────────────────────────────────────────────────────────

    /** All notification entries (newest-last; render reverses to newest-first). */
    entries: store.entries,

    /** Count of unread entries. */
    unreadCount: store.unreadCount,

    /** Whether the NotificationsCenter panel is currently open. */
    centerOpen: store.centerOpen,

    // ── Mutations ─────────────────────────────────────────────────────────────

    /** Mark a single entry as read by id. */
    markRead: store.markRead,

    /** Mark all entries as read. */
    markAllRead: store.markAllRead,

    /** Remove all entries. */
    clearAll: store.clearAll,

    /** Open the NotificationsCenter panel. */
    openCenter: store.openCenter,

    /** Close the NotificationsCenter panel. */
    closeCenter: store.closeCenter,

    /** Toggle the NotificationsCenter panel open/closed. */
    toggleCenter: store.toggleCenter,
  };
}
