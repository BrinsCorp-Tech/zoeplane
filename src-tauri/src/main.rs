// ZoePlane — Tauri 2.0 entry point
//
// This file is intentionally thin. All application setup lives in lib.rs so
// that tauri-build can link the crate as a library for mobile targets.
//
// Dark mode toggled via [data-theme="dark"] on <html> — not via Tauri's
// native theme API (see docs/design/dark-mode-architecture.md).

// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    zoeplane_lib::run();
}
