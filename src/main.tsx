// ZoePlane — React entry point
// Tauri serves this via the Vite dev server in development and the built dist/ in production.

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import App from "./App";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { Toaster } from "./components/ui/Toast/Toast";
import { useAppStore } from "./stores/app";
import "./styles/globals.css";

// Expose the store at module scope so it is accessible from the root component
// tree (AC #2). Domain code should import useAppStore directly — this
// reference prevents tree-shaking from eliminating the import.
void useAppStore.getState;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable automatic background refetch on window focus for the desktop
      // context — Tauri windows don't have the same tab-focus semantics as a browser.
      refetchOnWindowFocus: false,
      // Stale time: 60 s default; individual queries can override.
      staleTime: 60_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
        <Toaster />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
