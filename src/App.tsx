// ZoePlane — Root application component
//
// Sprint 1 stub: renders a minimal shell that confirms Tauri IPC and token system
// are wired. Replace with HostShell (Epic 02 Sprint 2) once layout tier lands.
//
// TODO (Epic 02 Sprint 2): replace this stub with <HostShell /> from
//   src/components/layout/PageLayout.tsx → HostShell composing Sidebar +
//   TitleBar + PrimaryWorkArea per ux-spec §8.2.

import React from "react";

export default function App(): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: "var(--space-4)",
        background: "var(--color-background)",
        color: "var(--color-foreground)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--weight-semibold)" }}>
        ZoePlane
      </h1>
      <p style={{ color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)" }}>
        Sprint 1 scaffold — design system tokens loaded
      </p>
      {/* TODO (Epic 02): replace with <HostShell /> */}
    </div>
  );
}
