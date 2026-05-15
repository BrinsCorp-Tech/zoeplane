# ADR-006: Visual Coverage Posture — Manual Smoke at Batch Boundaries

**Status:** Accepted (2026-05-15)
**Date:** 2026-05-15
**Decision drivers:** Story H.1 (Sprint 3 hygiene carryover — Active Constraint 15); Sprint 2 empirical record in `feedback_visual_smoke_catches_scaffold_bugs.md`; cost-benefit analysis for a single-operator OSS Tauri desktop app; Chromatic advisory-mode token never provisioned through all of Sprint 2.

## Context

Sprint 2 (Story 2.4, ADR-004 §5) installed Storybook 8 and wired a Chromatic advisory-mode CI workflow (`.github/workflows/chromatic.yml`). The `CHROMATIC_PROJECT_TOKEN` GHA secret was never provisioned. Chromatic ran zero snapshots across Sprint 2 — it never became a load-bearing gate.

What did become load-bearing was manual visual smoke at component-batch boundaries. During Sprint 2 Story 2.6 Batch F (2026-05-13), a post-delivery manual smoke run caught four latent scaffold bugs that every automated gate had missed:

1. PostCSS plugin not discovered by Vite (wrong root config path).
2. `@config` directive absent — Tailwind JS config not auto-loaded in v4.
3. Unlayered CSS reset overriding `@layer utilities` rules — components rendered unstyled.
4. Modal content wrapper missing `display: flex` — modal was present in the DOM but invisible.

All four bugs passed `bun run lint`, `bun run typecheck`, `bun run test`, and code-reviewer inspection. The durable lesson, captured in `feedback_visual_smoke_catches_scaffold_bugs.md`, is:

> **Manual visual smoke is the ONLY gate that catches CSS pipeline / theme bridge / layout bugs from scaffold stories. Automated gates (lint/typecheck/Vitest/code-reviewer/code-auditor) all pass while components render silently broken.**

Given this empirical record, the question is: what does Chromatic add beyond manual smoke for this project at current scale?

- ZoePlane is a single-operator OSS desktop app with no external contributors as of Sprint 3.
- Storybook stories already exercise light/dark themes via the global theme decorator.
- Manual smoke runs after every component batch already catch the class of bugs Chromatic would catch (and the Sprint 2 record shows manual smoke catches bugs Chromatic cannot, because the build pipeline itself was broken).
- Chromatic adds SaaS cost and GHA secret management overhead.
- The `@storybook/addon-a11y` panel (axe-core in-browser) plus `src/test/helpers/runAxe.ts` unit tests cover the automated a11y surface that Chromatic's a11y integration would partially duplicate.

The cost-benefit does not favor Chromatic at this scale. The decision is to remove it and lock the posture explicitly.

## Decision

**Remove Chromatic. Lock the visual-coverage posture as follows:**

### 1. Primary visual-regression gate: manual smoke at component-batch boundaries

After every batch of component work (before the batch PR is opened or at the end of each story's Phase 2.5), the implementer runs `bun run storybook` and visually inspects each new or modified story in both light and dark themes. This is the canonical visual regression check. No automated tool replaces this step.

The batch-boundary smoke protocol is:

- Open `bun run storybook` (runs `tokens:build` first — required because `tokens.css` is gitignored).
- Navigate each new/modified story in the Storybook sidebar.
- Toggle the global theme decorator between Light and Dark.
- Toggle the global reduced-motion decorator for any story that exercises animation.
- Check for: unstyled elements, invisible content, layout breakage, color-mode leakage.

Failures at this step surface exactly the class of bugs that `feedback_visual_smoke_catches_scaffold_bugs.md` documents.

### 2. Automated a11y surface: `@storybook/addon-a11y` + `runAxe.ts`

The `@storybook/addon-a11y` Storybook panel (installed as of Sprint 3, Story H.1) runs axe-core against the rendered story and surfaces violations in the Accessibility tab. This is the primary interactive a11y review tool — it lets the implementer see axe violations in context, in a real browser, against real rendered output.

The `src/test/helpers/runAxe.ts` unit-test helper drives automated per-component axe-core assertions in CI (Vitest). These run on every PR via `bun run test`. Together, the Storybook panel and the unit tests form the automated a11y surface.

Note: the `color-contrast` axe rule is disabled in all unit tests (JSDOM cannot resolve OKLCH CSS custom properties). Contrast is validated separately by the culori-based contrast harness (`src/test/contrast-harness.a11y.test.ts`).

### 3. Chromatic is removed

`.github/workflows/chromatic.yml`, `@chromatic-com/storybook@3`, and `chromatic@11` are deleted. No `CHROMATIC_PROJECT_TOKEN` GHA secret is needed. The orphaned runbook (`docs/runbooks/chromatic-baseline-lock.md`) is deleted.

### 4. Posture revisited at N=3 active maintainers

This decision is explicitly scale-dependent. When the project reaches 3 active maintainers contributing component-level changes, the cost-benefit shifts: manual smoke from multiple contributors in parallel becomes coordination overhead, and automated snapshot diffing provides value. At that point, re-evaluate Chromatic or an equivalent visual regression service (e.g., Percy, Playwright visual comparison, or Storybook's built-in `@storybook/test-runner` with snapshot comparison).

The operator must amend this ADR at the N=3 crossing point.

## Consequences

**Positive:**

- Eliminates SaaS dependency (Chromatic) and GHA secret management overhead.
- No change to the load-bearing gate — manual smoke was already doing the work.
- `@storybook/addon-a11y` adds genuine value: in-browser axe feedback not previously available during development. The panel reveals violations interactively, before the unit test CI run.
- Sprint 3+ implementers have a clear, explicit protocol rather than an aspirational CI workflow that never had its token provisioned.

**Negative:**

- Manual smoke does not produce a diff artifact. There is no automated pixel-diff record of what changed between batches. This is an accepted tradeoff at single-operator scale.
- If a contributor changes a shared token or animation that affects many components, the manual smoke scope is proportionally larger. The sprint-programmer is responsible for widening the smoke scope when batch changes are broad.

**Neutral:**

- ADR-004 §5 ("Visual regression validation: Storybook 8 + Chromatic") is amended by this ADR. The five-invariant design-system architecture (token cascade, color space, build tooling, component scaffold, visual regression) remains intact; the visual regression mechanism changes.

## Relationship to Prior ADRs

- **ADR-004** (Design System Architecture, §5): Partially amended by this ADR. ADR-004's §5 decision ("Storybook 8 + Chromatic") is superseded by this ADR's posture. All other ADR-004 invariants (token cascade, OKLCH, Style Dictionary v4, shadcn/ui) are unaffected.
- **ADR-001, ADR-002, ADR-003**: Orthogonal. No dependency.

## Empirical Basis

This ADR cites `feedback_visual_smoke_catches_scaffold_bugs.md` (Sprint 2, 2026-05-13) as the primary empirical evidence. Key quote from that document:

> Manual visual smoke is the ONLY gate that catches CSS pipeline / theme bridge / layout bugs from scaffold stories; automated gates (lint/typecheck/Vitest/code-reviewer/code-auditor) all pass while components render silently broken.

This is not a theoretical claim — it is the post-mortem finding from four concrete bugs that shipped into a PR, passed all automated gates, and were caught only by opening Storybook and looking.
