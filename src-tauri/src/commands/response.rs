// ZoePlane — Shared command response type (Story 3.10 / AC #7)
//
// `CommandResponse` is the normalised structured response returned by every
// Tauri command in ZoePlane. It replaces the per-command ad-hoc `Result<(), String>`
// / `Result<ShellResponse, String>` patterns with a single shape understood by all
// UI consumers and by the Epic 06 IPC contract (ADR-007).
//
// Shape:
//   On success: `{ ok: true }`
//   On failure: `{ ok: false, code: "<error_code>", message: "<human_string>", path? }`
//
// The `Err` branch of `Result<CommandResponse, String>` is intentionally
// structurally unreachable — all command errors are encoded as
// `Ok(CommandResponse::err(...))`. This prevents unhandled promise rejections
// on the JavaScript side and gives the UI a uniform discriminated union to match on.
//
// Previously `ShellResponse` in `assets.rs` served this role for reveal_in_finder
// and open_in_editor only. Moving it here as `CommandResponse` (renamed for
// broader applicability) makes the type available to project.rs and editor.rs
// without a circular import. `assets.rs` now re-exports `CommandResponse` under
// its original `ShellResponse` alias for backward compatibility with unit tests.

use serde::Serialize;

/// Normalised structured response returned by all Tauri commands.
///
/// On success: `{ ok: true }`
/// On failure: `{ ok: false, code: "<error_code>", message: "<human_string>", path? }`
#[derive(Debug, Serialize)]
pub struct CommandResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

impl CommandResponse {
    /// Successful response with no payload.
    pub fn success() -> Self {
        CommandResponse {
            ok: true,
            code: None,
            message: None,
            path: None,
        }
    }

    /// Structured error response.
    ///
    /// `code` is a machine-readable snake_case string (e.g. "scope_denied",
    /// "unknown_project"). `message` is a human-readable explanation.
    /// `path` is optional — set when the error is path-specific.
    pub fn err(code: &str, message: String, path: Option<String>) -> Self {
        CommandResponse {
            ok: false,
            code: Some(code.to_string()),
            message: Some(message),
            path,
        }
    }

    // ---------------------------------------------------------------------------
    // Named constructors for frequently-used error codes
    // ---------------------------------------------------------------------------

    pub fn scope_denied(path: &str) -> Self {
        Self::err(
            "scope_denied",
            format!("Path is outside the runtime FS scope: {path}"),
            Some(path.to_string()),
        )
    }

    pub fn file_not_found(path: &str) -> Self {
        Self::err(
            "file_not_found",
            format!("Path does not exist on disk: {path}"),
            Some(path.to_string()),
        )
    }

    pub fn shell_invocation_failed(message: String) -> Self {
        Self::err("shell_invocation_failed", message, None)
    }

    pub fn unknown_project(project_id: &str) -> Self {
        Self::err(
            "unknown_project",
            format!("Project not found: {project_id}"),
            None,
        )
    }

    pub fn path_not_watched(path: &str) -> Self {
        Self::err(
            "path_not_watched",
            format!("Path is not under any watched root: {path}"),
            Some(path.to_string()),
        )
    }

    pub fn internal_error(message: String) -> Self {
        Self::err("internal_error", message, None)
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::CommandResponse;

    #[test]
    fn success_serialises_ok_true_no_extras() {
        let resp = CommandResponse::success();
        let json = serde_json::to_value(&resp).expect("serialisation must succeed");
        assert_eq!(json["ok"], true);
        assert!(json.get("code").is_none());
        assert!(json.get("message").is_none());
        assert!(json.get("path").is_none());
    }

    #[test]
    fn err_with_path_serialises_all_fields() {
        let resp = CommandResponse::err(
            "scope_denied",
            "Path outside scope".to_string(),
            Some("/etc/passwd".to_string()),
        );
        let json = serde_json::to_value(&resp).expect("serialisation must succeed");
        assert_eq!(json["ok"], false);
        assert_eq!(json["code"], "scope_denied");
        assert_eq!(json["path"], "/etc/passwd");
        assert!(json["message"].as_str().is_some());
    }

    #[test]
    fn err_without_path_omits_path_key() {
        let resp = CommandResponse::err("internal_error", "lock failed".to_string(), None);
        let json = serde_json::to_value(&resp).expect("serialisation must succeed");
        assert_eq!(json["ok"], false);
        assert_eq!(json["code"], "internal_error");
        assert!(json.get("path").is_none());
    }

    #[test]
    fn scope_denied_constructor_correct_code_and_path() {
        let resp = CommandResponse::scope_denied("/usr/local/etc/secret");
        assert!(!resp.ok);
        assert_eq!(resp.code.as_deref(), Some("scope_denied"));
        assert_eq!(resp.path.as_deref(), Some("/usr/local/etc/secret"));
    }

    #[test]
    fn file_not_found_constructor_correct_code_and_path() {
        let resp = CommandResponse::file_not_found("/tmp/missing.md");
        let json = serde_json::to_value(&resp).expect("serialisation must succeed");
        assert_eq!(json["ok"], false);
        assert_eq!(json["code"], "file_not_found");
        assert_eq!(json["path"], "/tmp/missing.md");
    }

    #[test]
    fn shell_invocation_failed_constructor_no_path() {
        let resp = CommandResponse::shell_invocation_failed("open command not found".to_string());
        let json = serde_json::to_value(&resp).expect("serialisation must succeed");
        assert_eq!(json["ok"], false);
        assert_eq!(json["code"], "shell_invocation_failed");
        assert!(json["message"].as_str().is_some());
        assert!(json.get("path").is_none());
    }

    #[test]
    fn unknown_project_constructor_no_path() {
        let resp = CommandResponse::unknown_project("proj-abc-123");
        let json = serde_json::to_value(&resp).expect("serialisation must succeed");
        assert_eq!(json["ok"], false);
        assert_eq!(json["code"], "unknown_project");
        assert!(json.get("path").is_none());
    }

    #[test]
    fn path_not_watched_constructor_includes_path() {
        let resp = CommandResponse::path_not_watched("/home/user/notes.md");
        assert!(!resp.ok);
        assert_eq!(resp.code.as_deref(), Some("path_not_watched"));
        assert_eq!(resp.path.as_deref(), Some("/home/user/notes.md"));
    }
}
