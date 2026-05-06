# ZoePlane Integration & E2E Tests (`tests/`)

Cross-cutting integration tests and E2E tests live here. Unit tests co-locate
with the code they test (in `src/` or `sidecar/src/`) and run via Vitest.

## What belongs here

- **Integration tests:** tests that require multiple packages working together
  (e.g., sidecar + UI via mocked Tauri IPC, or token pipeline end-to-end)
- **E2E tests:** full Tauri application tests via WebdriverIO or Playwright Tauri
- **Contract tests:** verify that the Plugin SDK types match what the host runtime
  actually provides (prevents SDK drift)

## What belongs in co-located `*.test.ts` files

- Unit tests for individual functions / components
- Pure TypeScript logic tests (parsers, validators, store slices)
- React component tests via Vitest + React Testing Library

## Planned test suites (by epic)

| Suite | Epic | Description |
|-------|------|-------------|
| `token-completeness/` | Epic 02 Sprint 1 | Verify every light token exists in dark |
| `standalone-mode/` | Epic 02 + 04 | Verify plugin-free surface is 100% functional |
| `plugin-theme-inheritance/` | Epic 04 | Verify plugin iframes receive token updates on THEME_CHANGE |
| `evaluator-contract/` | Epic 05 | Verify evaluator output schema |
| `ipc-contract/` | Epic 01 | Verify Tauri IPC commands match TypeScript types |
| `e2e/` | Epic 12 | Full Tauri application smoke tests |

## Test runner

Vitest (same runner as unit tests, with workspace config in the root).
E2E tests use Playwright + Tauri WebDriver (configured separately in `e2e/playwright.config.ts`
when added in Epic 12).
