// ZoePlane — PageLayout
//
// Wraps the primary work area of a given route with consistent spacing tokens.
// This is the outermost layout shell for in-app routes — not the application
// chrome (HostShell). HostShell (sidebar + title bar + status bar) lives above
// this; PageLayout composes the content *within* the PrimaryWorkArea slot.
//
// Per ux-spec §8.2 (Layout tier): PrimaryWorkArea is a flex column with
// vertical scroll, padding var(--space-6), gap var(--space-6) between sections.
//
// TODO (Epic 02 Sprint 2): implement HostShell that positions PageLayout in the
// PrimaryWorkArea slot alongside Sidebar and Inspector. See ux-spec §8.2.

import React from "react";
import { cn } from "../../lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  /** Optional additional class names — prefer token-based styling */
  className?: string;
}

/**
 * PageLayout wraps a route's content with proper spacing and scroll behavior.
 *
 * Usage:
 *   <PageLayout>
 *     <SectionLayout title="Skills">...</SectionLayout>
 *     <SectionLayout title="Recent">...</SectionLayout>
 *   </PageLayout>
 */
export function PageLayout({ children, className }: PageLayoutProps): React.ReactElement {
  return (
    <main
      className={cn("page-layout", className)}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflowY: "auto",
        padding: "var(--space-6)",
        gap: "var(--space-6)",
        background: "var(--color-background)",
        color: "var(--color-foreground)",
      }}
    >
      {children}
    </main>
  );
}

export default PageLayout;
