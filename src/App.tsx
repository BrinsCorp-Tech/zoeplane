/**
 * App — top-level application surface; composes HostShell which lays out the
 * six ux-spec §6.1 layout regions.
 *
 * Provider tree (QueryClientProvider > ThemeProvider > App) is established in
 * src/main.tsx — do NOT modify main.tsx.
 *
 * @see src/components/layout/HostShell/HostShell.tsx
 * @see src/main.tsx — provider tree
 */
import React from "react";
import { HostShell } from "./components/layout/HostShell/HostShell";

export default function App(): React.ReactElement {
  return <HostShell />;
}
