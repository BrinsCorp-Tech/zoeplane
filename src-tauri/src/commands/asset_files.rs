// ZoePlane — Asset file write command (Story 6.16 / FR-004, Story 6.18 / FR-011)
//
// Writes a skill, agent, or command file to its canonical path under `~/.claude/`.
//
// Security contract:
//   1. POSIX-normalize path at entry (feedback_path_helpers_normalize_posix.md)
//   2. CRLF → LF normalize content at entry (feedback_text_content_crlf_normalize.md)
//   3. Enforce FS runtime scope via is_allowed_for_probe (same as fs.rs)
//   4. Per-kind path-lock: restrict writes to the canonical directory for the given kind
//      (Story 6.18: when project_root is Some, also accept <project_root>/.claude/<kind>/)
//   5. Reject unknown kind values
//
// Per-kind path-lock table (AC #6 / AC3):
//   kind="skill"   → ~/.claude/skills/  (+ <project_root>/.claude/skills/ if project active)
//   kind="agent"   → ~/.claude/agents/  (+ <project_root>/.claude/agents/ if project active)
//   kind="command" → ~/.claude/commands/ (+ <project_root>/.claude/commands/ if project active)
//
// Returns Ok(CommandResponse) always — never throws across the Tauri command boundary.
//
// NOTE: write_skill_file in skills.rs is deprecated in favour of this command.
// It is retained for one commit and will be removed once confirmed zero call sites.

use std::path::PathBuf;

use serde::Deserialize;
use tauri::{command, Manager};
use tauri_plugin_fs::FsExt;
use tracing::{error, info, warn};

use super::fs::is_allowed_for_probe;
use super::response::CommandResponse;
use super::skills::canonicalize_for_probe;

// ---------------------------------------------------------------------------
// AssetKind
// ---------------------------------------------------------------------------

/// Discriminates the per-kind canonical directory for the path-lock check.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AssetKind {
    Skill,
    Agent,
    Command,
}

impl AssetKind {
    /// Returns the sub-directory under `$HOME/.claude/` for this kind.
    fn subdir(&self) -> &'static str {
        match self {
            AssetKind::Skill => "skills",
            AssetKind::Agent => "agents",
            AssetKind::Command => "commands",
        }
    }

    /// Human-readable label for log messages.
    fn label(&self) -> &'static str {
        match self {
            AssetKind::Skill => "skill",
            AssetKind::Agent => "agent",
            AssetKind::Command => "command",
        }
    }
}

// ---------------------------------------------------------------------------
// Path normalisation helper
// ---------------------------------------------------------------------------

fn to_posix(s: &str) -> String {
    s.replace('\\', "/")
}

// ---------------------------------------------------------------------------
// write_asset_file
// ---------------------------------------------------------------------------

/// Write `content` to the asset file at `path` for the given `kind`.
///
/// Enforcements:
///   - POSIX-normalize path at entry
///   - CRLF → LF normalize content at entry
///   - FS runtime scope check (is_allowed_for_probe)
///   - Path must be under $HOME/.claude/<kind>/ OR (when project_root is Some)
///     under <project_root>/.claude/<kind>/ — dual-root path-lock (Story 6.18 AC3/AC5)
///   - Both roots are canonicalized identically before comparison to prevent
///     symlink-asymmetry (feedback_tauri_scope_canonicalize_asymmetry.md / PR #41)
///   - If the target directory does not exist, create it (AC #7)
///
/// The UI is responsible for serializing the full file content (front-matter +
/// body) before calling this command. This command only performs the disk write.
///
/// Returns `Ok(CommandResponse)` always — all errors are encoded as
/// `CommandResponse::err(...)` to avoid unhandled promise rejections on the
/// JS side (consistent with skills.rs / assets.rs / editor.rs pattern).
#[command]
pub async fn write_asset_file(
    app: tauri::AppHandle,
    kind: AssetKind,
    path: String,
    content: String,
    project_root: Option<String>,
) -> Result<CommandResponse, String> {
    // 1. POSIX-normalize path at entry (feedback_path_helpers_normalize_posix.md)
    let path = to_posix(&path);

    // 2. CRLF → LF normalize content at entry (feedback_text_content_crlf_normalize.md)
    let content = content.replace("\r\n", "\n");

    info!(
        target: "asset-write",
        kind = kind.label(),
        path = %path,
        bytes = content.len(),
        has_project_root = project_root.is_some(),
        "write_asset_file: requested"
    );

    // 3. Resolve $HOME and build the per-kind canonical global root.
    let home_dir = match app.path().home_dir() {
        Ok(h) => h,
        Err(e) => {
            let msg = format!("write_asset_file: failed to resolve home_dir: {e}");
            error!(target: "asset-write", kind = kind.label(), path = %path, "{}", msg);
            return Ok(CommandResponse::internal_error(msg));
        }
    };

    let kind_root = home_dir.join(".claude").join(kind.subdir());
    let resolved = PathBuf::from(&path);

    // 4. Canonicalize kind_root. If the directory doesn't exist yet, create it
    //    first (AC #7) and then canonicalize.
    if !kind_root.exists() {
        info!(
            target: "asset-write",
            kind = kind.label(),
            dir = %kind_root.display(),
            "write_asset_file: creating missing per-kind directory"
        );
        if let Err(e) = std::fs::create_dir_all(&kind_root) {
            let msg = format!(
                "write_asset_file: failed to create {} directory: {e}",
                kind.label()
            );
            error!(target: "asset-write", kind = kind.label(), "{}", msg);
            return Ok(CommandResponse::internal_error(msg));
        }
    }

    let kind_root_canonical = match std::fs::canonicalize(&kind_root) {
        Ok(c) => c,
        Err(e) => {
            let msg = format!(
                "write_asset_file: {} root inaccessible after create_dir_all: {e}",
                kind.label()
            );
            warn!(target: "asset-write", kind = kind.label(), path = %path, "{}", msg);
            return Ok(CommandResponse::scope_denied(&path));
        }
    };

    // 4b. Optionally build and canonicalize the project-scoped kind root.
    //     Story 6.18 AC3: when a project is active, also accept writes under
    //     <project_root>/.claude/<kind>/. Both roots canonicalized identically
    //     to prevent symlink-asymmetry (feedback_tauri_scope_canonicalize_asymmetry.md).
    //
    //     CRITICAL: validate the caller-supplied project_root before using it as
    //     a path-lock root. There is no Tauri-managed registry of known project
    //     roots (the sidecar owns that state over HTTP). Defensive validation
    //     prevents a crafted root (e.g. "/", "/etc", "/usr") from widening the
    //     path-lock to near-root or system-prefix directories.
    //     Rejected if: fewer than 3 path components, starts with a known system
    //     prefix (/etc /usr /bin /sbin /System /Library at root-level /private/etc
    //     /private/var, etc.), or is root itself. A registry-based check (validate
    //     against the sidecar's known-project list) would be stronger — file a
    //     follow-up story when the sidecar exposes a synchronous lookup endpoint.
    let project_kind_root_canonical: Option<PathBuf> = if let Some(ref pr) = project_root {
        // POSIX-normalize the project root path at entry (same rule as `path` above).
        let pr_normalized = to_posix(pr);

        // Defensive validation: reject unsafe root values before any FS operations.
        let pr_path = PathBuf::from(&pr_normalized);
        let component_count = pr_path.components().count();

        // System-prefix check: reject paths whose first two components would land
        // the .claude/ write root inside OS-reserved directories.
        //
        // IMPORTANT: use Path::starts_with (component-aware), NOT str::starts_with.
        // str::starts_with("/Library") matches "/Library-backup/..." — a false
        // positive that would wrongly reject a legitimate project root whose name
        // merely shares a string prefix with a blocked token.  Path::starts_with
        // requires a full component match: "/Library-backup" does NOT start with
        // the Path "/Library", while "/Library/Foo" correctly does.
        let pr_str = pr_normalized.as_str();
        let pr_path_obj = std::path::PathBuf::from(&pr_normalized);
        let is_system_prefix = pr_str == "/"
            || component_count < 3
            || pr_path_obj.starts_with("/etc")
            || pr_path_obj.starts_with("/usr")
            || pr_path_obj.starts_with("/bin")
            || pr_path_obj.starts_with("/sbin")
            || pr_path_obj.starts_with("/System")
            || pr_path_obj.starts_with("/Library")
            || pr_path_obj.starts_with("/private/etc")
            || pr_path_obj.starts_with("/private/var/root")
            || pr_path_obj.starts_with("/private/usr")
            || pr_path_obj.starts_with("/private/bin")
            || pr_path_obj.starts_with("/private/sbin")
            || pr_path_obj.starts_with("C:/Windows")
            || pr_path_obj.starts_with("C:/Program Files")
            || pr_path_obj.starts_with("C:/ProgramData");

        if is_system_prefix {
            warn!(
                target: "asset-write",
                kind = kind.label(),
                project_root = %pr_normalized,
                "write_asset_file: project_root rejected — system-prefix or too-shallow path"
            );
            return Ok(CommandResponse::scope_denied(&path));
        }

        let project_kind_dir = pr_path.join(".claude").join(kind.subdir());

        // Create the project-scoped kind directory if it doesn't exist yet.
        if !project_kind_dir.exists() {
            info!(
                target: "asset-write",
                kind = kind.label(),
                dir = %project_kind_dir.display(),
                "write_asset_file: creating missing project-scoped per-kind directory"
            );
            if let Err(e) = std::fs::create_dir_all(&project_kind_dir) {
                let msg = format!(
                    "write_asset_file: failed to create project {} directory: {e}",
                    kind.label()
                );
                error!(target: "asset-write", kind = kind.label(), "{}", msg);
                return Ok(CommandResponse::internal_error(msg));
            }
        }

        match std::fs::canonicalize(&project_kind_dir) {
            Ok(c) => {
                info!(
                    target: "asset-write",
                    kind = kind.label(),
                    project_root = %pr_normalized,
                    project_kind_root = %c.display(),
                    "write_asset_file: project-scoped kind root resolved"
                );
                Some(c)
            }
            Err(e) => {
                warn!(
                    target: "asset-write",
                    kind = kind.label(),
                    project_root = %pr_normalized,
                    error = %e,
                    "write_asset_file: project-scoped kind root inaccessible — falling back to global-only lock"
                );
                None
            }
        }
    } else {
        None
    };

    // 5. Path-lock check: the resolved path must be under the global per-kind
    //    canonical root OR (when project_root is Some) the project-scoped root.
    //    Using Path::starts_with (component-based, not string prefix) after
    //    canonicalization to prevent path-traversal bypass via `..` (AC #6).
    //
    // INVARIANT: both kind_root and project_kind_dir are create_dir_all-ed above
    // before canonicalization, so the fallback-to-parent branch in
    // canonicalize_for_probe cannot produce a non-canonical path for those roots
    // in normal flow. The resolved (target) path may not exist yet (new file) —
    // only the target path uses the fallback-to-parent branch here.
    let resolved_canonical = canonicalize_for_probe(&resolved);

    let under_global = resolved_canonical.starts_with(&kind_root_canonical);
    let under_project = project_kind_root_canonical
        .as_ref()
        .map(|pr| resolved_canonical.starts_with(pr))
        .unwrap_or(false);

    if !under_global && !under_project {
        warn!(
            target: "asset-write",
            kind = kind.label(),
            path = %path,
            global_root = %kind_root_canonical.display(),
            project_root_present = project_kind_root_canonical.is_some(),
            "write_asset_file: path outside all allowed roots — path-lock denied"
        );
        return Ok(CommandResponse::scope_denied(&path));
    }

    // 6. FS runtime scope check
    let scope = app.fs_scope();
    if !is_allowed_for_probe(&scope, &resolved) {
        warn!(
            target: "asset-write",
            kind = kind.label(),
            path = %path,
            "write_asset_file: path denied by FS runtime scope"
        );
        return Ok(CommandResponse::scope_denied(&path));
    }

    // 7. Write the file
    match std::fs::write(&resolved, content.as_bytes()) {
        Ok(()) => {
            info!(
                target: "asset-write",
                kind = kind.label(),
                path = %path,
                bytes = content.len(),
                "write_asset_file: success"
            );
            Ok(CommandResponse::success())
        }
        Err(e) => {
            let msg = format!("write_asset_file: I/O error writing {path}: {e}");
            error!(
                target: "asset-write",
                kind = kind.label(),
                path = %path,
                error = %e,
                "write_asset_file: I/O error"
            );
            Ok(CommandResponse::internal_error(msg))
        }
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::{to_posix, AssetKind};
    use std::path::PathBuf;

    // Re-use the canonicalize_for_probe helper from skills.rs
    use crate::commands::skills::canonicalize_for_probe;

    // ── POSIX normalisation ───────────────────────────────────────────────────

    #[test]
    fn posix_normalisation_passes_through_posix_paths() {
        let posix = "/Users/zeke/.claude/skills/my-skill/SKILL.md";
        assert_eq!(to_posix(posix), posix);
    }

    #[test]
    fn posix_normalisation_converts_windows_separators() {
        let win = r"C:\Users\zeke\.claude\agents\my-agent.md";
        let expected = "C:/Users/zeke/.claude/agents/my-agent.md";
        assert_eq!(to_posix(win), expected);
    }

    // ── AssetKind subdir mapping ──────────────────────────────────────────────

    #[test]
    fn asset_kind_skill_maps_to_skills_subdir() {
        assert_eq!(AssetKind::Skill.subdir(), "skills");
    }

    #[test]
    fn asset_kind_agent_maps_to_agents_subdir() {
        assert_eq!(AssetKind::Agent.subdir(), "agents");
    }

    #[test]
    fn asset_kind_command_maps_to_commands_subdir() {
        assert_eq!(AssetKind::Command.subdir(), "commands");
    }

    // ── Path-lock guard (per-kind, positive + negative) ───────────────────────
    //
    // We use a real tmpdir so that std::fs::canonicalize resolves symlinks
    // (e.g. macOS /private/tmp alias). Each kind root is a distinct subdirectory.

    fn setup_tmpdir() -> (tempfile::TempDir, PathBuf, PathBuf, PathBuf) {
        let tmp = tempfile::tempdir().expect("tempdir");
        let skills_root = tmp.path().join("skills");
        let agents_root = tmp.path().join("agents");
        let commands_root = tmp.path().join("commands");
        std::fs::create_dir_all(&skills_root).expect("create skills");
        std::fs::create_dir_all(&agents_root).expect("create agents");
        std::fs::create_dir_all(&commands_root).expect("create commands");
        (tmp, skills_root, agents_root, commands_root)
    }

    // ── Skill path-lock ───────────────────────────────────────────────────────

    #[test]
    fn skill_path_under_skills_root_is_accepted() {
        let (_tmp, skills_root, _, _) = setup_tmpdir();
        let root_canonical = std::fs::canonicalize(&skills_root).expect("canonicalize");
        let path = skills_root.join("my-skill").join("SKILL.md");
        std::fs::create_dir_all(path.parent().unwrap()).expect("create parent");
        let path_canonical = canonicalize_for_probe(&path);
        assert!(
            path_canonical.starts_with(&root_canonical),
            "skill path should be accepted: canonical={path_canonical:?}, root={root_canonical:?}"
        );
    }

    #[test]
    fn skill_path_under_agents_root_is_rejected() {
        let (_tmp, skills_root, agents_root, _) = setup_tmpdir();
        let skills_canonical = std::fs::canonicalize(&skills_root).expect("canonicalize skills");
        // A path under agents/ — must be rejected by the skills path-lock
        let path = agents_root.join("my-agent.md");
        let path_canonical = canonicalize_for_probe(&path);
        assert!(
            !path_canonical.starts_with(&skills_canonical),
            "agent path should be rejected by skills lock: canonical={path_canonical:?}, root={skills_canonical:?}"
        );
    }

    // ── Agent path-lock ───────────────────────────────────────────────────────

    #[test]
    fn agent_path_under_agents_root_is_accepted() {
        let (_tmp, _, agents_root, _) = setup_tmpdir();
        let root_canonical = std::fs::canonicalize(&agents_root).expect("canonicalize");
        let path = agents_root.join("my-agent.md");
        let path_canonical = canonicalize_for_probe(&path);
        assert!(
            path_canonical.starts_with(&root_canonical),
            "agent path should be accepted: canonical={path_canonical:?}, root={root_canonical:?}"
        );
    }

    #[test]
    fn agent_path_under_skills_root_is_rejected() {
        let (_tmp, skills_root, agents_root, _) = setup_tmpdir();
        let agents_canonical = std::fs::canonicalize(&agents_root).expect("canonicalize agents");
        // A path under skills/ — must be rejected by the agents path-lock
        let path = skills_root.join("my-skill.md");
        let path_canonical = canonicalize_for_probe(&path);
        assert!(
            !path_canonical.starts_with(&agents_canonical),
            "skill path should be rejected by agents lock: canonical={path_canonical:?}, root={agents_canonical:?}"
        );
    }

    // ── Command path-lock ─────────────────────────────────────────────────────

    #[test]
    fn command_path_under_commands_root_is_accepted() {
        let (_tmp, _, _, commands_root) = setup_tmpdir();
        let root_canonical = std::fs::canonicalize(&commands_root).expect("canonicalize");
        let path = commands_root.join("my-command.md");
        let path_canonical = canonicalize_for_probe(&path);
        assert!(
            path_canonical.starts_with(&root_canonical),
            "command path should be accepted: canonical={path_canonical:?}, root={root_canonical:?}"
        );
    }

    #[test]
    fn command_path_under_agents_root_is_rejected() {
        let (_tmp, _, agents_root, commands_root) = setup_tmpdir();
        let commands_canonical =
            std::fs::canonicalize(&commands_root).expect("canonicalize commands");
        // A path under agents/ — must be rejected by the commands path-lock
        let path = agents_root.join("my-agent.md");
        let path_canonical = canonicalize_for_probe(&path);
        assert!(
            !path_canonical.starts_with(&commands_canonical),
            "agent path should be rejected by commands lock: canonical={path_canonical:?}, root={commands_canonical:?}"
        );
    }

    // ── Cross-kind traversal guard ────────────────────────────────────────────

    #[test]
    fn traversal_path_escaping_skills_root_is_rejected() {
        let (_tmp, skills_root, _, _) = setup_tmpdir();
        let root_canonical = std::fs::canonicalize(&skills_root).expect("canonicalize");
        let traversal = skills_root.join("..").join("..").join("etc").join("passwd");
        let traversal_canonical = canonicalize_for_probe(&traversal);
        assert!(
            !traversal_canonical.starts_with(&root_canonical),
            "traversal path should be rejected: canonical={traversal_canonical:?}, root={root_canonical:?}"
        );
    }

    // ── Story 6.18 AC3/AC5 — project-scoped command path-lock ────────────────
    //
    // Three tests per the brief:
    //   (a) positive: path under <project_root>/.claude/commands/ is ACCEPTED
    //   (b) negative: path outside both global AND project roots is REJECTED
    //   (c) regression: project_root=None still accepts global, rejects non-global

    #[test]
    fn project_scoped_command_path_is_accepted_when_project_root_some() {
        // Build a synthetic project directory in a tempdir.
        let project_tmp = tempfile::tempdir().expect("project tempdir");
        let project_root = project_tmp.path();
        let project_commands_dir = project_root.join(".claude").join("commands");
        std::fs::create_dir_all(&project_commands_dir).expect("create project commands dir");

        // A path under <project_root>/.claude/commands/ — should be ACCEPTED.
        let path = project_commands_dir.join("my-project-command.md");
        let project_root_canonical =
            std::fs::canonicalize(&project_commands_dir).expect("canonicalize project root");
        let path_canonical = canonicalize_for_probe(&path);

        assert!(
            path_canonical.starts_with(&project_root_canonical),
            "project-scoped command path should be accepted: canonical={path_canonical:?}, root={project_root_canonical:?}"
        );
    }

    #[test]
    fn path_outside_both_global_and_project_roots_is_rejected() {
        // Set up a global root and a project root in separate tempdirs.
        let global_tmp = tempfile::tempdir().expect("global tempdir");
        let project_tmp = tempfile::tempdir().expect("project tempdir");
        let outside_tmp = tempfile::tempdir().expect("outside tempdir");

        let global_commands_root = global_tmp.path().join("commands");
        let project_commands_root = project_tmp.path().join(".claude").join("commands");
        std::fs::create_dir_all(&global_commands_root).expect("create global commands");
        std::fs::create_dir_all(&project_commands_root).expect("create project commands");

        let global_canonical =
            std::fs::canonicalize(&global_commands_root).expect("canonicalize global");
        let project_canonical =
            std::fs::canonicalize(&project_commands_root).expect("canonicalize project");

        // A path in a completely separate tempdir — must be outside both roots.
        let outside_path = outside_tmp.path().join("sneaky-command.md");
        let outside_canonical = canonicalize_for_probe(&outside_path);

        let under_global = outside_canonical.starts_with(&global_canonical);
        let under_project = outside_canonical.starts_with(&project_canonical);

        assert!(
            !under_global && !under_project,
            "path outside both roots must be rejected: canonical={outside_canonical:?}"
        );
    }

    // ── Story 6.18 CRITICAL-1 — unsafe project_root is REJECTED before FS ops ──
    //
    // project_root="/" and system-prefix paths must be rejected by the defensive
    // validation gate BEFORE create_dir_all is called. These tests mirror the
    // is_system_prefix logic in write_asset_file to verify the guard is present.
    // (Full command invocation cannot be unit-tested without a live AppHandle;
    //  the logic is extracted and tested inline here.)

    /// Returns true when the project_root string would be rejected by the
    /// is_system_prefix guard in write_asset_file (mirrors the production check).
    ///
    /// Uses Path::starts_with (component-aware) to match the production fix —
    /// str::starts_with("/Library") would be a false positive for "/Library-backup/...".
    fn is_system_prefix_rejected(pr_normalized: &str) -> bool {
        let pr_path_obj = std::path::PathBuf::from(pr_normalized);
        let component_count = pr_path_obj.components().count();
        pr_normalized == "/"
            || component_count < 3
            || pr_path_obj.starts_with("/etc")
            || pr_path_obj.starts_with("/usr")
            || pr_path_obj.starts_with("/bin")
            || pr_path_obj.starts_with("/sbin")
            || pr_path_obj.starts_with("/System")
            || pr_path_obj.starts_with("/Library")
            || pr_path_obj.starts_with("/private/etc")
            || pr_path_obj.starts_with("/private/var/root")
            || pr_path_obj.starts_with("/private/usr")
            || pr_path_obj.starts_with("/private/bin")
            || pr_path_obj.starts_with("/private/sbin")
            || pr_path_obj.starts_with("C:/Windows")
            || pr_path_obj.starts_with("C:/Program Files")
            || pr_path_obj.starts_with("C:/ProgramData")
    }

    #[test]
    fn project_root_slash_is_rejected_by_system_prefix_guard() {
        assert!(
            is_system_prefix_rejected("/"),
            "project_root='/' must be rejected — would widen lock to near-root"
        );
    }

    #[test]
    fn project_root_etc_is_rejected_by_system_prefix_guard() {
        assert!(
            is_system_prefix_rejected("/etc"),
            "project_root='/etc' must be rejected — system-prefix"
        );
    }

    #[test]
    fn project_root_too_shallow_single_component_is_rejected() {
        // '/tmp' has 2 components (/ + tmp); fewer than 3 → rejected.
        assert!(
            is_system_prefix_rejected("/tmp"),
            "project_root='/tmp' must be rejected — too shallow (< 3 components)"
        );
    }

    #[test]
    fn project_root_deep_user_path_is_accepted() {
        // A normal user project path like /Users/zeke/Projects/myapp has 4+ components
        // and no system prefix — should be accepted by the guard.
        assert!(
            !is_system_prefix_rejected("/Users/zeke/Projects/myapp"),
            "project_root='/Users/zeke/Projects/myapp' must NOT be rejected — valid user path"
        );
    }

    #[test]
    fn project_root_windows_system_prefix_is_rejected() {
        assert!(
            is_system_prefix_rejected("C:/Windows"),
            "project_root='C:/Windows' must be rejected — Windows system prefix"
        );
    }

    // ── Story 6.18 CRITICAL-1 — false-positive regression (str vs Path prefix) ──
    //
    // str::starts_with("/Library") would incorrectly reject "/Library-backup/me/myproject"
    // because the string shares a prefix with the blocked token.  Path::starts_with
    // is component-aware: "/Library-backup" is a distinct component and does NOT
    // match "/Library", so the path must be ACCEPTED.
    //
    // Symmetry check: "/Library/Frameworks/myproject" MUST still be rejected —
    // confirming the guard still blocks the actual system directory.

    #[test]
    fn project_root_library_backup_dir_is_accepted_not_falsely_rejected() {
        // "/Library-backup/me/myproject" — 4 components, not a system prefix.
        // str::starts_with would return true (false positive); Path::starts_with must return false.
        assert!(
            !is_system_prefix_rejected("/Library-backup/me/myproject"),
            "project_root='/Library-backup/me/myproject' must NOT be rejected — \
             '/Library-backup' is not the '/Library' path component"
        );
    }

    #[test]
    fn project_root_usr_local_dir_is_accepted_not_falsely_rejected() {
        // "/usr-local-data/dev/myproject" — shares "/usr" string prefix but is a distinct component.
        assert!(
            !is_system_prefix_rejected("/usr-local-data/dev/myproject"),
            "project_root='/usr-local-data/dev/myproject' must NOT be rejected — \
             '/usr-local-data' is not the '/usr' path component"
        );
    }

    #[test]
    fn project_root_actual_library_subpath_is_still_rejected() {
        // Symmetry: "/Library/Frameworks/myproject" must still be rejected (real system dir).
        assert!(
            is_system_prefix_rejected("/Library/Frameworks/myproject"),
            "project_root='/Library/Frameworks/myproject' must be rejected — under real /Library"
        );
    }

    #[test]
    fn global_command_path_accepted_and_non_global_rejected_when_project_root_none() {
        // Regression: project_root=None must preserve the original single-root behavior.
        let (_tmp, _, _, commands_root) = setup_tmpdir();
        let root_canonical = std::fs::canonicalize(&commands_root).expect("canonicalize");

        // Positive: path under global commands root — accepted.
        let path_in = commands_root.join("my-command.md");
        let path_in_canonical = canonicalize_for_probe(&path_in);
        assert!(
            path_in_canonical.starts_with(&root_canonical),
            "global command path should be accepted (project_root=None): canonical={path_in_canonical:?}, root={root_canonical:?}"
        );

        // Negative: path outside global root — rejected (no project root to fall back to).
        let outside = tempfile::tempdir().expect("outside tempdir");
        let path_out = outside.path().join("escape.md");
        let path_out_canonical = canonicalize_for_probe(&path_out);
        // With project_root=None, under_project is always false.
        let under_global = path_out_canonical.starts_with(&root_canonical);
        assert!(
            !under_global,
            "non-global path should be rejected when project_root=None: canonical={path_out_canonical:?}"
        );
    }
}
