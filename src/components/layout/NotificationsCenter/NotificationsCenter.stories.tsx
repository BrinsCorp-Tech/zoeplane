/**
 * NotificationsCenter stories — Story 2.10 AC coverage (ux-spec §8.2)
 *
 * Three variant states per AC inventory:
 *   1. closed        — center is not visible (demonstrates portal)
 *   2. open          — center open, no notifications (empty state)
 *   3. has-unread    — center open with mixed levels including quarantine
 *
 * Light + dark theme variants for open and has-unread states.
 *
 * The has-unread story shows one of each level (info/warning/error/quarantine)
 * so the --color-quarantine design token styling is visually verifiable.
 *
 * NOTE: Tauri invoke() is not called by NotificationsCenter directly.
 * No Tauri mock is needed for these isolated stories.
 */
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { useNotificationsStore } from "@/stores/notifications";
import { NotificationsCenter } from "./NotificationsCenter";

const meta: Meta<typeof NotificationsCenter> = {
  title: "Layout/NotificationsCenter",
  component: NotificationsCenter,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof NotificationsCenter>;

// ─── Helper ───────────────────────────────────────────────────────────────────

function CenterWrapper({
  theme,
  open,
  withEntries,
}: {
  theme: "light" | "dark";
  open?: boolean;
  withEntries?: boolean;
}) {
  React.useEffect(() => {
    const store = useNotificationsStore.getState();
    store.clearAll();

    if (open) store.openCenter();
    else store.closeCenter();

    if (withEntries) {
      store.addEntry("info", "Build completed", {
        description: "Production build finished in 4.2s.",
      });
      store.addEntry("warning", "Token budget at 80%", {
        description: "Session has consumed 80% of the configured token budget.",
      });
      store.addEntry("error", "Sidecar connection lost", {
        description: "Unable to reach the Node.js sidecar. Retrying in 5s.",
      });
      store.addEntry("quarantine", "Plugin signature invalid", {
        description: "Plugin 'my-plugin' has an invalid signature and has been blocked.",
      });
      // Mark the first (oldest) one as read to show mixed read/unread state
      const entries = useNotificationsStore.getState().entries;
      if (entries.length > 0) {
        store.markRead(entries[0].id);
      }
    }

    return () => {
      store.clearAll();
      store.closeCenter();
    };
  }, [open, withEntries]);

  return (
    <div
      data-theme={theme}
      style={{ height: "100vh", background: "var(--color-background)", position: "relative" }}
    >
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
        {open ? "Notifications panel is open →" : "Panel is closed. Press Cmd+Shift+N to open."}
      </div>
      <NotificationsCenter />
    </div>
  );
}

// ─── 1. Closed ────────────────────────────────────────────────────────────────

/**
 * Closed — panel is not visible (portal renders nothing when open=false).
 */
export const Closed: Story = {
  name: "Closed (light)",
  render: () => <CenterWrapper theme="light" open={false} />,
};

// ─── 2. Open (empty) ─────────────────────────────────────────────────────────

/**
 * Open — panel visible, no notifications. Shows "No notifications yet." empty state.
 */
export const OpenEmptyLight: Story = {
  name: "Open — no notifications (light)",
  render: () => <CenterWrapper theme="light" open={true} withEntries={false} />,
};

export const OpenEmptyDark: Story = {
  name: "Open — no notifications (dark)",
  render: () => <CenterWrapper theme="dark" open={true} withEntries={false} />,
};

// ─── 3. Has unread ────────────────────────────────────────────────────────────

/**
 * Has unread — panel open with one entry per level (info/warning/error/quarantine).
 * Oldest entry is marked read; the rest are unread.
 * Verifies --color-quarantine token is applied to the quarantine chip.
 */
export const HasUnreadLight: Story = {
  name: "Has unread — all levels (light)",
  render: () => <CenterWrapper theme="light" open={true} withEntries={true} />,
};

export const HasUnreadDark: Story = {
  name: "Has unread — all levels (dark)",
  render: () => <CenterWrapper theme="dark" open={true} withEntries={true} />,
};
