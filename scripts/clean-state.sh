#!/usr/bin/env bash
# scripts/clean-state.sh — ZoePlane clean-state wipe for macOS
#
# Removes all platform-local state associated with bundle identifier
# com.brinscorp.zoeplane so a subsequent `bun run tauri` tests a truly
# fresh-install bootstrap path.
#
# Usage:
#   bash scripts/clean-state.sh           # remove state
#   bash scripts/clean-state.sh --dry-run # preview without removing
#
# Story 1.11 §E — Sprint 1 amendment
# Platform: macOS (operator daily dev platform).
# Linux/Windows equivalents: Sprint 2 carryover — see SPRINT-2-CARRYOVERS.md.

set -euo pipefail

# ---------------------------------------------------------------------------
# Platform guard
# ---------------------------------------------------------------------------
PLATFORM="$(uname -s)"
if [[ "${PLATFORM}" != "Darwin" ]]; then
  echo "clean-state: Linux/Windows clean-state not yet implemented (Sprint 2 carryover)."
  echo "  Detected platform: ${PLATFORM}"
  echo "  On Linux: remove ~/.local/share/com.brinscorp.zoeplane and"
  echo "            ~/.config/com.brinscorp.zoeplane (XDG paths — verify with 'tauri info')."
  exit 0
fi

# ---------------------------------------------------------------------------
# Dry-run flag
# ---------------------------------------------------------------------------
DRY_RUN=false
for arg in "$@"; do
  if [[ "${arg}" == "--dry-run" ]]; then
    DRY_RUN=true
  fi
done

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "clean-state: --dry-run mode — no files will be removed."
fi

# ---------------------------------------------------------------------------
# Targets
# ---------------------------------------------------------------------------
BUNDLE_ID="com.brinscorp.zoeplane"

TARGETS=(
  "${HOME}/Library/Application Support/${BUNDLE_ID}"
  "${HOME}/Library/Preferences/${BUNDLE_ID}.plist"
  "${HOME}/Library/Caches/${BUNDLE_ID}"
  "${HOME}/Library/Saved Application State/${BUNDLE_ID}.savedState"
)

# ---------------------------------------------------------------------------
# Wipe
# ---------------------------------------------------------------------------
echo "clean-state: wiping ZoePlane platform state (bundle: ${BUNDLE_ID})"
echo ""

for target in "${TARGETS[@]}"; do
  if [[ -e "${target}" ]]; then
    if [[ "${DRY_RUN}" == "true" ]]; then
      echo "  [dry-run] would remove: ${target}"
    else
      rm -rf "${target}"
      echo "  removed: ${target}"
    fi
  else
    echo "  not present: ${target}"
  fi
done

echo ""
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "clean-state: dry-run complete — no files removed."
else
  echo "clean-state: done. Run 'bun run tauri' to test a clean-install bootstrap."
fi
