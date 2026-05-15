// ZoePlane — notifications Zustand store (Story 2.10)
//
// Tracks persistent in-app notifications across all severity levels.
// Each notification entry is appended on dispatch and read from here
// by NotificationsCenter. Toast presentation is handled separately
// by the useNotification() hook (via sonner).
//
// ID generation: crypto.randomUUID() — available in all browser environments
// and Bun jsdom (no nanoid dependency required).

import { create } from "zustand";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Severity levels for notification entries. */
export type NotificationLevel = "info" | "warning" | "error" | "quarantine";

/** A single notification entry stored in the notifications slice. */
export interface NotificationEntry {
  /** Unique ID for this entry (crypto.randomUUID()). */
  id: string;
  /** Short summary title displayed in the notification list. */
  title: string;
  /** Optional longer description shown below the title. */
  description?: string;
  /** Severity level — drives visual styling and filtering. */
  level: NotificationLevel;
  /** Unix timestamp (ms) at which this entry was created. */
  timestamp: number;
  /** Whether this entry has been marked as read by the user. */
  read: boolean;
}

// ─── Store interface ────────────────────────────────────────────────────────────

interface NotificationsState {
  // ── State ───────────────────────────────────────────────────────────────────

  /** All notification entries, newest-last (render reverses to newest-first). */
  entries: NotificationEntry[];

  /** Count of unread entries — maintained in sync with entries for O(1) reads. */
  unreadCount: number;

  /** Whether the NotificationsCenter panel is currently open. */
  centerOpen: boolean;

  // ── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Append a new notification entry.
   *
   * All four levels (info, warning, error, quarantine) create a persistent entry.
   * Returns the generated entry id so callers can reference it later.
   *
   * @param level    Severity level
   * @param title    Short notification title
   * @param options  Optional: description text
   */
  addEntry: (level: NotificationLevel, title: string, options?: { description?: string }) => string;

  /**
   * Mark a single entry as read by id.
   * No-op if the entry does not exist or is already read.
   */
  markRead: (id: string) => void;

  /** Mark all entries as read. Resets unreadCount to 0. */
  markAllRead: () => void;

  /** Remove all entries from the store. Resets unreadCount to 0. */
  clearAll: () => void;

  /** Open the NotificationsCenter panel. */
  openCenter: () => void;

  /** Close the NotificationsCenter panel. */
  closeCenter: () => void;

  /** Toggle the NotificationsCenter panel open/closed. */
  toggleCenter: () => void;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useNotificationsStore = create<NotificationsState>()((set, get) => ({
  // ── Initial state ───────────────────────────────────────────────────────────

  entries: [],
  unreadCount: 0,
  centerOpen: false,

  // ── Actions ─────────────────────────────────────────────────────────────────

  addEntry: (level, title, options) => {
    const id = crypto.randomUUID();
    const entry: NotificationEntry = {
      id,
      title,
      description: options?.description,
      level,
      timestamp: Date.now(),
      read: false,
    };
    set((state) => ({
      entries: [...state.entries, entry],
      unreadCount: state.unreadCount + 1,
    }));
    return id;
  },

  markRead: (id) => {
    const { entries } = get();
    const entry = entries.find((e) => e.id === id);
    // No-op if not found or already read
    if (!entry || entry.read) return;
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? { ...e, read: true } : e)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllRead: () => {
    set((state) => ({
      entries: state.entries.map((e) => ({ ...e, read: true })),
      unreadCount: 0,
    }));
  },

  clearAll: () => {
    set({ entries: [], unreadCount: 0 });
  },

  openCenter: () => set({ centerOpen: true }),
  closeCenter: () => set({ centerOpen: false }),
  toggleCenter: () => set((state) => ({ centerOpen: !state.centerOpen })),
}));
