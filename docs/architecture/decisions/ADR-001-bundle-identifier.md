# ADR-001: Bundle Identifier for ZoePlane Tauri App

**Status:** Accepted (2026-05-09)
**Date:** 2026-05-09
**Decision drivers:** Story 1.7 (FB-013, FB-015, FB-016) blocked pending identifier confirmation; no signed release has shipped yet, so the identifier is not yet locked by external systems (Apple notarization profile, App Store Connect, Homebrew tap, winget-pkgs).

## Context

The Tauri app currently declares `identifier = "com.brinscorp.zoeplane"` in `src-tauri/tauri.conf.json`. This identifier propagates to the macOS bundle ID, the Windows AppUserModelID, the Linux desktop file basename, the OS-level deep-link registration for `zoeplane://`, and the per-platform `appDataDir()` path. Story 1.7's author wrote scope assertions assuming the identifier was the bare string `zoeplane`; the FS allowlist and sidecar README, however, already use `com.brinscorp.zoeplane` (5 known references).

Bundle identifiers are effectively immutable post-release: changing them after users install means orphaned data directories, broken auto-update signatures, and a re-issued Apple notarization binding. Sprint 1 has not yet shipped a signed release (`version "0.0.0"` placeholders in Homebrew Cask and winget manifests confirm this), so the window to settle this without migration cost is open and closes at the first tagged signed build.

ZoePlane is Apache 2.0 OSS stewarded by BrinsCorp-Tech. The Apple Developer certificate, GPG key, and Authenticode certificate Story 1.5 wired all sit under the BrinsCorp-Tech corporate identity; the project is OSS but the signing trust root is corporate. PRD §1.7 also flags Zoe-Mem (proprietary plugin) shipping under the same vendor — a sibling product, not a fork.

## Decision

**Retain `com.brinscorp.zoeplane` as the permanent bundle identifier.**

Rationale: (1) the identifier already matches the signing trust root — the Apple Developer Team that owns the notarization profile is BrinsCorp-Tech, so a vendor-prefixed bundle ID is the honest reverse-DNS encoding of "who signed this binary"; (2) the existing 5 in-tree references are consistent and correct; (3) vendor-neutral alternatives like `dev.zoeplane` would misrepresent the signing chain (the cert is not held by a `zoeplane.dev` entity that does not exist); (4) Apache 2.0 OSS license does not require vendor-neutral identifiers — `dev.fedora.workstation`, `org.mozilla.firefox`, `com.google.Chrome.canary` all encode their corporate steward in the bundle ID without compromising openness; (5) future stewardship transfer to a foundation would be a deliberate fork-and-renamespace event, not a cost we should pre-pay today.

## Consequences

**Positive:**
- Zero-cost decision: no files change, no rework, Story 1.7 unblocks immediately on a single-line clarification (the technical-notes scope was wrong, not the identifier).
- Honest correspondence between bundle ID and the entity that signs and notarizes the binary — auditors and security reviewers see consistent provenance.
- Matches GitHub org casing pattern users already see (`BrinsCorp-Tech` → `com.brinscorp.zoeplane`); no surprise.
- Homebrew Cask `zap trash` already targets `com.brinscorp.zoeplane.plist` correctly.

**Negative:**
- If BrinsCorp-Tech ever transfers stewardship (foundation handoff, acquisition unwind), the bundle ID becomes a vestigial trace of prior ownership. Mitigation: this is a known cost of every vendor-prefixed OSS bundle ID and is conventionally accepted (see `org.eclipse.*`, `com.oracle.*` for OSS examples).
- Requires Story 1.7 author to correct technical-notes scope from `$APPDATA/zoeplane/**` to `$APPDATA/com.brinscorp.zoeplane/**` — already the value in `tauri.conf.json`.

**Neutral:**
- The FS allowlist scope `$APPDATA/com.brinscorp.zoeplane/**` is verbose but Tauri's `$APPDATA` macro expands to the OS-correct path; users do not type the bundle ID.
- Deep-link OS registration uses the bundle ID as the registration key but the user-visible scheme remains `zoeplane://` — bundle ID is not user-facing.

## Alternatives Considered

See Part 2 trade-off table in the architect's review note (2026-05-09). Briefly: `tech.brinscorp.zoeplane` was rejected because `.tech` is not a registered TLD reverse-DNS root and creates ambiguity with the `BrinsCorp-Tech` org name; `dev.zoeplane` was rejected because no entity owns `zoeplane.dev` and it misrepresents the signing chain; `app.zoeplane` has the same flaw plus is conventionally used for hosted SaaS apps, not desktop binaries.

## Implementation Impact

**None — current state is correct.**

Action required is documentation-only: Story 1.7's technical-notes section must be corrected to reference `$APPDATA/com.brinscorp.zoeplane/**` (already the value in `tauri.conf.json` line 76) when specifying FS allowlist scope. No code, config, manifest, or workflow changes are needed.

For future readers of this ADR: any change to the bundle identifier after the first signed release would require a migration plan covering (a) Apple notarization re-binding, (b) Homebrew Cask `zap trash` paths and tap-repo update, (c) winget Publisher renamespace, (d) `appDataDir()` migration script for existing users, (e) deep-link OS re-registration handler, (f) FS allowlist updates in `tauri.conf.json` and any plugin SDK references. Treat this ADR as the canonical reason such a change would be deliberately costly, not accidental.
