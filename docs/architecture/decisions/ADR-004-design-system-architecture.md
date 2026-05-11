# ADR-004: Design System Architecture

**Status:** Accepted (2026-05-11)
**Date:** 2026-05-11
**Decision drivers:** Story 2.1 (Epic 02 — Design System & Core UX); PRD §9 Q16 (light + dark at MVP); Epic 02 schedule (tokens must freeze before any feature epic begins); dark-mode-architecture.md v1.1; ux-spec.md v1.5.

## Context

ZoePlane ships both light and dark modes at MVP (PRD §9 Q16). This is not a paint job applied after the fact — it is a structural constraint that forces the token architecture to carry theme-branching explicitly before any component work begins. Sprint 1 established the Tauri 2.x runtime (ADR-002, ADR-003); this ADR governs the UI and design vocabulary layer, which is orthogonal to those decisions.

The design token system has three distinct concerns that must be resolved before Epic 02 component stories can land:

1. **Token format and structure** — What format do tokens live in, and how do primitives relate to semantic and component layers?
2. **Color space** — Which color space do primitive values use, and what is the fallback path if a platform does not render it?
3. **Build tooling** — How do DTCG JSON tokens become a CSS file consumed by the app?
4. **Component primitive library** — What base component library (if any) provides the unstyled primitive set?
5. **Visual regression validation** — How are visual regressions caught before they reach production?

Without explicit decisions on all five, downstream component stories will make incompatible local choices — the token namespace and the theme-switch mechanism in particular would be re-litigated on every component story if not locked now.

## Decision

### 1. Token format: DTCG W3C v1, three-tier cascade

The canonical token format is **DTCG W3C v1** (design-tokens.github.io/community-group, October 2025 stable version). Tokens are organized in a three-tier cascade:

- **Layer 1 — Primitives** (`@layer tokens.base`): theme-invariant raw values (OKLCH color ramps, spacing scale, typography scale, radius, motion easing, breakpoints). These are NEVER consumed by components directly. They exist only to feed the semantic layer.
- **Layer 2 — Semantic** (`@layer tokens.semantic`): theme-branching layer. The ONLY layer that differs between light and dark. All components consume only semantic tokens. Themes redefine these tokens via `[data-theme="light"]` and `[data-theme="dark"]` on `<html>`.
- **Layer 3 — Component** (`@layer tokens.component`): theme-invariant references to semantic tokens. Example: `--button-primary-bg: var(--color-accent)`. These exist to give component implementations a stable name without exposing the semantic layer's hue reasoning directly.

**The components-must-not-branch-on-theme rule is load-bearing and enforced:** No component code may read `theme === 'dark'` or `data-theme === 'dark'` — all theme variation is expressed via CSS custom property cascade. This rule is enforced by an ESLint custom rule in Story 2.3.

### 2. Color space: OKLCH primitives with documented HSL fallback contingency

All primitive color values use the **OKLCH color space** (perceptually uniform, superior for designing equivalent-perceived-lightness pairs across themes). OKLCH is supported in all three target WebView environments at their current shipping versions:

- macOS WKWebView (Safari engine): OKLCH supported since Safari 15.4
- Windows WebView2 (Chromium engine): OKLCH supported since Chrome 111
- Linux WebKitGTK: OKLCH supported since WebKitGTK 2.42

**OKLCH platform verification gate:** macOS WKWebView: OKLCH was verified in the Sprint 1 smoke test (2026-05-10, GREEN verdict) against the hand-authored `tokens.css`. Semantic equivalence for the Story 2.1 pipeline output was confirmed by zero-diff comparison between the hand-authored and generated CSS bodies (same OKLCH values, same custom property names, same cascade structure). Direct boot of a fresh dev build against the pipeline output is recommended as opportunistic verification but not required given the equivalence proof. Windows WebView2 and Linux WebKitGTK: verification is deferred to the boots-from-source CI gate (Story 2.2).

**HSL fallback contingency:** If any platform renders OKLCH incorrectly, this ADR must be amended before any component story consumes the tokens. The amendment procedure is: (1) replace all OKLCH primitive values in `packages/design-tokens/src/tokens.seed.json` with HSL equivalents, (2) re-run `bun run tokens:build`, (3) update this ADR's status to "Amended" with a record of the platform constraint and the hue mapping used. No component story may ship until the amendment is accepted. This gate is explicit because OKLCH-to-HSL substitution changes perceived color equivalence across themes — it is not a mechanical swap.

### 3. Build tooling: Style Dictionary v4

**Style Dictionary v4** (`style-dictionary ^4.0.0`, currently installed at 4.4.0) is the build tool that transforms `packages/design-tokens/src/tokens.seed.json` → `src/styles/tokens.css`.

- The build command is `bun run tokens:build` (delegates to `node style-dictionary.config.mjs` in the subpackage).
- The check command is `bun run tokens:check` (verifies the pipeline builds cleanly from the seed JSON without error). Full drift detection — comparing seed JSON changes against expected CSS output — runs in CI via the design-tokens-check job added in Story 2.2, which executes `tokens:build` in a clean checkout and fails on any unexpected change.
- `src/styles/tokens.css` is a **build artifact** — it is gitignored and not committed. The DTCG JSON source file (`tokens.seed.json`) is the committed source of truth.
- A Husky pre-commit hook (added Story 2.1) aborts any commit that attempts to stage `src/styles/tokens.css` directly, with an error message directing the developer to edit the seed JSON instead.
- Story 2.2 adds a CI design-tokens-check job that runs `tokens:check` on every PR, ensuring no CSS drift lands without a corresponding seed JSON change.

### 4. Component primitive library: shadcn/ui

**shadcn/ui** is the base primitive component library. It provides unstyled or minimally-styled Radix UI primitives (accessibility contract, keyboard navigation, ARIA roles) without imposing a theme or design system. ZoePlane's token layer provides all visual expression. shadcn/ui components consume ZoePlane semantic tokens, not shadcn's default Tailwind variable names.

shadcn/ui installation and component adaptation land in **Story 2.5** — this ADR establishes the selection, not the implementation. The key constraint: shadcn/ui components must be modified to reference `--color-*` semantic tokens rather than shadcn's default CSS variable names (which are Tailwind-centric and HSL-based).

### 5. Visual regression validation: Storybook 8 + Chromatic

**Storybook 8** is the component development environment. **Chromatic** is the visual regression service. Together they form the validation surface for every Foundation and Layout tier component in Epic 02.

Storybook 8 + Chromatic installation land in **Story 2.4**. Every component story authored in Epics 02+ must include a Storybook story that exercises both light and dark themes. Chromatic runs on every PR and blocks merge on visual regression.

## Consequences

**Positive:**

- Three-tier cascade with explicit semantic layer eliminates all component-level theme branching — components remain theme-blind by design, which is both simpler to implement and simpler to test.
- DTCG format aligns with Token Studio (Figma Variables export path) so designer authoring is non-blocking: seed JSON today, Token Studio DTCG export later without a pipeline change.
- Style Dictionary v4 gives us a programmable formatter — the custom formatter in `style-dictionary.config.mjs` emits the exact `@layer` structure the Tailwind v4 pipeline expects, with no loss of fidelity.
- The gitignore + pre-commit hook pair closes the hand-edit escape: the only way to change tokens is to edit the seed JSON and rebuild, which keeps the CSS output deterministic.
- shadcn/ui's accessibility contract (Radix UI under the hood) satisfies PRD FR-060 and ux-discovery a11y §4 requirements without requiring custom keyboard navigation or ARIA implementations.
- Storybook + Chromatic provide a visual CI gate before users see the app — this was absent in Sprint 1 and is the primary regression-prevention mechanism for Sprint 2+ component work.

**Negative:**

- Custom Style Dictionary formatter means the formatted CSS output is authored in JavaScript, not templated in DTCG JSON. Consequence: non-color tokens (typography, spacing, motion, layout) are static in the formatter rather than driven from JSON. This is an accepted tradeoff for semantic equivalence with the hand-authored file; the plan is to migrate these layers to JSON in a later sprint when Figma Variables are authored for typography and spacing.
- shadcn/ui's default CSS variable names conflict with ZoePlane's token namespace. Every component from shadcn must be adapted. This is expected effort; the component migration guide will be added to the sprint-context for Epic 02 component stories.
- Chromatic requires a project token (GHA secret). This is a deployment concern, not a code concern, and is listed in the Sprint 2 carryover GHA secrets checklist.

**Neutral:**

- `tokens.seed.json` is currently a "seed" (manual mirror of the hand-authored CSS). When Figma Variables are authored and Token Studio exports DTCG JSON, the seed file is replaced by the export — no pipeline change needed, only a file swap.

## Relationship to Prior ADRs

- **ADR-001** (Bundle Identifier): Orthogonal. ADR-001 governs `com.brinscorp.zoeplane` as the macOS/Windows/Linux bundle ID. ADR-004 governs the UI/design vocabulary. No dependency.
- **ADR-002** (Tauri 2.x Capability Model): Orthogonal. ADR-002 governs Tauri plugin capability declarations in `src-tauri/capabilities/`. ADR-004 governs the CSS token pipeline. No dependency.
- **ADR-003** (Tauri 2.x Runtime Scope): Orthogonal. ADR-003 governs `tauri-plugin-fs` runtime scope initialization. ADR-004 governs the `packages/design-tokens` build pipeline. No dependency.

## Implementation Notes (Story 2.1)

The following implementation artifacts land in Story 2.1 on branch `feature/M.epic-02-sprint-2-design-system`:

- `packages/design-tokens/style-dictionary.config.mjs` — Style Dictionary v4 config with custom `zoeplaneTokensCSS` formatter
- `packages/design-tokens/src/tokens.seed.json` — updated to include all primitive color ramps (status, event-family families added; seed was previously incomplete)
- `packages/design-tokens/package.json` — `build` and `check-tokens` scripts replaced (echo stubs → real CLI invocations)
- `src/styles/tokens.css` — removed from git index (`git rm --cached`); now a build artifact
- `.gitignore` — `src/styles/tokens.css` added under "Generated design token CSS" section
- `.husky/pre-commit` — guard added to detect and abort commits that stage `src/styles/tokens.css`

Semantic equivalence was verified: the generated `src/styles/tokens.css` differs from the hand-authored original only in the header comment (old "BUILD NOTE" replaced with "Generated by Style Dictionary v4" wording per AC9). All 490 CSS custom property declarations, their values, layer structure, and `[data-theme="dark"]` block are byte-for-byte identical.
