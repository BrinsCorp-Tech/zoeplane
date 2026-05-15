# Build and Release — ZoePlane

## Build Pipeline Overview

ZoePlane uses five GitHub Actions workflows (Sprint 2 introduced the reusable build-matrix workflow; Sprint 3 removed the Chromatic visual regression workflow — see ADR-006):

| Workflow     | File                                  | Trigger                              | Purpose                                                                                       |
| ------------ | ------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| Build Matrix | `.github/workflows/_build-matrix.yml` | `workflow_call` (reusable)           | Lint + typecheck + test + build across all 3 platforms. Called by CI and Nightly.             |
| CI           | `.github/workflows/ci.yml`            | PR into `main` or `develop`          | Calls `_build-matrix.yml` + `design-tokens-check`                                             |
| Nightly      | `.github/workflows/nightly.yml`       | Daily at 07:00 UTC + manual dispatch | Calls `_build-matrix.yml` against `main`                                                      |
| Release      | `.github/workflows/release.yml`       | Push of a `v*.*.*` semver tag        | Signed, distributable artifacts for macOS + Windows + Linux; publishes a GitHub Release draft |
| Publish SDK  | `.github/workflows/publish-sdk.yml`   | Same `v*.*.*` tag as Release         | Builds and publishes `@zoeplane/plugin-sdk` to npm                                            |

### Reusable build matrix (`_build-matrix.yml`)

Sprint 2 (Story 2.2) extracted the duplicated build matrix from `ci.yml` and `nightly.yml` into `.github/workflows/_build-matrix.yml` — a `workflow_call` reusable workflow. This resolves Sprint 1 MED-3. The workflow accepts three inputs:

| Input                     | Type   | Default             | Description                                   |
| ------------------------- | ------ | ------------------- | --------------------------------------------- |
| `checkout-ref`            | string | `""` (trigger ref)  | Git ref to check out                          |
| `artifact-retention-days` | number | `7`                 | Days to retain uploaded Tauri build artifacts |
| `artifact-name-prefix`    | string | `"tauri-artifacts"` | Prefix for uploaded artifact names            |

### What runs on PR (ci.yml)

`ci.yml` calls `_build-matrix.yml` and adds the `design-tokens-check` job. Jobs run with `fail-fast: false` across a 3-platform matrix (`macos-latest`, `windows-latest`, `ubuntu-22.04`):

1. **lint** — `bun run lint` (ESLint flat config, `eslint.config.js`)
2. **typecheck** — `bun run typecheck` (`tsc --noEmit` across all workspaces)
3. **test** — `bun run test` (Vitest unit tests; includes component a11y tests, contrast harness, guard tests)
4. **design-tokens-check** — Rebuilds `src/styles/tokens.css` via `bun run tokens:build` and asserts non-empty output. Validates that `packages/design-tokens/src/tokens.seed.json` is parseable and the Style Dictionary pipeline is healthy.
5. **scaffold-health** — Ubuntu-only; verifies Tauri icons present, sidecar entry exists, migrations directory non-empty.
6. **actionlint** — Validates GitHub Actions workflow YAML via `reviewdog/action-actionlint`.
7. **build** — Unsigned Tauri platform builds (depends on lint + typecheck + test + scaffold-health passing). Bundles: `app` (macOS), `msi,nsis` (Windows), `deb,rpm` (Linux). `dmg` and `AppImage` excluded from PR matrix (flaky on GHA runners); produced by `release.yml`.

A `summary` job writes a results table to the GHA step summary regardless of outcome.

### Visual coverage posture (ADR-006)

Chromatic was removed in Sprint 3 (Story H.1). See `docs/architecture/decisions/ADR-006-visual-coverage-posture.md` for the full decision record.

**Current posture:** Manual visual smoke at component-batch boundaries is the primary visual-regression gate. The `@storybook/addon-a11y` Storybook panel (axe-core in-browser) and the `src/test/helpers/runAxe.ts` unit-test helper are the automated a11y surface. This posture is revisited when active maintainer count crosses 3.

### What gates merge

Branch protection on `main` and `develop` should require all matrix legs as required status checks (12 checks total: 3 platforms × 4 jobs). This is a manual repo-settings action — not enforced by the workflow YAML itself. TBD: required-checks registration is pending operator action.

### Developer prerequisite: Tauri CLI

Before running `bun run tauri:build` or `cargo tauri build` locally, the Tauri CLI must be installed via Cargo:

```bash
cargo install tauri-cli --version "^2" --locked
```

The `--locked` flag is required to ensure a reproducible toolchain install (matches `Cargo.lock` exactly). This is the same command documented in `CONTRIBUTING.md` and `docs/INSTALL.md`. The CLI is not included in `Cargo.toml` as a build dependency — it is a developer workstation prerequisite.

### Build steps (all pipelines)

Every build follows this sequence:

```bash
# 1. Frontend dependencies
bun install --frozen-lockfile

# 2. Build design tokens (required before UI build — tokens.css is gitignored)
bun run tokens:build
# Runs: packages/design-tokens/style-dictionary.config.mjs → src/styles/tokens.css
# On CI: the design-tokens-check job validates this step independently

# 3. Build React UI (Vite)
bun run --cwd src build          # outputs to src/dist/

# 4. Build sidecar single-binary (Bun compile)
bun run --cwd sidecar build      # outputs to sidecar/dist/zoeplane-sidecar
# postbuild: scripts/copy-sidecar.ts copies the binary to src-tauri/binaries/
#            with the platform-triple suffix required by Tauri's externalBin

# 5. Tauri build
cargo tauri build [--bundles <targets>]
```

Note: Step 2 (`tokens:build`) is required on every clean checkout because `src/styles/tokens.css` is gitignored. On developer workstations, `bun run dev` also regenerates tokens as part of the Vite startup. On CI, the `design-tokens-check` job runs this step independently as a health gate (step 2a above) before the frontend build consumes the output.

Rust compilation uses Tauri's `opt-level = "z"` / `lto = true` / `strip = true` release profile for production bundles (`src-tauri/Cargo.toml:[profile.release]`).

## Release Artifacts

### macOS

Trigger: `v*.*.*` tag push, job `release-macos` on `macos-latest`.

Build target: `--target universal-apple-darwin` (fat binary — Apple Silicon + Intel).

| Artifact                           | Format                   | Notes                          |
| ---------------------------------- | ------------------------ | ------------------------------ |
| `ZoePlane.app` (inside `.dmg`)     | macOS application bundle | Codesigned + notarized         |
| `ZoePlane_<version>_universal.dmg` | Disk image               | Drag-to-Applications installer |

Upload to GitHub Releases draft via `tauri-apps/tauri-action@v0`.

### Windows

Trigger: `v*.*.*` tag push, job `release-windows` on `windows-latest`.

| Artifact                           | Format         | Notes               |
| ---------------------------------- | -------------- | ------------------- |
| `ZoePlane_<version>_x64-setup.exe` | NSIS installer | Authenticode-signed |
| `ZoePlane_<version>_x64_en-US.msi` | MSI installer  | Authenticode-signed |

### Linux

Trigger: `v*.*.*` tag push, job `release-linux` on `ubuntu-22.04`.

| Artifact                             | Format          | Notes                       |
| ------------------------------------ | --------------- | --------------------------- |
| `ZoePlane_<version>_amd64.deb`       | Debian package  | GPG-signed                  |
| `ZoePlane_<version>_x86_64.rpm`      | RPM package     | GPG-signed                  |
| `ZoePlane_<version>_x86_64.AppImage` | Portable binary | GPG-signed via AppImageTool |

## Signing Chain

### macOS — Apple Developer ID + Notarization

1. The `.p12` certificate (base64-encoded `APPLE_CERTIFICATE`) is imported into a temporary keychain using `apple-actions/import-codesign-certs@v3`.
2. `tauri-apps/tauri-action` invokes `codesign` with the `APPLE_SIGNING_IDENTITY` ("Developer ID Application: ...") to sign the `.app` bundle.
3. `xcrun notarytool` (invoked by `tauri-action`) submits the signed bundle to Apple's notarization service using `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` and polls until the ticket is stapled.
4. If notarization times out or fails, `tauri-action` exits non-zero — the release job fails. The artifact is still uploaded for diagnostic re-submission.

Source: `.github/workflows/release.yml:79-132`.

### Windows — Authenticode

1. The `.pfx` certificate (base64-encoded `WINDOWS_CERTIFICATE`) is imported into the Windows certificate store via `Import-PfxCertificate`.
2. `tauri-apps/tauri-action` signs the NSIS installer and MSI using `signtool.exe` with the imported certificate thumbprint.

Source: `.github/workflows/release.yml:186-222`.

### Linux — GPG

1. The armored GPG private key (`LINUX_GPG_PRIVATE_KEY`) is imported via `gpg --batch --import`.
2. The key ID is extracted and passed to AppImageTool via `SIGN=1`, `SIGN_KEY=<key-id>`, `APPIMAGETOOL_SIGN_PASSPHRASE`, and `APPIMAGETOOL_FORCE_SIGN=1`. `APPIMAGETOOL_FORCE_SIGN=1` causes the build to fail if signing fails (AppImageTool's default is to silently skip signing on error).

Source: `.github/workflows/release.yml:293-330`.

### Required GHA Secrets

Before the first signed release, a repository operator must provision all 10 of the following GitHub Actions secrets:

| Secret                         | Platform | Description                                                                                |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------ |
| `APPLE_CERTIFICATE`            | macOS    | Base64-encoded `.p12` Developer ID certificate                                             |
| `APPLE_CERTIFICATE_PASSWORD`   | macOS    | Password for the `.p12`                                                                    |
| `APPLE_SIGNING_IDENTITY`       | macOS    | Developer ID Application string (e.g. `Developer ID Application: BrinsCorp-Tech (TEAMID)`) |
| `APPLE_ID`                     | macOS    | Apple ID email for notarization                                                            |
| `APPLE_PASSWORD`               | macOS    | App-specific password for the Apple ID                                                     |
| `APPLE_TEAM_ID`                | macOS    | Apple Developer Team ID                                                                    |
| `WINDOWS_CERTIFICATE`          | Windows  | Base64-encoded `.pfx` Authenticode certificate                                             |
| `WINDOWS_CERTIFICATE_PASSWORD` | Windows  | Password for the `.pfx`                                                                    |
| `LINUX_GPG_PRIVATE_KEY`        | Linux    | Armored GPG private key                                                                    |
| `LINUX_GPG_PASSPHRASE`         | Linux    | Passphrase for the GPG key                                                                 |

TBD: all 10 secrets are pending operator provisioning as of Sprint 1. Each release workflow validates its required secrets at the start and fails loudly (before spending build time) if any are absent.

An 11th secret, `NPM_TOKEN`, is required for the Plugin SDK publish workflow (`publish-sdk.yml`). See Plugin SDK Distribution below.

## Plugin SDK Distribution

`publish-sdk.yml` fires on the same `v*.*.*` tag pattern as `release.yml`. It builds `@zoeplane/plugin-sdk` via `tsup` and publishes to npm under the `@zoeplane` scope.

**Operator prerequisites before first SDK publish:**

1. Register the `@zoeplane` npm scope — log in to npmjs.com as the BrinsCorp-Tech org account and create the `@zoeplane` organization scope.
2. Create an automation token with read+write publish permission scoped to `@zoeplane` packages.
3. Add the token as the `NPM_TOKEN` GHA secret.

TBD: `@zoeplane` scope registration and `NPM_TOKEN` secret are pending operator action as of Sprint 1.

## Release Cadence

ZoePlane uses semantic versioning (SemVer). Sprint 1 established version `0.1.0` in `package.json` and `src-tauri/Cargo.toml` but no signed release has been tagged yet; the Homebrew Cask and winget manifests both carry the `0.0.0` placeholder.

**Triggering a release:**

```bash
git tag v1.0.0
git push origin v1.0.0
```

This simultaneously triggers `release.yml` and `publish-sdk.yml`.

## Verifying a Release

### macOS

```bash
# Codesign
spctl --assess --type exec -vvv /Applications/ZoePlane.app

# Notarization
stapler validate /Applications/ZoePlane.app
```

### Windows

```powershell
Get-AuthenticodeSignature "ZoePlane_<version>_x64-setup.exe"
```

### Linux

```bash
gpg --verify ZoePlane_<version>_amd64.deb.sig ZoePlane_<version>_amd64.deb
```

TBD: GPG public key fingerprint and keyserver URI for the BrinsCorp-Tech release key — pending first signed release.

### SHA-256 checksums

TBD: release workflow does not currently generate a `SHA256SUMS` file. Adding a checksum generation step to `release.yml` is a candidate improvement for Sprint 2.

## Homebrew and Winget (Manual Operator Steps)

Homebrew and winget distribution require manual operator action per release. Automated cross-repo publishing is not wired.

**Homebrew** (`packaging/homebrew/zoeplane.rb`): Update `version`, `url`, and `sha256` fields, then copy the file to the `brinscorp-tech/homebrew-zoeplane` tap repo at `Casks/zoeplane.rb`. The tap repo does not yet exist (pending operator action).

**Winget** (`packaging/winget/BrinsCorpTech.ZoePlane/`): Update the three manifest files with the new version and installer URL, then submit via PR to `microsoft/winget-pkgs`. Winget submission is post-Sprint-1.

## Known Deferred Items

- **SHA-256 checksum file**: Not generated by `release.yml`; candidate Sprint 3 improvement.
- **Branch protection required-checks registration**: 12 required status checks must be registered in GitHub repository settings for `main` and `develop`. Manual repo-settings action, not a workflow change.

---

_Last reviewed: 2026-05-15 by sprint-programmer against Sprint 3 (Story H.1; Chromatic removal, ADR-006 visual coverage posture)._
