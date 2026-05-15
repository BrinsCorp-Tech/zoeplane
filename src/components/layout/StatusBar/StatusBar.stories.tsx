/**
 * StatusBar stories — Story 2.9 AC coverage
 *
 * Project-open and no-project variants, light + dark themes.
 *
 * NOTE: Tauri invoke("sidecar_status") calls will fail in Storybook (no Tauri
 * runtime). StatusBar gracefully falls back to "offline" state when invoke
 * throws. The connection status shows "Sidecar offline" in Storybook — this
 * is expected and correct behaviour.
 */
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { StatusBar } from "./StatusBar";
import { useAppStore } from "@/stores/app";
import { useNotificationsStore } from "@/stores/notifications";

const meta: Meta<typeof StatusBar> = {
  title: "Layout/StatusBar",
  component: StatusBar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof StatusBar>;

// ─── Light theme ──────────────────────────────────────────────────────────────

/**
 * No project open — StatusBar shows "No project open" in muted foreground.
 * (Default state — store projectRoot is null.)
 */
export const NoProjectLight: Story = {
  name: "No project open (light)",
  render: () => (
    <div
      data-theme="light"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "200px",
        background: "var(--color-background)",
      }}
    >
      <div style={{ flex: 1 }} />
      {/* pollIntervalMs=Infinity — no interval timer in Storybook */}
      <StatusBar pollIntervalMs={Infinity} />
    </div>
  ),
};

/**
 * Project open — StatusBar shows truncated project path.
 * Store is seeded via useEffect and cleaned up on unmount.
 */
export const ProjectOpenLight: Story = {
  name: "Project open (light)",
  render: () => {
    React.useEffect(() => {
      useAppStore.getState()._setProjectRoot("/Users/zeke/Documents/DevWork/ZoePlane");
      return () => {
        useAppStore.getState()._setProjectRoot(null);
      };
    }, []);

    return (
      <div
        data-theme="light"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "200px",
          background: "var(--color-background)",
        }}
      >
        <div style={{ flex: 1 }} />
        <StatusBar pollIntervalMs={Infinity} />
      </div>
    );
  },
};

/**
 * Long project path — verifies middle-ellipsis truncation.
 */
export const LongPathLight: Story = {
  name: "Long project path (truncation, light)",
  render: () => {
    React.useEffect(() => {
      useAppStore
        .getState()
        ._setProjectRoot(
          "/Users/zekebrinsfield/Documents/DevWork/VeryLongOrganizationName/SubFolder/AnotherFolder/ProjectName",
        );
      return () => {
        useAppStore.getState()._setProjectRoot(null);
      };
    }, []);

    return (
      <div
        data-theme="light"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "200px",
          background: "var(--color-background)",
        }}
      >
        <div style={{ flex: 1 }} />
        <StatusBar pollIntervalMs={Infinity} />
      </div>
    );
  },
};

// ─── Dark theme ───────────────────────────────────────────────────────────────

export const NoProjectDark: Story = {
  name: "No project open (dark)",
  render: () => (
    <div
      data-theme="dark"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "200px",
        background: "var(--color-background)",
      }}
    >
      <div style={{ flex: 1 }} />
      <StatusBar pollIntervalMs={Infinity} />
    </div>
  ),
};

export const ProjectOpenDark: Story = {
  name: "Project open (dark)",
  render: () => {
    React.useEffect(() => {
      useAppStore.getState()._setProjectRoot("/Users/zeke/Documents/DevWork/ZoePlane");
      return () => {
        useAppStore.getState()._setProjectRoot(null);
      };
    }, []);

    return (
      <div
        data-theme="dark"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "200px",
          background: "var(--color-background)",
        }}
      >
        <div style={{ flex: 1 }} />
        <StatusBar pollIntervalMs={Infinity} />
      </div>
    );
  },
};

// ─── With notifications ───────────────────────────────────────────────────────

/**
 * With notifications (light) — bell shows unread badge, center is closed.
 * Demonstrates the bell icon + unread count badge in the StatusBar.
 */
export const WithNotificationsLight: Story = {
  name: "With notifications — unread badge (light)",
  render: () => {
    React.useEffect(() => {
      const store = useNotificationsStore.getState();
      store.clearAll();
      store.addEntry("error", "Sidecar offline");
      store.addEntry("warning", "Token budget at 80%");
      store.addEntry("info", "Build completed");
      return () => {
        useNotificationsStore.getState().clearAll();
      };
    }, []);

    return (
      <div
        data-theme="light"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "200px",
          background: "var(--color-background)",
        }}
      >
        <div style={{ flex: 1 }} />
        <StatusBar pollIntervalMs={Infinity} />
      </div>
    );
  },
};

/**
 * With notifications (dark) — bell shows unread badge in dark theme.
 */
export const WithNotificationsDark: Story = {
  name: "With notifications — unread badge (dark)",
  render: () => {
    React.useEffect(() => {
      const store = useNotificationsStore.getState();
      store.clearAll();
      store.addEntry("quarantine", "Plugin signature invalid");
      store.addEntry("error", "Build failed");
      return () => {
        useNotificationsStore.getState().clearAll();
      };
    }, []);

    return (
      <div
        data-theme="dark"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "200px",
          background: "var(--color-background)",
        }}
      >
        <div style={{ flex: 1 }} />
        <StatusBar pollIntervalMs={Infinity} />
      </div>
    );
  },
};
