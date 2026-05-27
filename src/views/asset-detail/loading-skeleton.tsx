/**
 * AssetDetailView — loading skeleton (2-boundary per loading-architecture.md §skills.detail)
 *
 * Boundary 1: Front-matter form skeleton (5 rows)
 * Boundary 2: Body content skeleton (8 lines)
 *
 * Story: 6.16 — renamed from SkillDetailLoadingSkeleton (generic, no behavioral change)
 */

import { Skeleton } from "@/components/ui/Skeleton/Skeleton";

export function AssetDetailLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading asset…"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
        padding: "var(--space-6)",
      }}
    >
      {/* Boundary 1: Front-matter form skeleton — 5 rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <Skeleton variant="custom" className="h-3" style={{ width: "80px" }} />
            <Skeleton
              variant="custom"
              className="h-5"
              style={{ width: i === 0 ? "140px" : "220px" }}
            />
          </div>
        ))}
      </div>

      {/* Boundary 2: Body content skeleton — 8 lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            style={{ width: i === 7 ? "60%" : `${80 + (i % 3) * 8}%` }}
          />
        ))}
      </div>
    </div>
  );
}
