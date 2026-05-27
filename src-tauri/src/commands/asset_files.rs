// ZoePlane — Asset file write command (Story 6.16 / FR-004)
//
// Writes a skill, agent, or command file to its canonical path under `~/.claude/`.
//
// Security contract:
//   1. POSIX-normalize path at entry (feedback_path_helpers_normalize_posix.md)
//   2. CRLF → LF normalize content at entry (feedback_text_content_crlf_normalize.md)
//   3. Enforce FS runtime scope via is_allowed_for_probe (same as fs.rs)
//   4. Per-kind path-lock: restrict writes to the canonical directory for the given kind
//   5. Reject unknown kind values
//
// Per-kind path-lock table (AC #6):
//   kind="skill"   → ~/.claude/skills/
//   kind="agent"   → ~/.claude/agents/
//   kind="command" → ~/.claude/commands/
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
///   - Path must be under $HOME/.claude/<kind>/
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
        "write_asset_file: requested"
    );

    // 3. Resolve $HOME and build the per-kind canonical root.
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

    // 5. Path-lock check: the resolved path must be under the per-kind canonical root.
    //    Using Path::starts_with (component-based, not string prefix) after canonicalization
    //    to prevent path-traversal bypass via `..` components (AC #6).
    let resolved_canonical = canonicalize_for_probe(&resolved);

    if !resolved_canonical.starts_with(&kind_root_canonical) {
        warn!(
            target: "asset-write",
            kind = kind.label(),
            path = %path,
            root = %kind_root_canonical.display(),
            "write_asset_file: path outside per-kind root — path-lock denied"
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
}
