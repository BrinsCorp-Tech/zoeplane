# ZoePlane App Icons

This directory must contain the following icon files before the first production build.
Tauri requires specific sizes and formats per platform.

## Required files

| File | Size | Format | Platform |
|------|------|--------|----------|
| `32x32.png` | 32×32 | PNG | Linux (window manager) |
| `128x128.png` | 128×128 | PNG | Linux (app launcher), Windows |
| `128x128@2x.png` | 256×256 | PNG | macOS Retina |
| `icon.icns` | Multi-size ICNS bundle | ICNS | macOS |
| `icon.ico` | Multi-size ICO bundle | ICO | Windows |

## How to generate

1. Start with a 1024×1024 master SVG or PNG at `icon-master.svg`.
2. Run `cargo tauri icon icon-master.svg` (requires `cargo-tauri` CLI).
   This auto-generates all required formats from the master.
3. Commit the generated files (do NOT commit the master unless it's the canonical design asset).

## Design brief

- ZoePlane brand identity: see `docs/design/ux-spec.md` §2.1 for font/color decisions.
- Primary brand color: `--accent-600` (oklch(0.560 0.200 260) in light; `--accent-400` dark).
- Icon should work on both light and dark OS backgrounds (macOS dark mode, Windows dark mode).
- Keep it simple — a single recognizable glyph at 32×32 is the bar.

## Status

TODO: icon design not started. Blocking for first App Store submission (v1.x deferred).
Non-blocking for development builds — Tauri uses a placeholder if files are absent.
