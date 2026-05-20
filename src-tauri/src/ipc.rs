// ZoePlane — Tauri IPC bridge
//
// This module declares the Tauri commands that the React UI can invoke via
// `invoke("command_name", args)`.
//
// Architecture note: the sidecar (Node.js/bun) handles all Claude API / CLI
// subprocess work. The Rust shell forwards IPC messages, manages the subprocess
// lifecycle, and handles filesystem permissions. The React UI NEVER speaks to
// the sidecar directly — it speaks only to Rust commands, which speak to the
// sidecar over HTTP loopback.

use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::{error, info, warn};

use crate::{HttpClient, SidecarPort};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Sidecar process lifecycle status returned by `sidecar_status`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarStatus {
    /// Whether the sidecar HTTP server responded to the health-check within
    /// the 100 ms SLA window.
    pub running: bool,
    /// OS PID of the sidecar process as reported by its `/health` response.
    pub pid: Option<u32>,
    /// Reserved for future use — will carry sidecar version string once
    /// Epic 02 adds richer health data.
    pub version: Option<String>,
    /// The HTTP loopback port the sidecar is listening on. Returned alongside
    /// `running: true` so the React UI can construct the sidecar base URL via
    /// IPC query when it joins after the one-shot `sidecar-ready` event has
    /// already fired (Sprint 5 / Story 6.2 pub-sub race fix).
    pub port: Option<u16>,
}

impl SidecarStatus {
    /// Constructs a "sidecar is down" status — used in all not-running branches
    /// of `sidecar_status`. Named constructor rather than `Default` so that the
    /// intent is explicit at every call site and future non-Optional fields force
    /// a compile-time decision here rather than silently inheriting a zero value.
    pub fn down() -> Self {
        Self {
            running: false,
            pid: None,
            version: None,
            port: None,
        }
    }
}

/// Shape of the sidecar's `GET /health` response body.
#[derive(Debug, Deserialize)]
struct HealthResponse {
    #[allow(dead_code)]
    status: String,
    pid: u32,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Health-check command used by the UI to verify the Tauri bridge is alive.
/// Returns "pong" unconditionally — no sidecar involvement.
#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}

/// Issues an HTTP health-check to the sidecar loopback server with a strict
/// 100 ms timeout (AC2 + AC5).
///
/// Returns `running: true` with the sidecar's reported PID on success.
/// Returns `running: false` if the port is not yet known (sidecar still
/// starting), if the request times out (AC5), or if the HTTP call fails.
///
/// AC5 note: timeout events are logged to the `sidecar-ipc` tracing target
/// so they appear in RUST_LOG output and can be correlated to a request.
#[tauri::command]
pub async fn sidecar_status(
    port_state: State<'_, SidecarPort>,
    http_client: State<'_, HttpClient>,
) -> Result<SidecarStatus, String> {
    // Read the port that was captured from the sidecar's stdout announcement.
    let port = {
        let guard = port_state.0.lock().map_err(|e| e.to_string())?;
        *guard
    };

    let Some(port) = port else {
        // Sidecar has not yet announced its port — still starting up.
        warn!(target: "sidecar-ipc", "Health-check called before sidecar port is known");
        return Ok(SidecarStatus::down());
    };

    let url = format!("http://127.0.0.1:{port}/health");
    info!(target: "sidecar-ipc", %url, "Issuing sidecar health-check");

    // Use the shared reqwest::Client from Tauri state (connection pool reuse).
    // The client has a 100 ms default timeout set at construction time (IPC SLA AC2 + AC5).
    let result = http_client.0.get(&url).send().await;

    match result {
        Ok(resp) if resp.status().is_success() => match resp.json::<HealthResponse>().await {
            Ok(health) => {
                info!(
                    target: "sidecar-ipc",
                    pid = health.pid,
                    "Sidecar health-check OK"
                );
                Ok(SidecarStatus {
                    running: true,
                    pid: Some(health.pid),
                    version: None,
                    port: Some(port),
                })
            }
            Err(e) => {
                error!(
                    target: "sidecar-ipc",
                    error = %e,
                    "Sidecar health-check: failed to parse response body"
                );
                Ok(SidecarStatus::down())
            }
        },
        Ok(resp) => {
            // HTTP error status (e.g., 500 from sidecar crash handler).
            error!(
                target: "sidecar-ipc",
                status = %resp.status(),
                %url,
                "Sidecar health-check returned non-success status"
            );
            Ok(SidecarStatus::down())
        }
        Err(e) if e.is_timeout() => {
            // AC5: log the timeout event with enough context to identify the request.
            error!(
                target: "sidecar-ipc",
                %url,
                timeout_ms = 100,
                "Sidecar health-check IPC timeout — sidecar did not respond within 100 ms"
            );
            Ok(SidecarStatus::down())
        }
        Err(e) => {
            // Connection refused, OS error, etc. — sidecar likely crashed.
            error!(
                target: "sidecar-ipc",
                error = %e,
                %url,
                "Sidecar health-check request failed"
            );
            Ok(SidecarStatus::down())
        }
    }
}

// TODO (Epic 03): add `read_dir_recursive`, `watch_path`, `stop_watch` commands.
// TODO (Epic 05): add `run_evaluator`, `get_evaluator_result` commands.
// TODO (Epic 07): add `spawn_task`, `stream_task_events`, `cancel_task` commands.
// TODO (Epic 09): add `read_hooks`, `write_hook`, `delete_hook` commands.
