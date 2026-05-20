/**
 * App — top-level application surface; composes HostShell which lays out the
 * six ux-spec §6.1 layout regions.
 *
 * Provider tree (QueryClientProvider > ThemeProvider > App) is established in
 * src/main.tsx — do NOT modify main.tsx.
 *
 * Side effect: registers the Tauri "sidecar-ready" listener once on mount.
 * Without this call, getSidecarBaseUrl() never resolves and the Library
 * views render blank because their TanStack Query is permanently disabled.
 *
 * @see src/components/layout/HostShell/HostShell.tsx
 * @see src/lib/sidecar-client.ts — initSidecarClient
 * @see src/main.tsx — provider tree
 */
import React from "react";
import { HostShell } from "./components/layout/HostShell/HostShell";
import { initSidecarClient } from "./lib/sidecar-client";

export default function App(): React.ReactElement {
  React.useEffect(() => {
    initSidecarClient();
  }, []);

  return <HostShell />;
}
