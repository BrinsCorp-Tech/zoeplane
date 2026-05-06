# ZoePlane UI Components (`src/components/ui/`)

This directory contains the **shadcn/ui base components** — the foundation tier of the ZoePlane design system. It is empty at scaffold time; components are added during Epic 02 Sprint 1.

## Component authoring guide

Every component in this directory must satisfy the Epic 02 acceptance criteria:

### 8-section component spec (per ux-spec §8.10)

Before implementing a component, the ux-designer spec document must exist with:
1. **Purpose** — what problem this component solves
2. **Variants** — all visual variants (e.g., Button: primary / ghost / destructive)
3. **States** — all interactive states (default / hover / focus / active / disabled / loading)
4. **Props** — TypeScript interface with JSDoc for each prop
5. **Behavior** — interaction rules (keyboard, pointer, focus management)
6. **Responsive** — behavior at `--bp-compact` (1024px) vs `--bp-comfortable` (1280px)
7. **Accessibility** — ARIA roles, keyboard navigation, `aria-label` requirements
8. **Edge cases** — overflow, empty content, long strings, RTL readiness

### Token rules

- Components consume **ONLY** semantic tokens (Layer 2) or component tokens (Layer 3).
- NEVER consume primitive tokens (Layer 1) directly — e.g., `var(--gray-900)` in a component is a violation.
- NEVER branch on theme in component code — no `data-theme === 'dark'` checks. Themes are CSS-only.
- Follow the ESLint rule: `no-component-theme-branch` (added Sprint 1).

### Reduced-motion

Every animated component must provide a `prefers-reduced-motion: reduce` variant.
The `--duration-*` tokens in `tokens.css` zero out via the media query — this handles
transition-based animations automatically. For animation-ID-specific variants (A-01..A-37),
document the reduced-motion treatment in the component's Storybook story.

### shadcn/ui integration

ZoePlane uses shadcn/ui as the component primitive library. To add a component:

```bash
# Bun-compatible invocation
bunx shadcn@latest add button
```

After adding: review the generated file and replace any hardcoded HSL values with
ZoePlane semantic token references (e.g., `hsl(var(--primary))` → `var(--color-accent)`).

shadcn/ui ships with a Tailwind-compatible token convention (`--primary`, `--secondary`,
etc.) which we map to ZoePlane's semantic layer in `tailwind.config.ts`.

### Sprint 1 P0 components to add (per ux-spec §8.1)

- Button (primary, ghost, destructive variants)
- Input
- Select
- Checkbox
- Radio
- Tooltip
- Toast (+ ToastQueue)
- Modal (+ ExpandedScopeConfirmation variant per ux-spec §8.3)
- Card (base card primitive — 240×140 canonical size per ux-spec §1 Principle 6)
- Badge (+ EvaluatorStatusBadge cross-library component)
- Icon (wrapper for Lucide icons + custom ZoePlane icons)
- Skeleton (shimmer + static-fill reduced-motion variant)
- Spinner
- Tabs
- Dropdown
