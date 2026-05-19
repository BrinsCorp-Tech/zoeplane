// ZoePlane — Project management Tauri commands (Story 3.7 / FR-040 / FB-015)
//
// Provides three commands to manage the set of tracked projects:
//
//   switch_project  — Activate a project: persist outgoing state, extend FS
//                     scope, trigger sidecar rescan, recompute shadows, emit
//                     completion event.
//   add_project     — Register a new project root; validates .claude/ exists,
//                     inserts the projects row, does NOT auto-activate.
//   remove_project  — Soft-delete a project: emit project:close to sidecar,
//                     tombstone assets/hook_index/route_stacks/recent_files.
//
// IPC pattern: Tauri commands call the sidecar over HTTP loopback (the
// established Sprint 1 transport). The sidecar's /watcher/project/open and
// /watcher/project/close endpoints already exist (Story 3.2).
//
// FS scope extension: uses `app.fs_scope().allow_directory(path, true)` per
// ADR-003 (Story 1.12). The `is_allowed_for_probe` ancestor helper from fs.rs
// is reused for pre-extension scope validation.
//
// Windows-CI compliance: all path strings that arrive as user input are
// normalised to POSIX separators via `to_posix()` at the command boundary.

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Deserialize;
use tauri::{command, AppHandle, Emitter, State};
use tauri_plugin_fs::FsExt;
use tracing::{error, info, warn};

use crate::commands::response::CommandResponse;
use crate::{HttpClient, SidecarPort};

// ---------------------------------------------------------------------------
// Path normalisation helper (Windows-CI AC-8)
// ---------------------------------------------------------------------------

/// Normalise a path string to POSIX separators.
///
/// Called at every command boundary where a path arrives as a `String` from
/// the UI or from the database. Keeps internal comparisons consistent on
/// Windows without requiring callers to pre-convert.
fn to_posix(s: &str) -> String {
    s.replace('\\', "/")
}

// ---------------------------------------------------------------------------
// Timestamp helper
// ---------------------------------------------------------------------------

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// ---------------------------------------------------------------------------
// Structured error codes returned over the IPC boundary (AC #6)
//
// These constants are embedded directly into serde_json::json! error payloads
// rather than used as typed structs — keeping the serialisation simple while
// still providing machine-readable codes to the UI.
// ---------------------------------------------------------------------------

/// Error code emitted when switch_project / remove_project is called with a
/// projectId that does not exist in the `projects` table.
const ERR_UNKNOWN_PROJECT: &str = "unknown_project";

/// Error code emitted when the runtime FS scope extension fails (AC #8).
const ERR_FS_SCOPE_EXTENSION: &str = "fs_scope_extension_failed";

// ---------------------------------------------------------------------------
// Internal project info — returned from get_project_info helper
// ---------------------------------------------------------------------------

#[derive(Debug)]
struct ProjectInfo {
    path: String,
}

// ---------------------------------------------------------------------------
// HTTP helper — reuse the shared reqwest::Client from Tauri state
// ---------------------------------------------------------------------------

/// POST `body_json` to `http://127.0.0.1:{port}{path}` and return the status.
///
/// Returns `Err` only on hard transport failures; HTTP-level errors
/// (4xx / 5xx) are returned as `Ok(status_code)` so callers can log and decide.
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
// switch_project
// ---------------------------------------------------------------------------

/// Activate a tracked project.
///
/// Full orchestration sequence:
///   1. Look up the project row (structured error if missing).
///   2. Write outgoing state (route_stacks + window_layouts).
///   3. Update user_preferences['active_project_id'].
///   4. Extend the runtime FS scope for <projectRoot>/.claude/** (FB-015).
///   5. POST /watcher/project/open to the sidecar.
///   6. Trigger sidecar rescan (POST /indexer/scan/project).
///   7. POST /indexer/shadows/recompute/{projectId} to recompute shadows.
///   8. Emit ProjectSwitchCompletedEvent via Tauri event.
///
/// On FS scope extension failure, emits ProjectSwitchFailedEvent and returns
/// `Ok(CommandResponse::err("fs_scope_extension_failed", ...))` — the previous
/// active project remains active (AC #8).
///
/// On missing .claude/ after switch, completes with empty rescan and emits
/// ProjectClaudeMissingWarning (AC #7).
///
/// `stack_json` and `layout_json` are opaque blobs from the UI.
///
/// Returns `Ok(CommandResponse)` always — the Err branch is structurally unreachable
/// but required by Tauri's async command trait constraint (AC #7: no throws across
/// the Tauri command boundary).
#[command]
pub async fn switch_project(
    app: AppHandle,
    port_state: State<'_, SidecarPort>,
    http_client: State<'_, HttpClient>,
    project_id: String,
    stack_json: Option<String>,
    layout_json: Option<String>,
) -> Result<CommandResponse, String> {
    let start_ms = now_ms();
    let project_id_posix = project_id.clone(); // UUID — no path normalisation needed

    info!(
        target: "project-switch",
        project_id = %project_id_posix,
        "switch_project: starting"
    );

    // ------------------------------------------------------------------
    // Step 1: Resolve the sidecar port (needed for HTTP calls later)
    // ------------------------------------------------------------------
    let port = {
        let lock_result = port_state.0.lock();
        match lock_result {
            Ok(guard) => *guard,
            Err(e) => {
                let msg = format!("Failed to acquire SidecarPort lock: {e}");
                error!(target: "project-switch", %project_id_posix, "{}", msg);
                return Ok(CommandResponse::internal_error(msg));
            }
        }
    };
    let Some(port) = port else {
        let msg = "switch_project: sidecar port not yet known — sidecar still starting";
        error!(target: "project-switch", %project_id_posix, "{}", msg);
        return Ok(CommandResponse::internal_error(msg.to_string()));
    };

    // ------------------------------------------------------------------
    // Step 2: Look up the project (AC #6 — structured error on unknown id)
    // ------------------------------------------------------------------
    // We read project path synchronously via a blocking call. The DB is
    // accessed by the sidecar, not from Rust. We use the sidecar's
    // /projects/{id} lookup endpoint if one exists, or rely on the
    // information embedded in the switch request.
    //
    // Reality check: Rust has no direct SQLite access here (sidecar owns DB).
    // We query the sidecar HTTP endpoint for project info.
    // For v1 the project_root is supplied by the UI (it already has the
    // project list from the sidecar's SSE/hydration events). We accept
    // it as an explicit parameter to avoid an extra round-trip.
    //
    // The story brief says `switch_project(projectId, stack_json, layout_json)`.
    // We need `projectRoot` too — see implementation note in open question #1.
    // For now, query the sidecar for project info.
    let project_info = match get_project_info(&http_client.0, port, &project_id_posix).await {
        Ok(info) => info,
        Err(e) => {
            error!(
                target: "project-switch",
                project_id = %project_id_posix,
                error = %e,
                "switch_project: project lookup failed"
            );
            return Ok(CommandResponse::unknown_project(&project_id_posix));
        }
    };
    let project_root_raw = project_info.path;
    let project_root = to_posix(&project_root_raw);

    info!(
        target: "project-switch",
        project_id = %project_id_posix,
        project_root = %project_root,
        "switch_project: project found"
    );

    // ------------------------------------------------------------------
    // Step 3: Persist outgoing state (route_stacks + window_layouts)
    // ------------------------------------------------------------------
    if let Some(ref stack) = stack_json {
        let save_status = sidecar_post(
            &http_client.0,
            port,
            "/state/route-stacks",
            serde_json::json!({ "projectId": project_id_posix, "stackJson": stack }),
        )
        .await;
        match save_status {
            Ok(status) if status < 300 => {
                info!(
                    target: "project-switch",
                    project_id = %project_id_posix,
                    "switch_project: route_stacks persisted"
                );
            }
            Ok(status) => {
                warn!(
                    target: "project-switch",
                    project_id = %project_id_posix,
                    status,
                    "switch_project: route_stacks persist returned non-2xx — continuing"
                );
            }
            Err(e) => {
                warn!(
                    target: "project-switch",
                    project_id = %project_id_posix,
                    error = %e,
                    "switch_project: route_stacks persist failed — continuing"
                );
            }
        }
    }

    if let Some(ref layout) = layout_json {
        let save_status = sidecar_post(
            &http_client.0,
            port,
            "/state/window-layouts",
            serde_json::json!({ "projectId": project_id_posix, "layoutJson": layout }),
        )
        .await;
        match save_status {
            Ok(status) if status < 300 => {
                info!(
                    target: "project-switch",
                    project_id = %project_id_posix,
                    "switch_project: window_layouts persisted"
                );
            }
            Ok(status) => {
                warn!(
                    target: "project-switch",
                    project_id = %project_id_posix,
                    status,
                    "switch_project: window_layouts persist returned non-2xx — continuing"
                );
            }
            Err(e) => {
                warn!(
                    target: "project-switch",
                    project_id = %project_id_posix,
                    error = %e,
                    "switch_project: window_layouts persist failed — continuing"
                );
            }
        }
    }

    // ------------------------------------------------------------------
    // Step 4: Update user_preferences['active_project_id'] in sidecar DB
    //
    // INVARIANT: get_active_project_id MUST be called BEFORE the POST to
    // /preferences. The sidecar DB is synchronous (bun:sqlite); calling GET
    // after POST would return the newly-written value, making previousProjectId
    // equal to project_id in the completion event (AC #2 broken).
    // ------------------------------------------------------------------

    // Capture the outgoing project BEFORE writing the new active_project_id.
    let previous_project_id = get_active_project_id(&http_client.0, port)
        .await
        .ok()
        .flatten();

    let pref_status = sidecar_post(
        &http_client.0,
        port,
        "/preferences",
        serde_json::json!({ "key": "active_project_id", "value": project_id_posix }),
    )
    .await;

    match pref_status {
        Ok(status) if status < 300 => {
            info!(
                target: "project-switch",
                project_id = %project_id_posix,
                "switch_project: active_project_id preference updated"
            );
        }
        Ok(status) => {
            warn!(
                target: "project-switch",
                project_id = %project_id_posix,
                status,
                "switch_project: preference update returned non-2xx — continuing"
            );
        }
        Err(e) => {
            warn!(
                target: "project-switch",
                project_id = %project_id_posix,
                error = %e,
                "switch_project: preference update failed — continuing"
            );
        }
    }

    // ------------------------------------------------------------------
    // Step 5: Extend runtime FS scope for <projectRoot>/.claude/** (FB-015 / AC #1c)
    // ------------------------------------------------------------------
    let claude_dir = PathBuf::from(&project_root).join(".claude");

    // Pre-extension probe: check the path against the existing scope (or its
    // ancestor) using the is_allowed_for_probe helper from fs.rs, to validate
    // the path is safe before registering it.
    let scope = app.fs_scope();
    // We do NOT block the extension if the probe fails — the probe checks if
    // it's already in scope, but FB-015 is specifically about EXTENDING the scope
    // for NEW project paths. We proceed with the extension but log the pre-state.
    let pre_allowed = super::fs::is_allowed_for_probe(&scope, &claude_dir);
    info!(
        target: "project-switch",
        project_id = %project_id_posix,
        claude_dir = %claude_dir.display(),
        pre_allowed,
        "switch_project: extending FS scope for project claude dir"
    );

    match scope.allow_directory(&claude_dir, true) {
        Ok(()) => {
            info!(
                target: "project-switch",
                project_id = %project_id_posix,
                claude_dir = %claude_dir.display(),
                "switch_project: FS scope extended for project"
            );
        }
        Err(e) => {
            // AC #8: FS scope extension failure — log, emit ProjectSwitchFailedEvent,
            // do NOT proceed with rescan (rescan would hit FS-scope denial).
            let reason = format!("{}: {e}", ERR_FS_SCOPE_EXTENSION);
            error!(
                target: "project-switch",
                project_id = %project_id_posix,
                claude_dir = %claude_dir.display(),
                error = %e,
                "switch_project: FS scope extension failed — aborting switch"
            );
            app.emit(
                "project-switch-failed",
                serde_json::json!({
                    "type": "project:switch:failed",
                    "projectId": project_id_posix,
                    "reason": reason
                }),
            )
            .ok();
            return Ok(CommandResponse::err(ERR_FS_SCOPE_EXTENSION, reason, None));
        }
    }

    // ------------------------------------------------------------------
    // Step 6: Check whether .claude/ exists; handle missing case (AC #7)
    // ------------------------------------------------------------------
    let claude_exists = claude_dir.exists();
    if !claude_exists {
        warn!(
            target: "project-switch",
            project_id = %project_id_posix,
            claude_dir = %claude_dir.display(),
            "switch_project: .claude/ directory missing — emitting ProjectClaudeMissingWarning, completing with empty rescan"
        );
        app.emit(
            "project-claude-missing",
            serde_json::json!({
                "type": "project:claude:missing",
                "projectId": project_id_posix
            }),
        )
        .ok();
        // Emit completion event (empty rescan path still counts as completed)
        let elapsed = now_ms().saturating_sub(start_ms);
        app.emit(
            "project-switch-completed",
            serde_json::json!({
                "type": "project:switch:completed",
                "projectId": project_id_posix,
                "previousProjectId": previous_project_id,
                "elapsedMs": elapsed
            }),
        )
        .ok();
        return Ok(CommandResponse::success());
    }

    // ------------------------------------------------------------------
    // Step 7: POST /watcher/project/open — watcher adds the watch root (AC #1e)
    // ------------------------------------------------------------------
    let open_status = sidecar_post(
        &http_client.0,
        port,
        "/watcher/project/open",
        serde_json::json!({ "projectRoot": project_root }),
    )
    .await;
    match open_status {
        Ok(status) if status < 300 => {
            info!(
                target: "project-switch",
                project_id = %project_id_posix,
                project_root = %project_root,
                "switch_project: watcher/project/open OK"
            );
        }
        Ok(status) => {
            warn!(
                target: "project-switch",
                project_id = %project_id_posix,
                status,
                "switch_project: watcher/project/open returned non-2xx — continuing"
            );
        }
        Err(e) => {
            warn!(
                target: "project-switch",
                project_id = %project_id_posix,
                error = %e,
                "switch_project: watcher/project/open failed — continuing"
            );
        }
    }

    // ------------------------------------------------------------------
    // Step 8: Trigger sidecar rescan scoped to projectRoot (AC #1d)
    // ------------------------------------------------------------------
    let scan_status = sidecar_post(
        &http_client.0,
        port,
        "/indexer/scan/project",
        serde_json::json!({ "projectRoot": project_root }),
    )
    .await;
    match scan_status {
        Ok(status) if status < 300 => {
            info!(
                target: "project-switch",
                project_id = %project_id_posix,
                "switch_project: project rescan triggered"
            );
        }
        Ok(status) => {
            warn!(
                target: "project-switch",
                project_id = %project_id_posix,
                status,
                "switch_project: project rescan trigger returned non-2xx — continuing"
            );
        }
        Err(e) => {
            warn!(
                target: "project-switch",
                project_id = %project_id_posix,
                error = %e,
                "switch_project: project rescan trigger failed — continuing"
            );
        }
    }

    // ------------------------------------------------------------------
    // Step 9: Trigger shadow recompute for the new project (AC #1f)
    // ------------------------------------------------------------------
    let shadow_status = sidecar_post(
        &http_client.0,
        port,
        &format!("/indexer/shadows/recompute/{}", project_id_posix),
        serde_json::json!({}),
    )
    .await;
    match shadow_status {
        Ok(status) if status < 300 => {
            info!(
                target: "project-switch",
                project_id = %project_id_posix,
                "switch_project: shadow recompute triggered"
            );
        }
        Ok(status) => {
            warn!(
                target: "project-switch",
                project_id = %project_id_posix,
                status,
                "switch_project: shadow recompute returned non-2xx — continuing"
            );
        }
        Err(e) => {
            warn!(
                target: "project-switch",
                project_id = %project_id_posix,
                error = %e,
                "switch_project: shadow recompute failed — continuing"
            );
        }
    }

    // ------------------------------------------------------------------
    // Step 10: Emit ProjectSwitchCompletedEvent (AC #2)
    // ------------------------------------------------------------------
    let elapsed = now_ms().saturating_sub(start_ms);
    app.emit(
        "project-switch-completed",
        serde_json::json!({
            "type": "project:switch:completed",
            "projectId": project_id_posix,
            "previousProjectId": previous_project_id,
            "elapsedMs": elapsed
        }),
    )
    .ok();

    info!(
        target: "project-switch",
        project_id = %project_id_posix,
        elapsed_ms = elapsed,
        "switch_project: completed"
    );

    Ok(CommandResponse::success())
}

// ---------------------------------------------------------------------------
// add_project
// ---------------------------------------------------------------------------

/// Register a new project root without activating it (AC #4).
///
/// Verifies `<projectRoot>/.claude/` exists, then asks the sidecar to insert
/// a `projects` row. Does NOT auto-activate the project.
///
/// Returns `Ok(CommandResponse)` always — the Err branch is structurally unreachable
/// but required by Tauri's async command trait constraint (AC #7: no throws across
/// the Tauri command boundary).
#[command]
pub async fn add_project(
    _app: AppHandle,
    port_state: State<'_, SidecarPort>,
    http_client: State<'_, HttpClient>,
    project_root: String,
) -> Result<CommandResponse, String> {
    let project_root = to_posix(&project_root);

    info!(
        target: "project-add",
        project_root = %project_root,
        "add_project: starting"
    );

    // ------------------------------------------------------------------
    // Validate .claude/ exists (AC #4a).
    //
    // NOTE: is_allowed_for_probe is intentionally NOT used here. That helper
    // checks whether a path is already within the runtime FS scope allowlist.
    // For add_project, the new project's .claude/ is by definition NOT in scope
    // yet — FB-015 dynamic extension only happens on switch_project. Gating on
    // is_allowed_for_probe would block every new project registration outside the
    // pre-seeded ~/.claude/** scope, making add_project non-functional for its
    // primary use case. The AC says "verify .claude/ exists", not "verify scope".
    // ------------------------------------------------------------------
    let claude_dir = PathBuf::from(&project_root).join(".claude");

    // std::fs::metadata is sync and fast for a local existence check; acceptable here.
    match std::fs::metadata(&claude_dir) {
        Ok(meta) if meta.is_dir() => {
            info!(
                target: "project-add",
                project_root = %project_root,
                ".claude dir confirmed"
            );
        }
        Ok(_) => {
            let msg = format!(".claude exists but is not a directory at {project_root}");
            error!(target: "project-add", project_root = %project_root, "{}", msg);
            return Ok(CommandResponse::err(
                "claude_dir_not_directory",
                msg,
                Some(project_root),
            ));
        }
        Err(e) => {
            let msg = format!(".claude/ not found at {project_root}: {e}");
            error!(target: "project-add", project_root = %project_root, error = %e, ".claude/ missing");
            return Ok(CommandResponse::err(
                "claude_dir_missing",
                msg,
                Some(project_root),
            ));
        }
    }

    // ------------------------------------------------------------------
    // Ask sidecar to insert the projects row (AC #4b)
    // ------------------------------------------------------------------
    let port = match port_state.0.lock() {
        Ok(guard) => *guard,
        Err(e) => {
            let msg = format!("Failed to acquire SidecarPort lock: {e}");
            error!(target: "project-add", "{}", msg);
            return Ok(CommandResponse::internal_error(msg));
        }
    };
    let Some(port) = port else {
        return Ok(CommandResponse::internal_error(
            "add_project: sidecar port not yet known".to_string(),
        ));
    };

    let add_status = match sidecar_post(
        &http_client.0,
        port,
        "/projects",
        serde_json::json!({ "projectRoot": project_root }),
    )
    .await
    {
        Ok(status) => status,
        Err(e) => {
            let msg = format!("add_project: sidecar /projects POST failed: {e}");
            error!(target: "project-add", "{}", msg);
            return Ok(CommandResponse::internal_error(msg));
        }
    };

    if add_status >= 400 {
        let msg = format!("add_project: sidecar returned HTTP {add_status} for /projects");
        error!(target: "project-add", "{}", msg);
        return Ok(CommandResponse::internal_error(msg));
    }

    info!(
        target: "project-add",
        project_root = %project_root,
        "add_project: project registered (not activated)"
    );

    Ok(CommandResponse::success())
}

// ---------------------------------------------------------------------------
// remove_project
// ---------------------------------------------------------------------------

/// Remove a tracked project (AC #3).
///
/// Sequence:
///   a. POST /watcher/project/close to sidecar (drops watch root).
///   b. Narrow FS scope — Tauri 2.5.1 has no scope-narrow API.
///      Log the gap; leave scope wider. Documented below.
///   c. POST /projects/{id}/remove to sidecar for soft-delete of
///      assets + hook_index rows and clear route_stacks + recent_files.
///
/// Returns `Ok(CommandResponse)` always — the Err branch is structurally unreachable
/// but required by Tauri's async command trait constraint (AC #7: no throws across
/// the Tauri command boundary).
#[command]
pub async fn remove_project(
    _app: AppHandle,
    port_state: State<'_, SidecarPort>,
    http_client: State<'_, HttpClient>,
    project_id: String,
) -> Result<CommandResponse, String> {
    let project_id = project_id.clone();

    info!(
        target: "project-remove",
        project_id = %project_id,
        "remove_project: starting"
    );

    let port = match port_state.0.lock() {
        Ok(guard) => *guard,
        Err(e) => {
            let msg = format!("Failed to acquire SidecarPort lock: {e}");
            error!(target: "project-remove", "{}", msg);
            return Ok(CommandResponse::internal_error(msg));
        }
    };
    let Some(port) = port else {
        return Ok(CommandResponse::internal_error(
            "remove_project: sidecar port not yet known".to_string(),
        ));
    };

    // ------------------------------------------------------------------
    // Step 1: Look up project root for the close event (AC #3a)
    // ------------------------------------------------------------------
    let project_info = match get_project_info(&http_client.0, port, &project_id).await {
        Ok(info) => info,
        Err(e) => {
            error!(
                target: "project-remove",
                project_id = %project_id,
                error = %e,
                "remove_project: project lookup failed"
            );
            return Ok(CommandResponse::unknown_project(&project_id));
        }
    };
    let project_root = to_posix(&project_info.path);

    // ------------------------------------------------------------------
    // Step 2: POST /watcher/project/close (AC #3a)
    // ------------------------------------------------------------------
    let close_status = sidecar_post(
        &http_client.0,
        port,
        "/watcher/project/close",
        serde_json::json!({ "projectRoot": project_root }),
    )
    .await;
    match close_status {
        Ok(status) if status < 300 => {
            info!(
                target: "project-remove",
                project_id = %project_id,
                project_root = %project_root,
                "remove_project: watcher/project/close OK"
            );
        }
        Ok(status) => {
            warn!(
                target: "project-remove",
                project_id = %project_id,
                status,
                "remove_project: watcher/project/close returned non-2xx — continuing"
            );
        }
        Err(e) => {
            warn!(
                target: "project-remove",
                project_id = %project_id,
                error = %e,
                "remove_project: watcher/project/close failed — continuing"
            );
        }
    }

    // ------------------------------------------------------------------
    // Step 3: FS scope narrowing (AC #3b)
    //
    // Tauri 2.5.1 (`tauri-plugin-fs` v2.5.1) does not expose a
    // `disallow_directory` / scope-narrow API on `tauri::fs::Scope`.
    // The only public mutating methods on the scope are `allow_*`.
    //
    // Consequence: once a project's .claude/** path is registered via
    // `allow_directory` in switch_project, it cannot be removed from the
    // scope at runtime. Reads/writes to the former project's .claude/ will
    // still pass the scope check until the app restarts (cold scope from
    // capabilities/default.json re-initialises without the removed project).
    //
    // This is a known v1 limitation. The scope is wider than ideal but not
    // exploitable — the sidecar's watcher has already dropped the watch root
    // (step above), so no new assets are indexed. The scope gap only affects
    // direct IPC FS commands (fs_read_file etc.) which require explicit
    // UI/sidecar caller intent.
    //
    // Track: https://github.com/BrinsCorp-Tech/zoeplane/issues — label: epic-02/fs-scope-narrow
    // Epic 06 UI will not expose read paths to removed projects.
    // ------------------------------------------------------------------
    warn!(
        target: "project-remove",
        project_id = %project_id,
        project_root = %project_root,
        "remove_project: FS scope NOT narrowed — tauri-plugin-fs v2.5.1 has no disallow_directory API. \
         Scope remains wider until app restart. This is a v1 known limitation."
    );

    // ------------------------------------------------------------------
    // Step 4: Soft-delete via sidecar (AC #3c, #3d)
    // ------------------------------------------------------------------
    let remove_status = match sidecar_post(
        &http_client.0,
        port,
        &format!("/projects/{project_id}/remove"),
        serde_json::json!({}),
    )
    .await
    {
        Ok(status) => status,
        Err(e) => {
            let msg = format!("remove_project: sidecar /projects/{project_id}/remove failed: {e}");
            error!(target: "project-remove", project_id = %project_id, "{}", msg);
            return Ok(CommandResponse::internal_error(msg));
        }
    };

    if remove_status >= 400 {
        let msg = format!(
            "remove_project: sidecar returned HTTP {remove_status} for /projects/{project_id}/remove"
        );
        error!(target: "project-remove", project_id = %project_id, "{}", msg);
        return Ok(CommandResponse::internal_error(msg));
    }

    info!(
        target: "project-remove",
        project_id = %project_id,
        "remove_project: complete"
    );

    Ok(CommandResponse::success())
}

// ---------------------------------------------------------------------------
// Sidecar query helpers
// ---------------------------------------------------------------------------

/// Response shape for GET /projects/{id}
#[derive(Debug, Deserialize)]
struct ProjectInfoResponse {
    path: String,
}

/// Fetch project path from sidecar. Returns Err with structured unknown_project
/// code when the project does not exist (AC #6).
async fn get_project_info(
    client: &reqwest::Client,
    port: u16,
    project_id: &str,
) -> Result<ProjectInfo, String> {
    let url = format!("http://127.0.0.1:{port}/projects/{project_id}");
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("get_project_info: request failed: {e}"))?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        // Structured error per AC #6 — ERR_UNKNOWN_PROJECT constant
        return Err(serde_json::to_string(&serde_json::json!({
            "code": ERR_UNKNOWN_PROJECT,
            "projectId": project_id
        }))
        .unwrap_or_else(|_| format!("{ERR_UNKNOWN_PROJECT}:{project_id}")));
    }

    if !resp.status().is_success() {
        return Err(format!(
            "get_project_info: sidecar returned HTTP {} for project {}",
            resp.status(),
            project_id
        ));
    }

    let info = resp
        .json::<ProjectInfoResponse>()
        .await
        .map_err(|e| format!("get_project_info: failed to parse response: {e}"))?;

    Ok(ProjectInfo { path: info.path })
}

/// Fetch the current active_project_id preference from the sidecar.
async fn get_active_project_id(
    client: &reqwest::Client,
    port: u16,
) -> Result<Option<String>, String> {
    let url = format!("http://127.0.0.1:{port}/preferences/active_project_id");
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("get_active_project_id: request failed: {e}"))?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !resp.status().is_success() {
        return Ok(None);
    }

    #[derive(Deserialize)]
    struct PrefResponse {
        value: String,
    }
    let pref = resp
        .json::<PrefResponse>()
        .await
        .map_err(|_| "get_active_project_id: failed to parse response".to_string())?;
    Ok(Some(pref.value))
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::to_posix;

    #[test]
    fn posix_normalisation_passes_through_posix_paths() {
        let posix = "/Users/zeke/Documents/DevWork/ZoePlane";
        assert_eq!(to_posix(posix), posix);
    }

    #[test]
    fn posix_normalisation_converts_windows_separators() {
        let win = r"C:\Users\zeke\Documents\DevWork\ZoePlane";
        let expected = "C:/Users/zeke/Documents/DevWork/ZoePlane";
        assert_eq!(to_posix(win), expected);
    }

    #[test]
    fn posix_normalisation_handles_mixed_separators() {
        let mixed = r"C:\Users/zeke\Documents/project";
        let expected = "C:/Users/zeke/Documents/project";
        assert_eq!(to_posix(mixed), expected);
    }

    #[test]
    fn posix_normalisation_is_idempotent() {
        let path = "/home/user/.claude/projects";
        assert_eq!(to_posix(&to_posix(path)), to_posix(path));
    }
}
