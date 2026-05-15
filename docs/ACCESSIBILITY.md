# Accessibility — ZoePlane

## Conformance Claim

ZoePlane targets **WCAG 2.2 Level AA** conformance for all UI surfaces introduced in Sprint 2 (Epic 02 design system). This is a development-phase claim, not a certified conformance statement. The surfaces listed under "Tested scope" have been validated against AA criteria via automated tooling; manual AT testing against a full release build has not yet been conducted.

No formal WCAG conformance statement (per WCAG-EM) has been issued. The claim will be formalized at the first release candidate with signed binaries.

## Tested Scope

Sprint 2 automated accessibility testing covers the following surfaces:

| Surface                                | Test type                    | Test file(s)                                                       |
| -------------------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| Semantic token contrast (light + dark) | OKLCH math (culori)          | `src/test/contrast-harness.a11y.test.ts`                           |
| Button (6 variants)                    | axe-core structural          | `src/components/ui/Button/__tests__/Button.a11y.test.tsx`          |
| Card                                   | axe-core structural          | `src/components/ui/Card/__tests__/`                                |
| Badge (7 variants)                     | axe-core structural          | `src/components/ui/Badge/__tests__/`                               |
| Input                                  | axe-core structural          | `src/components/ui/Input/__tests__/`                               |
| Icon                                   | axe-core structural          | `src/components/ui/Icon/__tests__/`                                |
| Modal (Radix Dialog)                   | axe-core structural          | `src/components/ui/Modal/__tests__/`                               |
| Toast + Toaster (Radix Toast)          | axe-core structural          | `src/components/ui/Toast/__tests__/`                               |
| Tooltip (Radix Tooltip)                | axe-core structural          | `src/components/ui/Tooltip/__tests__/`                             |
| Dropdown (Radix DropdownMenu)          | axe-core structural          | `src/components/ui/Dropdown/__tests__/`                            |
| FormField                              | axe-core structural          | `src/components/ui/FormField/__tests__/`                           |
| Select (Radix Select)                  | axe-core structural          | `src/components/ui/Select/__tests__/`                              |
| Checkbox (Radix Checkbox)              | axe-core structural          | `src/components/ui/Checkbox/__tests__/`                            |
| Radio (Radix RadioGroup)               | axe-core structural          | `src/components/ui/Radio/__tests__/`                               |
| Tabs (Radix Tabs)                      | axe-core structural          | `src/components/ui/Tabs/__tests__/`                                |
| Skeleton variants                      | axe-core structural          | `src/components/ui/Skeleton/__tests__/`                            |
| Spinner (4 sizes)                      | axe-core structural          | `src/components/ui/Spinner/__tests__/`                             |
| EvaluatorStatusBadge                   | axe-core structural          | `src/components/ui/EvaluatorStatusBadge/__tests__/`                |
| Sidebar                                | axe-core structural          | `src/components/layout/Sidebar/__tests__/`                         |
| Inspector                              | axe-core structural          | `src/components/layout/Inspector/__tests__/`                       |
| TitleBar                               | axe-core structural          | `src/components/layout/TitleBar/__tests__/`                        |
| StatusBar                              | axe-core structural          | `src/components/layout/StatusBar/__tests__/`                       |
| TabStrip                               | axe-core structural          | `src/components/layout/TabStrip/__tests__/`                        |
| PrimaryWorkArea                        | axe-core structural          | `src/components/layout/PrimaryWorkArea/__tests__/`                 |
| CommandPalette                         | axe-core structural          | `src/components/layout/CommandPalette/__tests__/`                  |
| NotificationsCenter                    | axe-core structural          | `src/components/layout/NotificationsCenter/__tests__/`             |
| CollapsiblePane                        | axe-core structural          | `src/components/layout/CollapsiblePane/__tests__/`                 |
| LibraryShell                           | axe-core structural          | `src/components/library-shell/__tests__/`                          |
| Animation catalog (A-01..A-41)         | CSS invariant (source parse) | `src/components/__tests__/animations-reduced-motion.a11y.test.tsx` |

All 28 per-component test files use `axe-core` directly (not via `jest-axe`), invoked through the canonical helper at `src/test/helpers/runAxe.ts`.

## WCAG 2.2 AA — Contrast Enforcement

### Engine

The contrast harness uses `culori v4` (`wcagContrast(fg, bg)`) for all contrast calculations. This is the authoritative contrast engine for ZoePlane because:

- ZoePlane's design token cascade uses OKLCH (`oklch(L C H)`) for all primitive colors (see `packages/design-tokens/src/tokens.seed.json`). JSDOM cannot compute CSS custom properties at runtime, so axe-core's built-in `color-contrast` rule cannot resolve OKLCH tokens in a test environment.
- `culori` is OKLCH-native: `parse("oklch(0.985 0.002 250)")` produces a typed color object; `wcagContrast(fg, bg)` computes WCAG relative luminance via an accurate OKLCH→XYZ→sRGB chain with no lossy intermediate format conversion.

For this reason, **the `color-contrast` axe rule is disabled in all per-component tests** (`src/test/helpers/runAxe.ts:8-10`). Contrast is validated exclusively by the harness.

### Thresholds

| Pair type                                  | Required ratio | Criterion          |
| ------------------------------------------ | -------------- | ------------------ |
| Body text (< 18pt / 14pt bold)             | ≥ 4.5:1        | WCAG 2.2 AA 1.4.3  |
| Large text (≥ 18pt / 14pt bold)            | ≥ 3.0:1        | WCAG 2.2 AA 1.4.3  |
| Non-text UI components / graphical objects | ≥ 3.0:1        | WCAG 2.2 AA 1.4.11 |

AAA (≥ 7.0:1 body / ≥ 4.5:1 large text) ratio gaps are logged to test output but do not fail the suite.

### Validated pairs

The harness validates 26 semantic token pairs × 2 themes. Fixtures live at `src/test/fixtures/semantic-token-pairs.ts`. The full set covers:

- Surface/foreground pairs: `--color-background` / `--color-foreground`, `--color-surface` / `--color-foreground`, and muted/subtle/disabled text variants
- Brand/interactive: `--color-accent` / `--color-accent-foreground` (and muted variants)
- Status: success, warning, danger, info, quarantine — each in default and muted-surface variants, both themes
- Border contrast: focus ring, border-strong against surface

### In-sprint correction

The `success-600` primitive was darkened from `oklch(0.560 0.170 150)` to `oklch(0.540 0.170 150)` during Story 2.13 to bring the `--color-success` / white foreground pair from 4.32:1 to 4.69:1, clearing the 4.5:1 AA threshold. The updated value is in `packages/design-tokens/src/tokens.seed.json`.

### Running the contrast harness

```bash
bun run test:contrast
```

This alias runs `contrast-harness.a11y.test.ts` in isolation. The full test suite (`bun run test`) also includes it.

## prefers-reduced-motion

ZoePlane enforces `prefers-reduced-motion` at three layers:

### Layer 1 — Motion token zeroing (global, CSS)

`src/styles/globals.css` contains a nuclear block under `@media (prefers-reduced-motion: reduce)` that sets `animation-duration` and `transition-duration` to `0ms` on all elements. This makes every transition-based animation instantaneous without requiring per-component reduced-motion branches.

In addition, the motion tokens themselves are zeroed at the token layer:

```css
/* packages/design-tokens/style-dictionary.config.mjs — emitted to tokens.css */
@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-fast: 0ms;
    --motion-duration-base: 0ms;
    --motion-duration-slow: 0ms;
  }
}
```

Any animation that consumes `var(--motion-duration-*)` becomes instantaneous when `prefers-reduced-motion: reduce` is active.

### Layer 2 — Infinite-loop explicit override (per-animation class, CSS)

Infinite animations (e.g., `A-12` approval-pulse, `A-27` skeleton shimmer) cannot be silenced by duration-zeroing alone — an infinite animation with `duration: 0` would still loop. Each infinite animation class in `src/styles/animations.css` carries an explicit `.prefers-reduced-motion .X { animation: none }` rule in the class-based fallback block. This class-based override targets the Storybook reduced-motion decorator (which adds `.prefers-reduced-motion` to the story container rather than using a media query).

### Layer 3 — Guard test (CI-enforced invariant)

`src/components/__tests__/animations-reduced-motion.a11y.test.tsx` parses the `animations.css` source, finds all animation classes containing `infinite`, and asserts that each one has a corresponding `.prefers-reduced-motion .X { animation: none }` rule in the class-based fallback block. This test runs on every CI push and blocks merge if any new infinite animation is added without its reduced-motion override.

To run the guard test alone:

```bash
bun run test --reporter=verbose src/components/__tests__/animations-reduced-motion.a11y.test.tsx
```

## Semantic HTML and ARIA Patterns

The following patterns are used throughout the component library:

### Landmark roles

| Component       | Role / element                       | Notes                                                    |
| --------------- | ------------------------------------ | -------------------------------------------------------- |
| TitleBar        | `role="banner"`                      | `<header role="banner">` equivalent at application level |
| Sidebar         | `role="navigation"`                  | Primary navigation landmark                              |
| Inspector       | `role="complementary"`               | Secondary content panel                                  |
| StatusBar       | `role="contentinfo"`                 | Application status / footer landmark                     |
| PrimaryWorkArea | `role="main"` (implicit or explicit) | Primary content area                                     |

### Interactive semantics

- **Button disabled state**: `aria-disabled="true"` + `pointer-events: none` rather than the native `disabled` attribute. This preserves keyboard focus on the element (browsers skip natively-disabled elements in tab order), ensuring screen reader users can still discover the button exists and understand its state.
- **Button loading state**: `aria-busy="true"` + `aria-disabled="true"` + `aria-live="polite"`. The button label is preserved visually (no CLS); a Spinner appears alongside the label.
- **Icon-only buttons**: Must supply an `aria-label` at the call site — this is a consumer responsibility, not enforced by the Button component itself.
- **Focus ring**: `focus-visible` CSS pseudo-class used for all interactive elements. Focus ring uses `--color-focus-ring` (= `--color-border-focus`, = `--accent-600` in light / `--accent-400` in dark). Focus ring is instant-by-design and has no animation (catalog entry A-11 is an intentional no-op per WCAG 2.4.11).
- **Modal (Radix Dialog)**: `aria-modal="true"`, focus trap managed by Radix. `region` axe rule disabled in modal tests (Radix portals content outside the landmark structure in JSDOM).
- **FormField `groupRole`**: When `groupRole="group"`, FormField wraps its children in a `<fieldset>` / `<legend>` pair. This covers radio and checkbox sets where the group label is semantically associated with each input.

## Storybook Accessibility Tooling

Storybook 8 (`.storybook/main.ts` + `.storybook/preview.ts`) ships two global decorators relevant to accessibility:

- **Theme toggle** — switches `data-theme` on the story container between `"light"` and `"dark"`. Allows manual visual inspection of contrast in both themes.
- **Reduced-motion toggle** — adds/removes the `.prefers-reduced-motion` class on the story container, triggering the class-based animation overrides without requiring an OS-level media query change.

Chromatic visual regression (`docs/runbooks/chromatic-baseline-lock.md`) captures both themes × both motion modes in the baseline matrix once `CHROMATIC_PROJECT_TOKEN` is provisioned.

## Known Limitations

- **Automated AT testing not yet conducted**: Screen reader testing with VoiceOver (macOS), NVDA (Windows), or Orca (Linux) has not been performed on a signed release build. The automated harness verifies structural semantics (ARIA roles, labels, button types) but cannot substitute for AT walkthroughs.
- **`color-contrast` axe rule disabled in JSDOM**: JSDOM cannot resolve OKLCH CSS custom properties, so axe-core cannot verify contrast ratios in unit tests. The contrast harness (`culori`-based) compensates, but it tests DTCG token pairs, not arbitrary component-level color combinations.
- **Focus management in portaled components**: Modal, Dropdown, Tooltip, and CommandPalette portal their content via Radix. Focus trap behavior is correct in a real browser; JSDOM testing of focus order is limited. Full focus management verification requires manual AT testing in a built app.
- **Deep-link and notification surfaces**: The `zoeplane://` deep-link handler (Epic 10) and the notification popover surfaces outside the main window have not been assessed. These are explicitly out of scope for Sprint 2.
- **Tauri native chrome (TitleBar traffic lights, window controls)**: The native macOS traffic-light buttons and Windows title-bar controls are outside the WebView and cannot be tested via axe-core or culori. Their accessibility is the OS's responsibility.

## Reporting Accessibility Issues

See `docs/SECURITY.md` for the security contact. Accessibility issues that are not security-sensitive may be filed as GitHub issues at `github.com/BrinsCorp-Tech/zoeplane/issues` with the label `accessibility`.

## Implementation Guidance for Contributors

### Adding a new component

1. Consume semantic tokens only (`--color-*`, `--text-*`, `--space-*`). Never use raw OKLCH literals or hex values in component files.
2. Use `role` attributes and ARIA properties that reflect the component's semantic role, not its visual appearance.
3. For interactive elements, use `focus-visible` (not `focus`) for focus ring styles.
4. If the component has a loading or disabled state, follow the Button pattern: `aria-busy`/`aria-disabled` over native `disabled` where keyboard discoverability matters.
5. Add a `*.a11y.test.tsx` using the `runAxe` helper from `src/test/helpers/runAxe.ts`. The `color-contrast` rule should be disabled (it is in the default `DEFAULT_RULES` object).
6. Add a Storybook story with at least a default story and a dark-theme story.

### Adding a new animation

1. Add the class to `src/styles/animations.css` following the `animate-A-NN-kebab-name` convention.
2. Use motion tokens (`var(--motion-duration-*)`, `var(--motion-easing-*)`). Never hardcode duration values in ms.
3. If the animation uses `animation-iteration-count: infinite`, add a `.prefers-reduced-motion .animate-A-NN-kebab-name { animation: none }` rule in the class-based fallback block immediately following the keyframe declaration. The guard test will fail on CI if this is omitted.
4. Add a Storybook story to `src/styles/Animations.stories.tsx`.

### Modifying semantic tokens

1. Edit `packages/design-tokens/src/tokens.seed.json` for primitive values.
2. Edit `packages/design-tokens/style-dictionary.config.mjs` for semantic and component layer changes.
3. After any primitive color change, run `bun run test:contrast` to verify all 26 token pairs still clear WCAG AA.
4. Run `bun run tokens:build` to regenerate `src/styles/tokens.css`.

---

_Last reviewed: 2026-05-15 by tech-writer agent against Sprint 2 (Stories 2.1, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13; ADR-004)._
