# ZoePlane Tauri Icons

## Required files (do not delete)

- `icon-master.png` — 1024x1024 PNG source. ZoePlane brand master (geometric Z made of layered planes, deep blue-violet palette). Regenerate all variants if you replace it.
- `32x32.png`, `128x128.png`, `128x128@2x.png` — required PNG variants referenced in `tauri.conf.json` `bundle.icon[]`.
- `icon.icns` — required macOS icon container.
- `icon.ico` — required Windows icon container.
- `icon.png`, `64x64.png` — additional PNG sizes (kept for reference).

## How to regenerate

If you replace `icon-master.png` (e.g., when finalized brand art lands), run from the repo root:

```
bunx @tauri-apps/cli@2 icon src-tauri/icons/icon-master.png --output src-tauri/icons
```

Then **manually delete** the `android/`, `ios/`, `Square*Logo.png`, and `StoreLogo.png` outputs that the CLI emits — those are mobile/UWP variants not used by ZoePlane's desktop-only build.

## Why this matters

Tauri 2.x **requires** all 5 referenced icon files to be present at build time:

- **macOS / Linux**: `tauri::generate_context!()` proc macro reads each PNG path declared in `tauri.conf.json` `bundle.icon[]`. Missing files panic at codegen.
- **Windows**: `tauri-build`'s `build.rs` requires `icon.ico` to generate the Win32 resource (compiled into the .exe via `tauri-winres`). Missing `icon.ico` fails earlier than the codegen step.

There is **no** placeholder fallback — the schema is strict. The repo's `scaffold-health` CI job enforces icon presence so the failure surfaces in seconds rather than 3+ minutes into a Rust compile.
