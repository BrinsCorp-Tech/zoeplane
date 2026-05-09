// ZoePlane — FS allowlist-violation logger (FB-016)
//
// This module provides Tauri IPC command wrappers around the raw Tauri FS
// plugin operations. Each wrapper attempts the underlying operation and, if
// it is denied by the Tauri FS allowlist scope, catches the error and emits
// a structured log entry identifying the path and caller.
//
// ARCHITECTURE NOTE: callers (React UI and sidecar via IPC) MUST use these
// wrappers rather than calling the raw `tauri-plugin-fs` plugin API directly.
// The raw plugin's deny is silent — no path or caller is recorded. The wrapper
// is the only point where FB-016's mandatory "allowlist-violation log entry
// identifying the path and caller" is produced.
//
// TODO (Epic 02): When a project-open event is defined, extend the allowlist
// dynamically by appending the active project path to the FS scope at runtime.
// This covers the "active project path" portion of FB-015 which is deferred
// from Sprint 1 because Epic 02 has not yet defined the project-open event shape.
// Tracking issue: https://github.com/BrinsCorp-Tech/zoeplane/issues — label: epic-02/fs-allowlist-dynamic

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::command;
use tracing::{error, info};

/// Structured log payload emitted on every FS allowlist violation (FB-016).
/// Written at ERROR level so it surfaces in default log configurations.
#[derive(Debug, Serialize, Deserialize)]
struct FsViolationLog {
    path: String,
    caller: String,
    operation: String,
    timestamp_ms: u128,
}

/// Returns the current Unix timestamp in milliseconds for log entries.
fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

/// Logs a structured allowlist-violation entry at ERROR level (FB-016).
///
/// Parameters:
/// - `path`: The filesystem path that was denied.
/// - `caller`: Human-readable identifier for the invoking IPC command/component.
/// - `operation`: The FS operation that was attempted (e.g., "read_file", "write_file").
fn log_violation(path: &str, caller: &str, operation: &str) {
    let log = FsViolationLog {
        path: path.to_string(),
        caller: caller.to_string(),
        operation: operation.to_string(),
        timestamp_ms: now_ms(),
    };

    // Emit as structured fields so tracing subscribers can capture them.
    // Also serialize to JSON so the raw log line is machine-parseable.
    error!(
        target: "fs-allowlist",
        path = %log.path,
        caller = %log.caller,
        operation = %log.operation,
        timestamp_ms = log.timestamp_ms,
        "FS allowlist violation — operation denied"
    );

    // Belt-and-suspenders: also emit as a JSON-serialized line on stderr so
    // log aggregators that only capture raw stderr lines still see it.
    if let Ok(json) = serde_json::to_string(&log) {
        error!(target: "fs-allowlist-json", "{}", json);
    }
}

/// Determines whether an FS error is an allowlist-scope denial.
///
/// Tauri 2's `tauri-plugin-fs` returns a `tauri_plugin_fs::Error` whose
/// `to_string()` contains the substring "path not allowed" (or a variant)
/// when the target path is outside the configured allowlist scope. We match
/// on this string because the error type is not re-exported for `is()`-style
/// downcasting from caller code.
fn is_scope_deny(err: &str) -> bool {
    // Tauri 2 tauri-plugin-fs emits these substrings on scope denial.
    // "path not allowed" is the canonical v2 message (Error::PathNotAllowed).
    // "forbidden" and "not in the allowlist" cover historical variants.
    // Do NOT match "scope" generically — too broad; canonical message above already covers scope denials.
    err.contains("path not allowed")
        || err.contains("forbidden")
        || err.contains("not in the allowlist")
}

// ---------------------------------------------------------------------------
// Public IPC command wrappers
// ---------------------------------------------------------------------------

/// Reads a file at `path`, enforcing the Tauri FS allowlist and logging any
/// scope denial (FB-016).
///
/// `caller` identifies the invoking React component or sidecar module for
/// the violation log. Pass a short stable identifier, e.g., "ProjectList",
/// "SettingsPanel", or "sidecar:indexer".
#[command]
pub async fn fs_read_file(
    app: tauri::AppHandle,
    path: String,
    caller: String,
) -> Result<Vec<u8>, String> {
    // Resolve the path before attempting to read so we can log the raw string
    // even if the FS call is denied before resolving.
    let resolved = PathBuf::from(&path);

    info!(
        target: "fs-allowlist",
        path = %path,
        caller = %caller,
        operation = "read_file",
        "FS read_file requested"
    );

    // Use the tauri_plugin_fs::FsExt trait to call the underlying FS plugin.
    use tauri_plugin_fs::FsExt;
    match app.fs().read(resolved).await {
        Ok(bytes) => {
            info!(
                target: "fs-allowlist",
                path = %path,
                caller = %caller,
                bytes = bytes.len(),
                "FS read_file permitted"
            );
            Ok(bytes)
        }
        Err(e) => {
            let msg = e.to_string();
            if is_scope_deny(&msg) {
                log_violation(&path, &caller, "read_file");
            } else {
                error!(
                    target: "fs-allowlist",
                    path = %path,
                    caller = %caller,
                    error = %msg,
                    "FS read_file failed (non-scope error)"
                );
            }
            Err(msg)
        }
    }
}

/// Writes `contents` to `path`, enforcing the Tauri FS allowlist and logging
/// any scope denial (FB-016).
#[command]
pub async fn fs_write_file(
    app: tauri::AppHandle,
    path: String,
    contents: Vec<u8>,
    caller: String,
) -> Result<(), String> {
    let resolved = PathBuf::from(&path);

    info!(
        target: "fs-allowlist",
        path = %path,
        caller = %caller,
        operation = "write_file",
        bytes = contents.len(),
        "FS write_file requested"
    );

    use tauri_plugin_fs::FsExt;
    match app.fs().write(resolved, &contents).await {
        Ok(()) => {
            info!(
                target: "fs-allowlist",
                path = %path,
                caller = %caller,
                "FS write_file permitted"
            );
            Ok(())
        }
        Err(e) => {
            let msg = e.to_string();
            if is_scope_deny(&msg) {
                log_violation(&path, &caller, "write_file");
            } else {
                error!(
                    target: "fs-allowlist",
                    path = %path,
                    caller = %caller,
                    error = %msg,
                    "FS write_file failed (non-scope error)"
                );
            }
            Err(msg)
        }
    }
}

/// Reads the entries of a directory at `path`, enforcing the allowlist and
/// logging any scope denial (FB-016).
#[command]
pub async fn fs_read_dir(
    app: tauri::AppHandle,
    path: String,
    caller: String,
) -> Result<Vec<String>, String> {
    let resolved = PathBuf::from(&path);

    info!(
        target: "fs-allowlist",
        path = %path,
        caller = %caller,
        operation = "read_dir",
        "FS read_dir requested"
    );

    use tauri_plugin_fs::FsExt;
    match app.fs().read_dir(resolved, Default::default()).await {
        Ok(entries) => {
            let names: Vec<String> = entries
                .into_iter()
                .map(|e| e.name.unwrap_or_default())
                .collect();
            info!(
                target: "fs-allowlist",
                path = %path,
                caller = %caller,
                entry_count = names.len(),
                "FS read_dir permitted"
            );
            Ok(names)
        }
        Err(e) => {
            let msg = e.to_string();
            if is_scope_deny(&msg) {
                log_violation(&path, &caller, "read_dir");
            } else {
                error!(
                    target: "fs-allowlist",
                    path = %path,
                    caller = %caller,
                    error = %msg,
                    "FS read_dir failed (non-scope error)"
                );
            }
            Err(msg)
        }
    }
}

/// Checks whether a path exists within the allowlist, logging any scope denial (FB-016).
#[command]
pub async fn fs_exists(
    app: tauri::AppHandle,
    path: String,
    caller: String,
) -> Result<bool, String> {
    let resolved = PathBuf::from(&path);

    info!(
        target: "fs-allowlist",
        path = %path,
        caller = %caller,
        operation = "exists",
        "FS exists requested"
    );

    use tauri_plugin_fs::FsExt;
    match app.fs().exists(resolved).await {
        Ok(exists) => Ok(exists),
        Err(e) => {
            let msg = e.to_string();
            if is_scope_deny(&msg) {
                log_violation(&path, &caller, "exists");
            } else {
                error!(
                    target: "fs-allowlist",
                    path = %path,
                    caller = %caller,
                    error = %msg,
                    "FS exists check failed (non-scope error)"
                );
            }
            Err(msg)
        }
    }
}
