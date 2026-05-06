// ZoePlane — SectionLayout
//
// A labeled section within a PageLayout. Renders a section heading and wraps
// its children with consistent internal spacing. Used to group related content
// blocks within a route (e.g., "Recent Tasks" + "Quick Actions" on the Home view).
//
// Per ux-spec §8.2: section gap = var(--space-6) (24px).
// Heading uses --text-lg, --weight-medium per ux-spec §2.2 typography rules.
//
// TODO (Epic 02 Sprint 2): if sections need Suspense boundaries for async data,
// wrap children in <React.Suspense fallback={<SectionSkeleton />}>.
// See loading-architecture.md for route boundary categories.

import React from "react";
import { cn } from "../../lib/utils";

interface SectionLayoutProps {
  /** Section heading text. Optional — omit for visual-only grouping. */
  title?: string;
  /** Optional description line below the title */
  description?: string;
  children: React.ReactNode;
  /** Optional additional class names */
  className?: string;
  /** Optional heading element override (default: h2) */
  headingLevel?: "h1" | "h2" | "h3";
}

/**
 * SectionLayout renders a titled content section within a PageLayout.
 *
 * Usage:
 *   <SectionLayout title="Recent Skills" description="Skills you've used recently">
 *     <SkillCard ... />
 *     <SkillCard ... />
 *   </SectionLayout>
 */
export function SectionLayout({
  title,
  description,
  children,
  className,
  headingLevel: Heading = "h2",
}: SectionLayoutProps): React.ReactElement {
  return (
    <section
      className={cn("section-layout", className)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      {(title || description) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {title && (
            <Heading
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--weight-medium)",
                lineHeight: "var(--leading-snug)",
                color: "var(--color-foreground)",
              }}
            >
              {title}
            </Heading>
          )}
          {description && (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-foreground-muted)",
                lineHeight: "var(--leading-normal)",
              }}
            >
              {description}
            </p>
          )}
        </div>
      )}
      <div style={{ display: "contents" }}>{children}</div>
    </section>
  );
}

export default SectionLayout;
