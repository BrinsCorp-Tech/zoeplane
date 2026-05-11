# Installation — ZoePlane

## Supported Platforms

| Platform | Minimum OS version                      | Architecture                                            |
| -------- | --------------------------------------- | ------------------------------------------------------- |
| macOS    | 13 Ventura                              | Apple Silicon (arm64), Intel (x86_64), Universal binary |
| Windows  | Windows 10 (64-bit)                     | x86_64                                                  |
| Linux    | Ubuntu 22.04 or equivalent glibc ≥ 2.35 | x86_64                                                  |

macOS 13 is the minimum because Tauri 2.0 requires the WebKit version shipped with Ventura. Earlier macOS releases are not supported.

## Recommended Install Method

### macOS — Homebrew Cask

```bash
brew tap brinscorp-tech/zoeplane
brew install zoeplane
```

This installs the signed, notarized universal binary (Apple Silicon + Intel) from the BrinsCorp-Tech tap at `github.com/brinscorp-tech/homebrew-zoeplane`.

**Prerequisite:** The tap repository (`brinscorp-tech/homebrew-zoeplane`) is created and the Homebrew Cask is populated at the first signed release. Until then, use the manual install method below.

### Windows — Winget

```powershell
winget install BrinsCorpTech.ZoePlane
```

Winget submission to `microsoft/winget-pkgs` is post-Sprint-1. Until the package is listed, use the manual install method below.

### Linux — .deb (Debian/Ubuntu)

```bash
# Download the .deb from the GitHub Releases page, then:
sudo dpkg -i ZoePlane_<version>_amd64.deb
```

An RPM (`.rpm`) and AppImage (`.AppImage`) are also available on the GitHub Releases page for non-Debian distributions.

## Alternative Methods

### Manual download (all platforms)

Download the appropriate artifact from the GitHub Releases page at `github.com/BrinsCorp-Tech/zoeplane/releases`:

| Platform | Artifact                             | Notes                          |
| -------- | ------------------------------------ | ------------------------------ |
| macOS    | `ZoePlane_<version>_universal.dmg`   | Drag-to-Applications installer |
| Windows  | `ZoePlane_<version>_x64_en-US.msi`   | MSI installer                  |
| Windows  | `ZoePlane_<version>_x64-setup.exe`   | NSIS installer                 |
| Linux    | `ZoePlane_<version>_amd64.deb`       | Debian/Ubuntu                  |
| Linux    | `ZoePlane_<version>_x86_64.rpm`      | Red Hat/Fedora                 |
| Linux    | `ZoePlane_<version>_x86_64.AppImage` | Portable, any distro           |

### Build from source

Requirements: Bun ≥ 1.1.0, Rust stable toolchain (install via https://rustup.rs), Tauri CLI v2.

Install the Tauri CLI before building:

```bash
cargo install tauri-cli --version "^2" --locked
```

Then clone and build:

```bash
git clone https://github.com/BrinsCorp-Tech/zoeplane.git
cd zoeplane
bun install
bun run tauri:build
```

The produced bundles land in `src-tauri/target/release/bundle/`. See `docs/BUILD-AND-RELEASE.md` for the full build procedure including Linux system dependencies.

## Verifying the Install

### macOS — codesign and notarization

```bash
# Confirm the binary is signed
spctl --assess --type exec -vvv /Applications/ZoePlane.app

# Confirm notarization ticket is stapled
stapler validate /Applications/ZoePlane.app
```

Both commands should report `accepted`. The signing identity is `Developer ID Application: BrinsCorp-Tech`.

### Windows — Authenticode

Right-click `ZoePlane.exe` → Properties → Digital Signatures. The listed signer should be `BrinsCorp-Tech`. Authenticode signature verification is also available via PowerShell:

```powershell
Get-AuthenticodeSignature "C:\Program Files\ZoePlane\ZoePlane.exe"
```

### Linux — GPG signature

Each Linux release package is GPG-signed with the BrinsCorp-Tech release key. Verify:

```bash
gpg --verify ZoePlane_<version>_amd64.deb.sig ZoePlane_<version>_amd64.deb
```

TBD: GPG public key fingerprint and keyserver URI — pending first signed release output once 10 GHA secrets are provisioned (see `docs/BUILD-AND-RELEASE.md`).

### Confirm version

After installation, launch ZoePlane and check Help → About, or open a terminal:

```bash
# macOS
/Applications/ZoePlane.app/Contents/MacOS/ZoePlane --version

# Linux
zoeplane --version
```

## Runtime Prerequisites

ZoePlane's core features work standalone. For full functionality:

- **Claude Code CLI** (`claude`) — install via `npm install -g @anthropic-ai/claude-code`. The sidecar will harness this CLI for Path B task execution (Epic 04+).
- **Bun runtime** — required if running the sidecar in development mode. Production installs embed the bun-compiled sidecar binary; no separate Bun installation is needed.

On first launch, ZoePlane requests permission to read `~/.claude/` (the Claude Code data directory). This is where ZoePlane reads skills, agents, teams, workflows, and hooks. It does not write to `~/.claude/` in Sprint 1.

## Upgrading

### Homebrew

```bash
brew update && brew upgrade zoeplane
```

### Winget

```powershell
winget upgrade BrinsCorpTech.ZoePlane
```

### Manual

Download the new artifact from the GitHub Releases page and run the installer. Existing preferences and the derived SQLite database at `<appDataDir>/zoeplane.db` are preserved across upgrades. If a migration is needed, the migration runner applies it automatically on first launch of the new version.

## Uninstalling

### macOS

```bash
# Homebrew
brew uninstall zoeplane
brew untap brinscorp-tech/zoeplane

# Manual
rm -rf /Applications/ZoePlane.app
rm -rf ~/Library/Application\ Support/com.brinscorp.zoeplane
rm -f ~/Library/Preferences/com.brinscorp.zoeplane.plist
```

### Windows

Use Programs and Features (Control Panel) or:

```powershell
winget uninstall BrinsCorpTech.ZoePlane
```

### Linux

```bash
# .deb
sudo dpkg -r zoeplane

# .rpm
sudo rpm -e zoeplane

# AppImage
rm ~/Applications/ZoePlane-<version>-x86_64.AppImage
```

---

_Last reviewed: 2026-05-09 by tech-writer agent against Sprint 1._
