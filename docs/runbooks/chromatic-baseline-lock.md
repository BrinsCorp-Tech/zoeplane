# Runbook: Chromatic Baseline Lock

**Story:** 2.13 — WCAG 2.2 AA contrast verification harness (AC #4, #5)
**Status:** DEFERRED — requires operator to provision `CHROMATIC_PROJECT_TOKEN`
**Workflow file:** `.github/workflows/chromatic.yml`

---

## Overview

This runbook covers the three steps required to lock the Chromatic visual regression baseline
at Sprint 2 close and switch the GHA workflow from advisory to required-check mode.

The Chromatic GHA workflow (`chromatic.yml`) is currently in **advisory mode**:

- `exitZeroOnChanges: true` — workflow always exits zero even if visual diffs are detected
- The `if:` guard at lines 19–44 skips cleanly when `CHROMATIC_PROJECT_TOKEN` is absent
- No CI breakage occurs while the secret is unprovisioned

---

## Step 1 — Operator provisions `CHROMATIC_PROJECT_TOKEN`

1. Log in to https://www.chromatic.com and create or locate the ZoePlane project
2. Copy the project token from **Manage → Configure → Project Token**
3. In GitHub: `BrinsCorp-Tech/zoeplane` → **Settings → Secrets and variables → Actions**
4. Add a new repository secret:
   - Name: `CHROMATIC_PROJECT_TOKEN`
   - Value: the token from step 2

The workflow `if:` guard at `chromatic.yml:19` checks `secrets.CHROMATIC_PROJECT_TOKEN != ''` —
once provisioned, Chromatic runs will execute on every push to `develop` and on PRs.

---

## Step 2 — Trigger the baseline capture workflow

After provisioning the token, trigger the workflow on `develop` to capture the initial baseline:

```bash
# Requires gh CLI with GH_TOKEN set to a token with workflow dispatch permissions
GH_TOKEN=$(node ~/.claude/scripts/gh-app-token.mjs) gh workflow run chromatic.yml --ref develop
```

This runs Storybook + Chromatic against the full Sprint 2 component matrix:

- 15 foundation components × all variants × 2 themes × 2 motion modes
- 9 layout primitives × 2 themes
- LibraryShell × 6 mock consumer modes × 2 themes
- EvaluatorStatusBadge × 16-cell baseline matrix

Wait for the workflow to complete. Monitor at:
`https://github.com/BrinsCorp-Tech/zoeplane/actions`

---

## Step 3 — Accept baseline in Chromatic UI and open follow-up PR

1. Open the Chromatic build URL from the workflow run output
2. Review each snapshot in the Chromatic UI
3. Click **Accept** on all snapshots to set them as the regression baseline
4. Open a follow-up PR that flips line 44 of `chromatic.yml`:

```yaml
# BEFORE (advisory mode — Story 2.13 shipped state):
exitZeroOnChanges: true

# AFTER (required-check mode — flip this PR):
exitZeroOnChanges: false
```

5. Once merged, any future PR that introduces visual diffs will **block merge** until the
   diffs are reviewed and accepted in Chromatic.
6. Register the Chromatic check as a required status check in GitHub branch protection
   (`develop` and `main`): **Settings → Branches → Branch protection rules → Required status checks**

---

## Acceptance Matrix for Baseline Lock

The baseline must cover the following component surface before the flip is valid:

| Category              | Items                                                                                                                                              | Status           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Foundation components | 15 (Button, Card, Badge, Input, Icon, Modal, Toast, Tooltip, Dropdown, Select, Checkbox, Radio, Tabs, FormField, Skeleton, Spinner) — all variants | Sprint 2 shipped |
| Layout primitives     | 9 (Sidebar, TitleBar, StatusBar, TabStrip, CollapsiblePane, CommandPalette, NotificationsCenter, Inspector, PrimaryWorkArea)                       | Sprint 2 shipped |
| LibraryShell          | 6 mock consumer modes                                                                                                                              | Sprint 2 shipped |
| EvaluatorStatusBadge  | 16-cell state matrix                                                                                                                               | Sprint 2 shipped |
| Themes                | light + dark                                                                                                                                       | Sprint 2 shipped |
| Motion modes          | default + prefers-reduced-motion                                                                                                                   | Sprint 2 shipped |

All items above are represented in Storybook stories as of Sprint 2 close.

---

## Notes

- The Chromatic workflow uses `bun run build-storybook` before uploading — ensure the
  Storybook build succeeds locally before triggering the workflow
- The `CHROMATIC_PROJECT_TOKEN` is short-lived for build purposes only; it is safe to
  store as a repo secret (it does not grant deploy or write access)
- If the baseline capture fails (build error, token issue), the advisory mode means
  CI is unaffected — fix the issue and re-trigger
