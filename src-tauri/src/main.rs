// ZoePlane — Tauri 2.0 entry point
// Single-window desktop shell; IPC bridge to the Node.js sidecar is in ipc.rs.
// Dark mode toggled via [data-theme="dark"] on <html> — not via Tauri's native theme API.

// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ipc;

use tauri::Manager;
use tracing::info;
use tracing_subscriber::{EnvFilter, FmtSubscriber};

pub fn run() {
    // Structured logging to stderr. Set RUST_LOG=debug for verbose output.
    let subscriber = FmtSubscriber::builder()
        .with_env_filter(EnvFilter::from_default_env())
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set tracing subscriber");

    info!("ZoePlane starting");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        // IPC commands are registered here — see ipc.rs for the command stubs.
        .invoke_handler(tauri::generate_handler![
            ipc::ping,
            ipc::sidecar_status,
        ])
        .setup(|app| {
            info!("App setup complete");
            let _window = app.get_webview_window("main").expect("Main window must exist");

            // TODO (Epic 01, Sprint 1): launch sidecar process here via tauri_plugin_shell.
            // The sidecar binary is declared in tauri.conf.json `externalBin`.
            // Pattern:
            //   let sidecar = app.shell().sidecar("zoeplane-sidecar")?.spawn()?;
            //   app.manage(sidecar);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running ZoePlane");
}

fn main() {
    run();
}
