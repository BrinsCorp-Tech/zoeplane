/**
 * LibraryShell — structural accessibility tests (Story 2.11 AC #11)
 *
 * Validates the ARIA contract using axe-core via JSDOM:
 *   - Root <section> has aria-label (region landmark)
 *   - Search input has aria-label (tied to searchPlaceholder)
 *   - Scope tabs use role="tablist" + role="tab" (via Radix Tabs)
 *   - Card grid has role="list" with aria-label
 *   - Each card wrapper has role="listitem"
 *   - Loading state uses role="status" aria-busy="true" aria-live="polite"
 *   - CardSkeleton instances are aria-hidden inside the loading region
 *   - axe-core reports zero structural violations across all state variants
 *
 * JSDOM limitation — OKLCH contrast:
 *   JSDOM cannot compute OKLCH colour values; getComputedStyle returns empty
 *   strings for CSS custom properties that reference OKLCH tokens. Therefore:
 *   - axe-core's color-contrast rule is DISABLED in this harness.
 *   - Colour contrast verification (WCAG 1.4.3 AA) deferred to Story 2.13
 *     which requires a real browser with CSS rendering.
 *
 * To run this test alone:
 *   bun run test --reporter=verbose src/components/library-shell/__tests__/LibraryShell.a11y.test.tsx
 */

import axe from "axe-core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LibraryShell } from "../LibraryShell";

// Unmount React trees between tests — prevents "found multiple elements" errors.
afterEach(() => {
  cleanup();
});

// ─── Mock data ────────────────────────────────────────────────────────────────

interface MockItem {
  id: string;
  name: string;
  scope: "user" | "project";
}

const ITEMS: MockItem[] = [
  { id: "1", name: "alpha", scope: "user" },
  { id: "2", name: "beta", scope: "project" },
  { id: "3", name: "gamma", scope: "user" },
];

function MockCard({ item }: { item: MockItem }) {
  return (
    <div tabIndex={0} style={{ border: "1px solid gray", padding: "8px", borderRadius: "4px" }}>
      {item.name}
    </div>
  );
}

function EmptySlot() {
  return <div>No items found.</div>;
}

function ErrorSlot({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert">
      <span>Failed to load.</span>
      <button onClick={onRetry}>Retry</button>
    </div>
  );
}

// ─── axe helper ───────────────────────────────────────────────────────────────

async function runAxe(container: HTMLElement): Promise<axe.AxeResults> {
  return new Promise((resolve, reject) => {
    axe.run(
      container,
      {
        rules: {
          // Disabled: JSDOM cannot compute OKLCH CSS custom property values.
          // Contrast verification deferred to Story 2.13 in-browser test.
          "color-contrast": { enabled: false },
        },
      },
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      },
    );
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LibraryShell — structural accessibility (Story 2.11 AC #11)", () => {
  // ── Region landmark ────────────────────────────────────────────────────────

  describe("root region landmark", () => {
    it("renders a <section> with aria-label (region landmark)", () => {
      const { container } = render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      const section = container.querySelector("section");
      expect(section).not.toBeNull();
      expect(section?.getAttribute("aria-label")).toBe("Skills library");
    });

    it("region is queryable by role + name", () => {
      render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      expect(screen.getByRole("region", { name: "Skills library" })).toBeDefined();
    });
  });

  // ── Search input ───────────────────────────────────────────────────────────

  describe("search input", () => {
    it("renders search input with aria-label when searchPlaceholder is provided", () => {
      render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          searchPlaceholder="Search skills..."
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      const searchInput = screen.getByRole("searchbox", { name: "Search skills..." });
      expect(searchInput).toBeDefined();
    });

    it("does NOT render search input when searchPlaceholder is omitted", () => {
      render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      expect(screen.queryByRole("searchbox")).toBeNull();
    });
  });

  // ── Scope tabs ─────────────────────────────────────────────────────────────

  describe("scope tabs", () => {
    it("renders role=tablist with aria-label when scopeTabs is provided", () => {
      render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          scopeTabs={{
            defaultValue: "all",
            tabsAriaLabel: "Filter by scope",
            tabs: [
              { value: "all", label: "All", predicate: () => true },
              { value: "user", label: "User", predicate: (i) => i.scope === "user" },
            ],
          }}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      expect(screen.getByRole("tablist", { name: "Filter by scope" })).toBeDefined();
    });

    it("renders individual tab triggers with role=tab", () => {
      render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          scopeTabs={{
            defaultValue: "all",
            tabs: [
              { value: "all", label: "All", predicate: () => true },
              { value: "user", label: "User", predicate: (i) => i.scope === "user" },
            ],
          }}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      const tabs = screen.getAllByRole("tab");
      expect(tabs.length).toBe(2);
    });

    it("does NOT render tablist when scopeTabs is omitted", () => {
      render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      expect(screen.queryByRole("tablist")).toBeNull();
    });
  });

  // ── Card grid (POPULATED state) ────────────────────────────────────────────

  describe("card grid — POPULATED state", () => {
    it("card grid container has role=list with aria-label", () => {
      render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      expect(screen.getByRole("list", { name: "Skills library items" })).toBeDefined();
    });

    it("each rendered card is wrapped in role=listitem", () => {
      render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      const listItems = screen.getAllByRole("listitem");
      expect(listItems.length).toBe(ITEMS.length);
    });
  });

  // ── LOADING state ──────────────────────────────────────────────────────────

  describe("LOADING state", () => {
    it('renders role="status" with aria-busy="true" aria-live="polite" when loading', () => {
      const { container } = render(
        <LibraryShell<MockItem>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          loading={true}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      const statusRegion = container.querySelector('[role="status"]');
      expect(statusRegion).not.toBeNull();
      expect(statusRegion?.getAttribute("aria-busy")).toBe("true");
      expect(statusRegion?.getAttribute("aria-live")).toBe("polite");
    });

    it('loading region aria-label includes "Loading" prefix + ariaLabel', () => {
      const { container } = render(
        <LibraryShell<MockItem>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          loading={true}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      const statusRegion = container.querySelector('[role="status"]');
      expect(statusRegion?.getAttribute("aria-label")).toBe("Loading Skills library");
    });

    it("CardSkeleton instances inside loading region are aria-hidden", () => {
      const { container } = render(
        <LibraryShell<MockItem>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          loading={true}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      // CardSkeleton outer wraps are aria-hidden
      const ariaHiddenDivs = container.querySelectorAll('[aria-hidden="true"]');
      // Should have 12 CardSkeleton outer wraps (plus individual Skeleton spans inside)
      expect(ariaHiddenDivs.length).toBeGreaterThanOrEqual(12);
    });

    it("does NOT render card grid role=list during loading", () => {
      render(
        <LibraryShell<MockItem>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          loading={true}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      expect(screen.queryByRole("list")).toBeNull();
    });
  });

  // ── EMPTY state ────────────────────────────────────────────────────────────

  describe("EMPTY state", () => {
    it("renders emptyState slot when items is empty and loading is false", () => {
      render(
        <LibraryShell<MockItem>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          loading={false}
          emptyState={<div data-testid="empty-slot">No items found.</div>}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      expect(screen.getByTestId("empty-slot")).toBeDefined();
    });

    it("does NOT render role=status when empty (empty is distinct from loading)", () => {
      const { container } = render(
        <LibraryShell<MockItem>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          loading={false}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      expect(container.querySelector('[role="status"]')).toBeNull();
    });
  });

  // ── ERROR state ────────────────────────────────────────────────────────────

  describe("ERROR state", () => {
    it("renders errorState slot when error is non-null", () => {
      render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          error={new Error("Network error")}
          emptyState={<EmptySlot />}
          errorState={<div data-testid="error-slot">Error occurred.</div>}
        />,
      );
      expect(screen.getByTestId("error-slot")).toBeDefined();
    });

    it("error state takes priority over loading state", () => {
      const { container } = render(
        <LibraryShell<MockItem>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          error={new Error("Network error")}
          loading={true}
          emptyState={<EmptySlot />}
          errorState={<div data-testid="error-slot-priority">Error.</div>}
        />,
      );
      // No loading skeleton when error is set
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(screen.getByTestId("error-slot-priority")).toBeDefined();
    });
  });

  // ── State machine priority ─────────────────────────────────────────────────

  describe("state machine priority (error > loading > empty > populated)", () => {
    it("shows error state when error + loading both truthy (error wins)", () => {
      render(
        <LibraryShell<MockItem>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          error={new Error("test")}
          loading={true}
          emptyState={<div data-testid="empty">empty</div>}
          errorState={<div data-testid="error">error</div>}
        />,
      );
      expect(screen.getByTestId("error")).toBeDefined();
      expect(screen.queryByTestId("empty")).toBeNull();
    });

    it("shows loading state when loading=true and no error", () => {
      const { container } = render(
        <LibraryShell<MockItem>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          loading={true}
          emptyState={<div data-testid="empty">empty</div>}
          errorState={<div data-testid="error">error</div>}
        />,
      );
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      expect(screen.queryByTestId("empty")).toBeNull();
    });

    it("shows empty state when items=[] loading=false error=null", () => {
      render(
        <LibraryShell<MockItem>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          loading={false}
          emptyState={<div data-testid="empty">empty</div>}
          errorState={<div data-testid="error">error</div>}
        />,
      );
      expect(screen.getByTestId("empty")).toBeDefined();
    });

    it("shows populated grid when items.length > 0 loading=false error=null", () => {
      render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          emptyState={<div data-testid="empty">empty</div>}
          errorState={<div data-testid="error">error</div>}
        />,
      );
      expect(screen.getByRole("list", { name: "Skills library items" })).toBeDefined();
      expect(screen.queryByTestId("empty")).toBeNull();
    });
  });

  // ── axe-core structural scans ──────────────────────────────────────────────

  describe("axe-core structural violations — zero expected across all states", () => {
    it("has zero axe violations — POPULATED state", async () => {
      const { container } = render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          searchPlaceholder="Search skills..."
          scopeTabs={{
            defaultValue: "all",
            tabsAriaLabel: "Filter by scope",
            tabs: [
              { value: "all", label: "All", predicate: () => true },
              { value: "user", label: "User", predicate: (i) => i.scope === "user" },
            ],
          }}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — LOADING state (12 CardSkeletons in status region)", async () => {
      const { container } = render(
        <LibraryShell<MockItem>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          loading={true}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — EMPTY state", async () => {
      const { container } = render(
        <LibraryShell<MockItem>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          loading={false}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — ERROR state (errorState slot with role=alert)", async () => {
      const { container } = render(
        <LibraryShell<MockItem>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          error={new Error("Network error")}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — POPULATED with tabs (role=tablist + role=list coexist)", async () => {
      const { container } = render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          searchPlaceholder="Search skills..."
          searchPredicate={(item, term) => item.name.toLowerCase().includes(term.toLowerCase())}
          scopeTabs={{
            defaultValue: "all",
            tabsAriaLabel: "Skill scope",
            tabs: [
              { value: "all", label: "All", predicate: () => true },
              { value: "user", label: "User", predicate: (i) => i.scope === "user" },
              { value: "project", label: "Project", predicate: (i) => i.scope === "project" },
            ],
          }}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });

    it("has zero axe violations — no chrome (no search, no tabs)", async () => {
      const { container } = render(
        <LibraryShell<MockItem>
          items={ITEMS}
          ariaLabel="Skills library"
          renderCard={(item) => <MockCard item={item} />}
          emptyState={<EmptySlot />}
          errorState={<ErrorSlot onRetry={() => {}} />}
        />,
      );
      const results = await runAxe(container);
      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.description}`).join("; "),
      ).toHaveLength(0);
    });
  });
});
