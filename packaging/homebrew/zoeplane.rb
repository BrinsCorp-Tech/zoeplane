# ZoePlane Homebrew Cask
#
# This is a STATIC ARTIFACT committed to the ZoePlane repo.
# It is NOT auto-pushed to any tap repo.
#
# OPERATOR ACTION REQUIRED (at each release):
#   1. Create the tap repo: brinscorp-tech/homebrew-zoeplane (if not yet done)
#   2. Replace the SHA256 placeholder below with the actual SHA256 of the
#      macOS universal .tar.gz artifact from GitHub Releases:
#        shasum -a 256 ZoePlane_<version>_universal.tar.gz
#   3. Update the `version` and `url` fields to match the new tag.
#   4. Copy this file (or a modified copy) to the tap repo at:
#        Casks/zoeplane.rb
#   5. Commit and push to the tap repo so `brew install --cask brinscorp-tech/zoeplane/zoeplane` works.
#
# Artifact naming: Tauri 2 macOS universal builds produce a .app bundle
# inside a .tar.gz archive (naming convention from tauri-action):
#   ZoePlane_<version>_universal.tar.gz
# Verify the exact filename against the GitHub Releases page before updating.

cask "zoeplane" do
  version "0.0.0"

  # REPLACE_BEFORE_PUBLISH_WITH_RELEASE_ARTIFACT_SHA256
  # Run: shasum -a 256 ZoePlane_<version>_universal.tar.gz
  # Then paste the 64-character hex digest here.
  sha256 "REPLACE_BEFORE_PUBLISH_WITH_RELEASE_ARTIFACT_SHA256"

  url "https://github.com/BrinsCorp-Tech/zoeplane/releases/download/v#{version}/ZoePlane_#{version}_universal.tar.gz"
  name "ZoePlane"
  desc "OSS cockpit and plugin host for Claude-Code-native teams"
  homepage "https://github.com/BrinsCorp-Tech/zoeplane"

  license "Apache-2.0"

  # ZoePlane requires macOS 13+ (Tauri 2 WebKit minimum).
  depends_on macos: ">= :ventura"

  app "ZoePlane.app"

  # Prerequisites (informational — not auto-installed):
  #   - Claude Code CLI: npm install -g @anthropic-ai/claude-code
  #   - Bun runtime: https://bun.sh (required for sidecar features)
  # First run: ZoePlane will ask for permission to access ~/.claude/.

  zap trash: [
    "~/Library/Application Support/ZoePlane",
    "~/Library/Preferences/com.brinscorp.zoeplane.plist",
  ]
end
