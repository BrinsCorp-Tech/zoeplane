// ZoePlane — Tauri IPC bridge stubs
//
// This module declares the Tauri commands that the React UI can invoke via
// `invoke("command_name", args)`. All commands here are stubs; they will be
// implemented in Epic 01 (Project Scaffold) and expanded across subsequent epics.
//
// Architecture note: the sidecar (Node.js) handles all Claude API / CLI
// subprocess work. The Rust shell forwards IPC messages, manages the subprocess
// lifecycle, and handles filesystem permissions. The React UI NEVER speaks to
// the CLI directly — it speaks only to Rust commands, which speak to the sidecar.

use serde::{Deserialize, Serialize};

/// Health-check command used by the UI to verify the Tauri bridge is alive.
/// Returns "pong" unconditionally.
#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}

/// Returns the current lifecycle status of the sidecar process.
/// Stub — real implementation wires to the sidecar subprocess handle (Epic 01).
#[tauri::command]
pub fn sidecar_status() -> SidecarStatus {
    // TODO (Epic 01): check actual subprocess PID / health.
    SidecarStatus {
        running: false,
        pid: None,
        version: None,
    }
}

/// Sidecar process lifecycle status returned by `sidecar_status`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub version: Option<String>,
}

// TODO (Epic 03): add `read_dir_recursive`, `watch_path`, `stop_watch` commands.
// TODO (Epic 05): add `run_evaluator`, `get_evaluator_result` commands.
// TODO (Epic 07): add `spawn_task`, `stream_task_events`, `cancel_task` commands.
// TODO (Epic 09): add `read_hooks`, `write_hook`, `delete_hook` commands.
