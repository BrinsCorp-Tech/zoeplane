// ZoePlane — Asset reveal + editor open Tauri commands (Story 3.9 / FR-034, FR-035)
//
// Two commands that resolve an asset's canonical disk path to:
//   1. The OS-native file manager (reveal_in_finder — FR-034)
//   2. The user's configured external editor (open_in_editor — FR-035)
//
// Platform-fallback chains:
//   reveal_in_finder:
//     macOS   — `open -R <path>` (reveals in Finder with file selected)
//     Windows — `explorer /select,<path>` (DO NOT POSIX-normalise the path here)
//     Linux   — `xdg-open <parent_dir>` (freedesktop opener; no portable reveal verb)
//
//   open_in_editor:
//     Reads `detected_editor` from sidecar /preferences endpoint.
//     Value shape: { "name": "vscode"|"cursor"|"zed"|"system", "cli": "code"|"cursor"|"zed"|null }
//     Invokes <cli> <path>, or falls back to platform-default if cli is null.
//
// Security: every path is validated against the runtime FS scope via
// `is_allowed_for_probe` (Story 1.12) BEFORE any shell command is spawned.
//
// Windows path handling exception: `explorer /select,<path>` is the only call
// site in the codebase that must NOT apply POSIX normalisation — Windows Explorer
// requires native backslashes. All other paths are kept as-is (the shell layer
// accepts both separators on their respective platforms).

use std::path::PathBuf;

use serde::Deserialize;
use tauri::{command, AppHandle, State};
use tauri_plugin_fs::FsExt;
use tauri_plugin_shell::ShellExt;
use tracing::{error, info, warn};

use crate::commands::fs::is_allowed_for_probe;
use crate::commands::response::CommandResponse;
use crate::{HttpClient, SidecarPort};

// ---------------------------------------------------------------------------
// Response type alias
// ---------------------------------------------------------------------------

/// `ShellResponse` is a backward-compatible alias for `CommandResponse`.
///
/// Story 3.10 (AC #7) moved the shared response struct to `commands/response.rs`
/// as `CommandResponse`. This alias preserves the name used in the unit tests
/// and in any callers that imported `ShellResponse` directly from this module.
type ShellResponse = CommandResponse;

// ---------------------------------------------------------------------------
// reveal_in_finder
// ---------------------------------------------------------------------------

/// Reveal an asset's canonical disk path in the OS-native file manager.
///
/// Platform behaviour:
///   macOS   — `open -R <path>` opens Finder with the file selected.
///   Windows — `explorer /select,<path>` opens Explorer with the file selected.
///             NOTE: the path is passed with native backslashes (NOT POSIX-normalised)
///             because Windows Explorer requires backslashes in the `/select,` argument.
///   Linux   — `xdg-open <parent_dir>` opens the parent directory via the
///             freedesktop opener. The freedesktop spec has no portable "reveal" verb;
///             opening the parent directory is the specified acceptable fallback (FR-034).
///
/// Pre-flight checks (before any shell invocation):
///   1. Path is within the runtime FS scope (AC #6: scope_denied).
///   2. Path exists on disk (AC #8: file_not_found).
///
/// Returns `Ok(ShellResponse)` always — the Err branch is structurally unreachable
/// but required by Tauri's async command trait constraint (AC #5: never unhandled panic).
#[command]
pub async fn reveal_in_finder(app: AppHandle, path: String) -> Result<ShellResponse, String> {
    info!(
        target: "assets-reveal",
        path = %path,
        "reveal_in_finder: requested"
    );

    // ------------------------------------------------------------------
    // Pre-flight 1: scope check (AC #6)
    // ------------------------------------------------------------------
    let path_buf = PathBuf::from(&path);
    let scope = app.fs_scope();
    if !is_allowed_for_probe(&scope, &path_buf) {
        warn!(
            target: "assets-reveal",
            path = %path,
            "reveal_in_finder: scope_denied"
        );
        return Ok(ShellResponse::scope_denied(&path));
    }

    // ------------------------------------------------------------------
    // Pre-flight 2: existence check (AC #8)
    // ------------------------------------------------------------------
    if !path_buf.exists() {
        warn!(
            target: "assets-reveal",
            path = %path,
            "reveal_in_finder: file_not_found"
        );
        return Ok(ShellResponse::file_not_found(&path));
    }

    // ------------------------------------------------------------------
    // Platform-specific reveal invocation
    // ------------------------------------------------------------------
    let result = reveal_platform(&app, &path, &path_buf).await;

    match result {
        Ok(()) => {
            info!(
                target: "assets-reveal",
                path = %path,
                "reveal_in_finder: success"
            );
            Ok(ShellResponse::success())
        }
        Err(e) => {
            warn!(
                target: "assets-reveal",
                path = %path,
                error = %e,
                "reveal_in_finder: shell_invocation_failed"
            );
            Ok(ShellResponse::shell_invocation_failed(e))
        }
    }
}

/// Platform-specific reveal implementation.
/// Returns Ok(()) on successful spawn; Err(String) on failure.
#[allow(unused_variables)]
async fn reveal_platform(
    app: &AppHandle,
    path: &str,
    path_buf: &std::path::Path,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        app.shell()
            .command("open")
            .args(["-R", path])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("open -R failed: {e}"))
    }

    #[cfg(target_os = "windows")]
    {
        // WINDOWS PATH EXCEPTION: do NOT apply POSIX normalisation here.
        // `explorer /select,<path>` requires native backslashes. This is the
        // ONLY call site in the codebase that intentionally passes backslash paths.
        // The comma immediately follows `/select,` with no space between.
        let native_path = path_buf.to_string_lossy().replace('/', "\\");
        let arg = format!("/select,{native_path}");
        app.shell()
            .command("explorer")
            .args([arg.as_str()])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("explorer /select, failed: {e}"))
    }

    #[cfg(target_os = "linux")]
    {
        // xdg-open has no portable "reveal" verb — open the parent directory.
        // This is the documented acceptable fallback per FR-034.
        let parent = path_buf
            .parent()
            .ok_or_else(|| format!("Could not determine parent directory of {path}"))?;
        let parent_str = parent.to_string_lossy();
        app.shell()
            .command("xdg-open")
            .args([parent_str.as_ref()])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("xdg-open failed: {e}"))
    }

    // Fallback for any other target_os (should not occur in production).
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (app, path, path_buf);
        Err("reveal_in_finder: unsupported platform".to_string())
    }
}

// ---------------------------------------------------------------------------
// open_in_editor
// ---------------------------------------------------------------------------

/// Open an asset's canonical disk path in the user's configured editor.
///
/// Sequence:
///   1. Pre-flight: scope check + existence check.
///   2. Fetch `detected_editor` from sidecar GET /preferences/detected_editor.
///      Value: `{ "name": "vscode"|"cursor"|"zed"|"system", "cli": "code"|"cursor"|"zed"|null }`
///   3. Invoke `<cli> <path>`. If cli is null or name is "system", use the
///      platform default: `open <path>` (macOS), `xdg-open <path>` (Linux),
///      `cmd /c start "" <path>` (Windows — `start` is a cmd.exe builtin).
///   4. If preference is missing entirely, fall back to platform default.
///
/// Returns `Ok(ShellResponse)` always — the Err variant is structurally unreachable
/// but required by Tauri's async command trait constraint when State params are present
/// (AC #5: never unhandled panic or exception).
#[command]
pub async fn open_in_editor(
    app: AppHandle,
    http_client: State<'_, HttpClient>,
    port: State<'_, SidecarPort>,
    path: String,
) -> Result<ShellResponse, String> {
    info!(
        target: "assets-editor",
        path = %path,
        "open_in_editor: requested"
    );

    // ------------------------------------------------------------------
    // Pre-flight 1: scope check (AC #6)
    // ------------------------------------------------------------------
    let path_buf = PathBuf::from(&path);
    let scope = app.fs_scope();
    if !is_allowed_for_probe(&scope, &path_buf) {
        warn!(
            target: "assets-editor",
            path = %path,
            "open_in_editor: scope_denied"
        );
        return Ok(ShellResponse::scope_denied(&path));
    }

    // ------------------------------------------------------------------
    // Pre-flight 2: existence check (AC #8)
    // ------------------------------------------------------------------
    if !path_buf.exists() {
        warn!(
            target: "assets-editor",
            path = %path,
            "open_in_editor: file_not_found"
        );
        return Ok(ShellResponse::file_not_found(&path));
    }

    // ------------------------------------------------------------------
    // Step 2: Fetch detected_editor from sidecar preferences
    // ------------------------------------------------------------------
    let sidecar_port = {
        let guard = match port.0.lock() {
            Ok(g) => g,
            Err(e) => {
                let msg = format!("Failed to acquire SidecarPort lock: {e}");
                error!(target: "assets-editor", error = %msg, "open_in_editor: lock failure");
                return Ok(ShellResponse::internal_error(msg));
            }
        };
        *guard
    };

    let editor_cli: Option<String> = if let Some(p) = sidecar_port {
        fetch_editor_cli(&http_client.0, p).await
    } else {
        warn!(
            target: "assets-editor",
            "open_in_editor: sidecar port not yet known — using platform default"
        );
        None
    };

    // ------------------------------------------------------------------
    // Step 3: Invoke editor
    // ------------------------------------------------------------------
    let result = invoke_editor(&app, &path, editor_cli.as_deref()).await;

    match result {
        Ok(()) => {
            info!(
                target: "assets-editor",
                path = %path,
                "open_in_editor: success"
            );
            Ok(ShellResponse::success())
        }
        Err(e) => {
            warn!(
                target: "assets-editor",
                path = %path,
                error = %e,
                "open_in_editor: shell_invocation_failed"
            );
            Ok(ShellResponse::shell_invocation_failed(e))
        }
    }
}

/// Fetch the detected editor's CLI entrypoint from the sidecar preference store.
///
/// Returns `Some(cli)` if a non-null CLI was persisted (e.g., "code", "cursor", "zed"),
/// or `None` if the preference is missing, the name is "system", or the CLI is null.
async fn fetch_editor_cli(client: &reqwest::Client, sidecar_port: u16) -> Option<String> {
    let url = format!("http://127.0.0.1:{sidecar_port}/preferences/detected_editor");
    let resp = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        Ok(r) => {
            warn!(
                target: "editor",
                status = %r.status(),
                "fetch_editor_cli got non-success status"
            );
            return None;
        }
        Err(e) => {
            warn!(
                target: "editor",
                error = %e,
                "fetch_editor_cli HTTP error"
            );
            return None;
        }
    };

    #[derive(Deserialize)]
    struct PrefResponse {
        value: String,
    }
    #[derive(Deserialize)]
    struct EditorPref {
        name: String,
        cli: Option<String>,
    }

    let pref: PrefResponse = resp.json().await.ok()?;
    let editor: EditorPref = serde_json::from_str(&pref.value).ok()?;

    // "system" name means use platform default — return None to trigger fallback.
    if editor.name == "system" {
        return None;
    }

    editor.cli
}

/// Invoke the editor CLI with the given path, or fall back to the platform default.
async fn invoke_editor(app: &AppHandle, path: &str, cli: Option<&str>) -> Result<(), String> {
    match cli {
        Some(editor_cli) => {
            // Named editor: invoke `<cli> <path>`
            app.shell()
                .command(editor_cli)
                .args([path])
                .spawn()
                .map(|_| ())
                .map_err(|e| format!("{editor_cli} invocation failed: {e}"))
        }
        None => {
            // No detected editor — use platform default
            platform_default_open(app, path).await
        }
    }
}

/// Open a file with the platform-default application.
async fn platform_default_open(app: &AppHandle, path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        app.shell()
            .command("open")
            .args([path])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("open (default) failed: {e}"))
    }

    #[cfg(target_os = "linux")]
    {
        app.shell()
            .command("xdg-open")
            .args([path])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("xdg-open (default) failed: {e}"))
    }

    #[cfg(target_os = "windows")]
    {
        // `cmd /c start "" <path>` is the canonical Windows "open with default app"
        // invocation. `start` is a cmd.exe built-in (not a standalone executable),
        // so it must be invoked via `cmd /c`. The empty string is the window title
        // argument required by cmd.exe's start command.
        app.shell()
            .command("cmd")
            .args(["/c", "start", "", path])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("cmd start spawn failed: {e}"))
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (app, path);
        Err("open_in_editor: unsupported platform".to_string())
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::ShellResponse;

    // ---------------------------------------------------------------------------
    // Response struct serialisation tests
    // ---------------------------------------------------------------------------

    #[test]
    fn shell_response_success_serialises_correctly() {
        let resp = ShellResponse::success();
        let json = serde_json::to_value(&resp).expect("serialisation must succeed");
        assert_eq!(json["ok"], true);
        assert!(json.get("code").is_none(), "ok:true must not include code");
        assert!(
            json.get("message").is_none(),
            "ok:true must not include message"
        );
        assert!(json.get("path").is_none(), "ok:true must not include path");
    }

    #[test]
    fn shell_response_scope_denied_serialises_correctly() {
        let resp = ShellResponse::scope_denied("/etc/passwd");
        let json = serde_json::to_value(&resp).expect("serialisation must succeed");
        assert_eq!(json["ok"], false);
        assert_eq!(json["code"], "scope_denied");
        assert_eq!(json["path"], "/etc/passwd");
        assert!(
            json["message"].as_str().is_some(),
            "message must be present"
        );
    }

    #[test]
    fn shell_response_file_not_found_serialises_correctly() {
        let resp = ShellResponse::file_not_found("/tmp/missing.md");
        let json = serde_json::to_value(&resp).expect("serialisation must succeed");
        assert_eq!(json["ok"], false);
        assert_eq!(json["code"], "file_not_found");
        assert_eq!(json["path"], "/tmp/missing.md");
    }

    #[test]
    fn shell_response_shell_invocation_failed_serialises_correctly() {
        let resp = ShellResponse::shell_invocation_failed("open command not found".to_string());
        let json = serde_json::to_value(&resp).expect("serialisation must succeed");
        assert_eq!(json["ok"], false);
        assert_eq!(json["code"], "shell_invocation_failed");
        assert!(json["message"].as_str().is_some());
        assert!(json.get("path").is_none());
    }

    #[test]
    fn shell_response_error_variant_serialises_correctly() {
        let resp = ShellResponse::internal_error("lock poisoned".to_string());
        let json = serde_json::to_value(&resp).expect("serialisation must succeed");
        assert_eq!(json["ok"], false);
        assert_eq!(json["code"], "internal_error");
    }

    // ---------------------------------------------------------------------------
    // scope_denied is returned for out-of-scope paths (unit — no live AppHandle)
    // ---------------------------------------------------------------------------
    //
    // The full scope-check path (is_allowed_for_probe → reveal/open) is exercised
    // through the lib.rs fs_scope_tests.  Here we verify the response struct
    // produced on the denial branch.

    #[test]
    fn scope_denied_response_has_correct_code_and_path() {
        let denied = ShellResponse::scope_denied("/usr/local/etc/secret");
        assert!(!denied.ok);
        assert_eq!(denied.code.as_deref(), Some("scope_denied"));
        assert_eq!(denied.path.as_deref(), Some("/usr/local/etc/secret"));
    }

    // ---------------------------------------------------------------------------
    // Windows path exception — verify that native backslashes are preserved
    // when building the explorer argument (AC-8 / Windows path handling exception)
    // ---------------------------------------------------------------------------

    #[test]
    fn windows_path_native_backslash_preserved() {
        // Simulate the conversion done in the Windows branch of reveal_platform.
        // The POSIX form coming in from the UI must be converted TO backslashes
        // for explorer. This is the only place we reverse the AC-8 rule.
        let posix_path = "C:/Users/zeke/.claude/skills/my-skill/SKILL.md";
        let native = posix_path.replace('/', "\\");
        assert!(
            native.contains('\\'),
            "Windows explorer path must contain backslashes"
        );
        assert!(
            !native.starts_with('/'),
            "Windows path must not start with a Unix slash"
        );
    }

    // ---------------------------------------------------------------------------
    // Platform cfg gate sanity — at least one reveal branch compiles on this host
    // ---------------------------------------------------------------------------

    #[test]
    fn reveal_response_types_compile_on_this_platform() {
        // This test simply confirms the file compiles under the host platform's
        // cfg gates — if #[cfg(target_os = "macos")] blocks were malformed this
        // cargo test run would fail to compile.
        let _ = ShellResponse::success();
    }
}
