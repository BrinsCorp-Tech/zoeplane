/**
 * LibraryShell — cross-library card grid primitive.
 *
 * The single P0 component consumed by ALL six resource library views:
 * Skills, Agents, Commands, Hooks, Teams, Workflows.
 *
 * Per PRD §1.10 v2.3 (cards-canonical principle) and ux-spec §1 Principle 6,
 * every library uses one unified card-grid layout. LibraryShell enforces this
 * constraint architecturally — consumers pass items + renderCard; the shell
 * handles layout, filtering, and state transitions.
 *
 * State-machine priority order (LibraryShell-spec §3.1 — load-bearing):
 *   1. error   → ERROR    (highest priority — overrides everything)
 *   2. loading → LOADING  (C2 skeleton grid, 12 CardSkeletons)
 *   3. items.length === 0 → EMPTY (post-filter; distinct from loading)
 *   4. populated → POPULATED (card grid with filtered items)
 *
 * Dense-list view-mode toggle: FORBIDDEN in v1 per Story 2.11 AC #9 and
 * LibraryShell-spec §8 "Edge Cases". Cards-only. No viewMode prop. No list-view
 * rendering branch. No toggle button. See LibraryShell-spec.md §2 rationale.
 *
 * Roving-tabindex 2D arrow-key navigation: DEFERRED to Sprint 3 per
 * LibraryShell-spec §5.4. v1 ships linear Tab-only navigation through cards.
 * The grid container manages keyboard focus linearly; 2D grid-aware arrow
 * navigation (getBoundingClientRect column-count inference) is a Sprint 3
 * polish item.
 *
 * @see docs/design/components/LibraryShell-spec.md
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input/Input";
import { TabsRoot, TabsList, Tab, TabPanel } from "@/components/ui/Tabs/Tabs";
import { CardSkeleton } from "@/components/ui/Skeleton/CardSkeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Scope tab configuration — defines the tab labels and filter predicates.
 * The shell does NOT auto-prepend an "All" tab; consumers control vocabulary.
 */
export interface ScopeTabConfig<T> {
  /** Tab definitions in display order. */
  tabs: Array<{
    /** Unique value within this config. Used as Tabs.Root value. */
    value: string;
    /** Visible tab label, sentence case, ≤ 16 chars per Tabs spec. */
    label: string;
    /** Filter predicate — items where this returns true pass the scope filter. */
    predicate: (item: T) => boolean;
  }>;
  /** Initial active scope value. Must match one of tabs[].value. */
  defaultValue: string;
  /** aria-label for the TabsList. Defaults to "Filter by scope". */
  tabsAriaLabel?: string;
}

/**
 * LibraryShellProps<T> — story 2.11 locked contract (Maya's spec §4).
 *
 * NOTE: `loadingState` is intentionally NOT a consumer slot. The loading visual
 * is a fixed C2 skeleton grid (12 CardSkeletons) per loading-architecture.md
 * §"Three categories of loading". Operator-approved deviation from AC #1 wording
 * which listed `loadingState` as a slot — allowing consumer override would violate
 * ux-spec §1 Principle 6 (cross-library layout uniformity). See operator decision
 * in story-2.11 context block.
 */
export interface LibraryShellProps<T> {
  /**
   * The list of items to render. Generic T is unconstrained — pass any resource
   * type (Skill, Agent, Command, Hook, Team, Workflow, or custom).
   */
  items: T[];

  /**
   * Per-item card renderer. Called once per item surviving search + scope
   * filters. The shell wraps the return value in a role="listitem" container.
   */
  renderCard: (item: T) => React.ReactNode;

  /**
   * Accessible label for the shell region. Required.
   * Examples: "Hooks library", "Skills library".
   * Also used in the loading state: "Loading hooks library".
   */
  ariaLabel: string;

  /**
   * Loading state — set true while the first data fetch is in flight.
   * Triggers the fixed C2 skeleton grid (12 CardSkeletons).
   */
  loading?: boolean;

  /**
   * Error state — when non-null the shell renders errorState instead of the grid.
   */
  error?: Error | null;

  /**
   * Empty-state slot. Rendered when items is empty AND loading is false AND
   * error is null. Consumer-supplied ReactNode. Distinct from loading per
   * loading-architecture.md §"Empty states (distinct from loading)".
   */
  emptyState: React.ReactNode;

  /**
   * Error-state slot. Rendered when error is non-null. Consumer-supplied
   * ReactNode — MUST include a retry affordance (a Button calling the
   * consumer's refetch function).
   */
  errorState: React.ReactNode;

  /**
   * Placeholder copy for the search input. When omitted, the search input
   * is NOT rendered.
   */
  searchPlaceholder?: string;

  /**
   * Search predicate. Called once per item with the current search term.
   * Return true to include the item. When omitted, defaults to a
   * case-insensitive String.includes match against String(item) — adequate for
   * development but NOT recommended for real consumers. Every real consumer
   * SHOULD supply this.
   */
  searchPredicate?: (item: T, term: string) => boolean;

  /**
   * Scope tab definition. When omitted, scope tabs are NOT rendered.
   * The "All" pseudo-tab convention: include a tab with predicate () => true.
   *
   * **Performance note**: Memoize this prop at the call site (e.g., via `useMemo`
   * or by hoisting to module scope). Passing an inline object literal creates a new
   * reference on every parent render, causing `filteredItems` to recompute even when
   * the tab configuration has not changed. For library views with 200+ items this
   * produces noticeable CPU burn.
   */
  scopeTabs?: ScopeTabConfig<T>;

  /**
   * Filter chip slot. Consumer-rendered ReactNode containing domain-specific
   * filter affordances (Dropdowns, etc.). The shell does NOT define filter
   * vocabulary; consumers apply these filters to `items` BEFORE passing them in.
   */
  filterConfig?: React.ReactNode;

  /**
   * Optional className applied to the root <section>. For consumer positioning
   * (margin, max-width). MUST NOT override grid layout or token colors.
   */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LibraryShell<T> — generic-typed cross-library card grid container.
 *
 * Implements the state-machine from LibraryShell-spec §3.1:
 *   error → loading → empty → populated
 *
 * @see docs/design/components/LibraryShell-spec.md
 */
export function LibraryShell<T>({
  items,
  renderCard,
  ariaLabel,
  loading = false,
  error = null,
  emptyState,
  errorState,
  searchPlaceholder,
  searchPredicate,
  scopeTabs,
  filterConfig,
  className,
}: LibraryShellProps<T>): React.ReactElement {
  // ── Internal state ──────────────────────────────────────────────────────────

  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedTerm, setDebouncedTerm] = React.useState("");
  const [activeScope, setActiveScope] = React.useState<string>(scopeTabs?.defaultValue ?? "");

  // Dev-mode warnings
  React.useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      scopeTabs &&
      scopeTabs.tabs.length > 0 &&
      !scopeTabs.tabs.find((t) => t.value === scopeTabs.defaultValue)
    ) {
      console.warn(
        `[LibraryShell] scopeTabs.defaultValue "${scopeTabs.defaultValue}" does not match any tab value. Scope filter will pass all items.`,
      );
    }
  }, []); // intentional: scopeTabs is checked once on mount for dev-mode warning only

  // ── Debounce search (150 ms per LibraryShell-spec §5.1) ────────────────────

  React.useEffect(() => {
    if (searchTerm === "") {
      setDebouncedTerm("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ── Filter pipeline (LibraryShell-spec §5.1 — scope first, then search) ───

  const filteredItems = React.useMemo<T[]>(() => {
    // 1. Apply scope tab predicate
    let result = items;
    if (scopeTabs && activeScope) {
      const activeScopeTab = scopeTabs.tabs.find((t) => t.value === activeScope);
      if (activeScopeTab) {
        result = result.filter(activeScopeTab.predicate);
      }
    }

    // 2. Apply search predicate (skip when term is empty)
    if (debouncedTerm !== "") {
      if (searchPredicate) {
        result = result.filter((item) => searchPredicate(item, debouncedTerm));
      } else {
        // Default: case-insensitive String.includes against String(item)
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[LibraryShell] No searchPredicate provided. Defaulting to String.includes — for non-primitive items this may match nothing. Supply a searchPredicate.",
          );
        }
        result = result.filter((item) =>
          String(item).toLowerCase().includes(debouncedTerm.toLowerCase()),
        );
      }
    }

    return result;
  }, [items, activeScope, debouncedTerm, searchPredicate, scopeTabs]);

  // ── State machine (LibraryShell-spec §3.1 priority order) ─────────────────

  const renderHeader = () => {
    const hasSearch = Boolean(searchPlaceholder);
    const hasTabs = Boolean(scopeTabs && scopeTabs.tabs.length > 0);
    const hasFilter = Boolean(filterConfig);

    if (!hasSearch && !hasTabs && !hasFilter) return null;

    return (
      <header className="mb-4 flex flex-col gap-3">
        {/* Search + scope tabs row */}
        {(hasSearch || hasTabs) && (
          <div className="flex flex-wrap items-center gap-3">
            {hasSearch && (
              <Input
                type="search"
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            )}
            {hasTabs && scopeTabs && scopeTabs.tabs.length > 0 && (
              <TabsRoot value={activeScope} onValueChange={setActiveScope}>
                <TabsList
                  variant="pill"
                  size="sm"
                  aria-label={scopeTabs.tabsAriaLabel ?? "Filter by scope"}
                >
                  {scopeTabs.tabs.map((tab) => (
                    <Tab key={tab.value} value={tab.value} variant="pill" size="sm">
                      {tab.label}
                    </Tab>
                  ))}
                </TabsList>
                {/*
                 * Hidden TabPanels — required for valid aria-controls references.
                 *
                 * Radix Tabs.Trigger emits aria-controls="<panel-id>" pointing to its
                 * corresponding TabPanel. Without panels, aria-controls references
                 * a nonexistent DOM element, triggering axe aria-valid-attr-value.
                 *
                 * These panels are visually empty (display:none when inactive) and
                 * carry no content — the card grid below is the semantic "panel" as
                 * described in LibraryShell-spec §5.2. This satisfies Radix + axe
                 * without adding visual content.
                 */}
                {scopeTabs.tabs.map((tab) => (
                  <TabPanel key={tab.value} value={tab.value} />
                ))}
              </TabsRoot>
            )}
          </div>
        )}

        {/* Filter chip slot (consumer-rendered) */}
        {hasFilter && <div>{filterConfig}</div>}
      </header>
    );
  };

  const renderContent = () => {
    // STATE: ERROR (highest priority)
    if (error) {
      return <div>{errorState}</div>;
    }

    // STATE: LOADING — fixed C2 skeleton grid (12 CardSkeletons)
    if (loading) {
      return (
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          aria-label={`Loading ${ariaLabel}`}
          className="library-shell-grid"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      );
    }

    // STATE: EMPTY (items.length === 0 post-filter, including filtered-empty)
    if (filteredItems.length === 0) {
      return <div>{emptyState}</div>;
    }

    // STATE: POPULATED — card grid
    return (
      <div role="list" aria-label={`${ariaLabel} items`} className="library-shell-grid">
        {filteredItems.map((item, index) => (
          <div key={index} role="listitem">
            {renderCard(item)}
          </div>
        ))}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section aria-label={ariaLabel} className={cn("w-full", className)}>
      {renderHeader()}
      {renderContent()}
    </section>
  );
}
