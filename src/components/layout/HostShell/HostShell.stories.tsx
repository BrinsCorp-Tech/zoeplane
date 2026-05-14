/**
 * HostShell stories — Story 2.8 AC #10 coverage
 *
 * Light + dark variants of the empty-state HostShell (no project open).
 * The "with project" variant seeds _setProjectRoot so the project-open
 * branch renders.
 *
 * NOTE: Tauri invoke("sidecar_status") calls fail in Storybook (no Tauri
 * runtime). StatusBar gracefully falls back to "Sidecar offline" — expected.
 * pollIntervalMs default (5000) is used here; Storybook does not freeze timers.
 *
 * Theme decorator is global from Story 2.4 — no per-story setup needed.
 */
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { HostShell } from "./HostShell";
import { useAppStore } from "@/stores/app";

const meta: Meta<typeof HostShell> = {
  title: "Layout/HostShell",
  component: HostShell,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof HostShell>;

// ─── Empty state — no project open ───────────────────────────────────────────

/**
 * Default empty-state HostShell in light theme.
 * No project in store — PrimaryWorkArea shows "No project open" placeholder.
 */
export const EmptyStateLight: Story = {
  name: "Empty state — no project (light)",
  render: () => (
    <div data-theme="light" style={{ height: "100vh" }}>
      <HostShell />
    </div>
  ),
};

/**
 * Default empty-state HostShell in dark theme.
 * No project in store — PrimaryWorkArea shows "No project open" placeholder.
 */
export const EmptyStateDark: Story = {
  name: "Empty state — no project (dark)",
  render: () => (
    <div data-theme="dark" style={{ height: "100vh" }}>
      <HostShell />
    </div>
  ),
};

// ─── Project open ─────────────────────────────────────────────────────────────

/**
 * Project open — store is seeded via useEffect and cleaned up on unmount.
 * PrimaryWorkArea shows the Epic 03 placeholder (route wiring is Epic 03 scope).
 */
export const ProjectOpenLight: Story = {
  name: "Project open — Epic 03 placeholder (light)",
  render: () => {
    React.useEffect(() => {
      useAppStore.getState()._setProjectRoot("/Users/example/project");
      return () => {
        useAppStore.getState()._setProjectRoot(null);
      };
    }, []);

    return (
      <div data-theme="light" style={{ height: "100vh" }}>
        <HostShell />
      </div>
    );
  },
};

/**
 * Project open — dark theme variant.
 */
export const ProjectOpenDark: Story = {
  name: "Project open — Epic 03 placeholder (dark)",
  render: () => {
    React.useEffect(() => {
      useAppStore.getState()._setProjectRoot("/Users/example/project");
      return () => {
        useAppStore.getState()._setProjectRoot(null);
      };
    }, []);

    return (
      <div data-theme="dark" style={{ height: "100vh" }}>
        <HostShell />
      </div>
    );
  },
};

// ─── Children injection (Storybook snapshot utility) ─────────────────────────

/**
 * Children-prop variant — bypasses project-state branch entirely.
 * Useful for snapshotting specific PrimaryWorkArea content in isolation.
 */
export const WithChildren: Story = {
  name: "Children prop — custom content (light)",
  render: () => (
    <div data-theme="light" style={{ height: "100vh" }}>
      <HostShell>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            fontSize: "var(--text-sm)",
            color: "var(--color-foreground-muted)",
          }}
        >
          Custom story content injected via children prop
        </div>
      </HostShell>
    </div>
  ),
};
