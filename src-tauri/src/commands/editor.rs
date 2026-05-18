// ZoePlane — Editor open/close Tauri commands (Story 3.8 / FR-006 boundary)
//
// Proxies the UI's "I have this file open for editing" state to the sidecar
// so the event-router can distinguish silent-reindex paths (FR-007) from
// the externally-modified-while-open banner path (FR-006).
//
// Commands:
//   register_open_editor(path)   — POST /editor/open to sidecar
//   unregister_open_editor(path) — POST /editor/close to sidecar
//
// These commands are fire-and-forget from the UI's perspective — the sidecar
// maintains the editorOpenSet in memory (process-lifetime only, no persistence).
//
// Error handling:
//   - If the path is not under any watched root, the sidecar returns HTTP 400
//     with { code: "path_not_watched" }. This error is propagated to the caller
//     so the UI can log it (Epic 06 must not register unwatched paths).
//   - Sidecar transport failures are returned as Err strings.
//
// Windows-CI: path is normalised to POSIX separators at the command boundary
// via to_posix() before being sent to the sidecar.

use tauri::{command, State};
use tracing::{error, info, warn};

use crate::{HttpClient, SidecarPort};

// ---------------------------------------------------------------------------
// Path normalisation helper (mirrors project.rs)
// ---------------------------------------------------------------------------

fn to_posix(s: &str) -> String {
    s.replace('\\', "/")
}

// ---------------------------------------------------------------------------
// HTTP POST helper — mirrors the pattern in project.rs
// ---------------------------------------------------------------------------

async fn sidecar_post(
    http_client: &reqwest::Client,
    port: u16,
    path: &str,
    body: serde_json::Value,
) -> Result<u16, String> {
    let url = format!("http://127.0.0.1:{port}{path}");
    let resp = http_client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("HTTP POST {url} failed: {e}"))?;
    Ok(resp.status().as_u16())
}

// ---------------------------------------------------------------------------
// register_open_editor
// ---------------------------------------------------------------------------

/// Register an asset file path as currently open for editing in the sidecar's
/// `editorOpenSet`.
///
/// While registered, watcher events for `path` will emit
/// `AssetExternallyModifiedWhileOpenEvent` (Epic 06 FR-006 banner trigger)
/// instead of the silent `LibraryRefreshEvent` (FR-007).
///
/// Returns `Err` with `{ code: "path_not_watched", path }` JSON if the path is
/// not under any watched root — the editor must only register watched paths.
#[command]
pub async fn register_open_editor(
    port_state: State<'_, SidecarPort>,
    http_client: State<'_, HttpClient>,
    path: String,
) -> Result<(), String> {
    let path = to_posix(&path);

    info!(
        target: "editor-open",
        path = %path,
        "register_open_editor: registering path"
    );

    let port = {
        let guard = port_state
            .0
            .lock()
            .map_err(|e| format!("Failed to acquire SidecarPort lock: {e}"))?;
        *guard
    };
    let Some(port) = port else {
        return Err("register_open_editor: sidecar port not yet known".to_string());
    };

    let status = sidecar_post(
        &http_client.0,
        port,
        "/editor/open",
        serde_json::json!({ "path": path }),
    )
    .await
    .map_err(|e| format!("register_open_editor: sidecar /editor/open POST failed: {e}"))?;

    if status == 400 {
        let msg = format!(
            "register_open_editor: path is not under any watched root — {{ \"code\": \"path_not_watched\", \"path\": \"{path}\" }}"
        );
        warn!(target: "editor-open", path = %path, "register_open_editor: path_not_watched");
        return Err(msg);
    }

    if status >= 400 {
        return Err(format!(
            "register_open_editor: sidecar returned HTTP {status} for /editor/open"
        ));
    }

    info!(
        target: "editor-open",
        path = %path,
        "register_open_editor: registered successfully"
    );

    Ok(())
}

// ---------------------------------------------------------------------------
// unregister_open_editor
// ---------------------------------------------------------------------------

/// Remove an asset file path from the sidecar's `editorOpenSet`.
///
/// Subsequent watcher events for `path` resume the silent FR-007 reindex path.
/// This is a no-op on the sidecar side if the path was not registered.
#[command]
pub async fn unregister_open_editor(
    port_state: State<'_, SidecarPort>,
    http_client: State<'_, HttpClient>,
    path: String,
) -> Result<(), String> {
    let path = to_posix(&path);

    info!(
        target: "editor-open",
        path = %path,
        "unregister_open_editor: unregistering path"
    );

    let port = {
        let guard = port_state
            .0
            .lock()
            .map_err(|e| format!("Failed to acquire SidecarPort lock: {e}"))?;
        *guard
    };
    let Some(port) = port else {
        return Err("unregister_open_editor: sidecar port not yet known".to_string());
    };

    let status = sidecar_post(
        &http_client.0,
        port,
        "/editor/close",
        serde_json::json!({ "path": path }),
    )
    .await
    .map_err(|e| format!("unregister_open_editor: sidecar /editor/close POST failed: {e}"))?;

    if status >= 400 {
        error!(
            target: "editor-open",
            path = %path,
            status,
            "unregister_open_editor: sidecar returned non-2xx"
        );
        return Err(format!(
            "unregister_open_editor: sidecar returned HTTP {status} for /editor/close"
        ));
    }

    info!(
        target: "editor-open",
        path = %path,
        "unregister_open_editor: unregistered successfully"
    );

    Ok(())
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::to_posix;

    #[test]
    fn posix_normalisation_passes_through_posix_paths() {
        let posix = "/Users/zeke/.claude/skills/my-skill/SKILL.md";
        assert_eq!(to_posix(posix), posix);
    }

    #[test]
    fn posix_normalisation_converts_windows_separators() {
        let win = r"C:\Users\zeke\.claude\skills\my-skill\SKILL.md";
        let expected = "C:/Users/zeke/.claude/skills/my-skill/SKILL.md";
        assert_eq!(to_posix(win), expected);
    }
}
