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
use tauri_plugin_fs::FsExt;
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
/// In v2.5.1 of `tauri-plugin-fs`, the only `Fs<R>` method that routes through
/// the plugin's allowlist scope is `read()` (and its sibling `read_to_string()`),
/// which surface scope denials as `std::io::Error`. The plugin's error message
/// for the deny case includes the substring "path not allowed". We match on
/// this string because the underlying error type is `std::io::Error` whose
/// `kind()` is `PermissionDenied` for many unrelated reasons; the message
/// substring is the most reliable disambiguator.
///
/// For `fs_write_file`, `fs_read_dir`, and `fs_exists`, scope is checked
/// explicitly via `app.fs_scope().is_allowed()` before any I/O — so this
/// helper is only consulted by `fs_read_file`.
fn is_scope_deny(err: &str) -> bool {
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

    // FsExt::read() in tauri-plugin-fs v2.5.1 is synchronous; it returns
    // std::io::Result<Vec<u8>>. The plugin's allowlist scope is enforced
    // inside read() (via the underlying open() routing through scope checks),
    // so a scope-deny surfaces as an io::Error whose message we can match.
    match app.fs().read(resolved) {
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

    // tauri-plugin-fs v2.5.1 does not expose a write() method on Fs<R>; the
    // plugin's write IPC handler is JS-only. We replicate FB-016 enforcement
    // ourselves: explicit allowlist check via fs_scope().is_allowed(), then
    // std::fs::write for the actual I/O.
    let scope = app.fs_scope();
    if !scope.is_allowed(&resolved) {
        log_violation(&path, &caller, "write_file");
        return Err("path not allowed".to_string());
    }

    match std::fs::write(&resolved, &contents) {
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
            error!(
                target: "fs-allowlist",
                path = %path,
                caller = %caller,
                error = %msg,
                "FS write_file failed (post-scope I/O error)"
            );
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

    // tauri-plugin-fs v2.5.1 does not expose a read_dir() method on Fs<R>; the
    // plugin's read_dir IPC handler is JS-only. Same pattern as fs_write_file:
    // explicit scope check, then std::fs::read_dir for the listing.
    let scope = app.fs_scope();
    if !scope.is_allowed(&resolved) {
        log_violation(&path, &caller, "read_dir");
        return Err("path not allowed".to_string());
    }

    match std::fs::read_dir(&resolved) {
        Ok(entries) => {
            let mut names: Vec<String> = Vec::new();
            for entry in entries {
                match entry {
                    Ok(e) => {
                        // file_name() returns OsString; lossy conversion preserves
                        // the entry even when names contain non-UTF-8 bytes.
                        names.push(e.file_name().to_string_lossy().into_owned());
                    }
                    Err(e) => {
                        // Skip individual entries that fail to read; do not fail
                        // the whole listing for one bad inode.
                        error!(
                            target: "fs-allowlist",
                            path = %path,
                            caller = %caller,
                            error = %e,
                            "Skipping unreadable directory entry"
                        );
                    }
                }
            }
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
            error!(
                target: "fs-allowlist",
                path = %path,
                caller = %caller,
                error = %msg,
                "FS read_dir failed (post-scope I/O error)"
            );
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

    // tauri-plugin-fs v2.5.1 does not expose an exists() method on Fs<R>; the
    // plugin's exists IPC handler is JS-only. Pattern as above: explicit scope
    // check, then std::path::Path::exists() for the lookup.
    let scope = app.fs_scope();
    if !scope.is_allowed(&resolved) {
        log_violation(&path, &caller, "exists");
        return Err("path not allowed".to_string());
    }

    Ok(resolved.exists())
}
