// ZoePlane — Skill file write command (Story 6.4 / FR-004)
//
// Writes a skill file to its canonical path under `~/.claude/skills/`.
//
// Security contract:
//   1. POSIX-normalize path at entry (feedback_path_helpers_normalize_posix.md)
//   2. CRLF → LF normalize content at entry (feedback_text_content_crlf_normalize.md)
//   3. Enforce FS runtime scope via is_allowed_for_probe (same as fs.rs)
//   4. Restrict writes to paths under ~/.claude/skills/
//
// Returns Ok(CommandResponse) always — never throws across the Tauri command boundary.

use std::path::PathBuf;

use tauri::{command, Manager};
use tauri_plugin_fs::FsExt;
use tracing::{error, info, warn};

use super::fs::is_allowed_for_probe;
use super::response::CommandResponse;

// ---------------------------------------------------------------------------
// Path normalisation helper
// ---------------------------------------------------------------------------

fn to_posix(s: &str) -> String {
    s.replace('\\', "/")
}

// ---------------------------------------------------------------------------
// Canonicalize-for-probe helper
// ---------------------------------------------------------------------------

/// Canonicalize `path` for the skills-root guard check.
///
/// For existing paths, delegates to `std::fs::canonicalize`. For paths that
/// don't exist yet (new skill files), falls back to canonicalizing the parent
/// directory and re-appending the filename — the same ancestor-probe pattern
/// used in `fs.rs::is_allowed_for_probe`.
///
/// Returns the best-effort canonical path. If no ancestor can be resolved,
/// returns the input path unchanged (the `starts_with` check will then deny
/// it as a conservative fallback).
pub(crate) fn canonicalize_for_probe(path: &std::path::Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| {
        path.parent()
            .and_then(|parent| std::fs::canonicalize(parent).ok())
            .and_then(|parent_canonical| path.file_name().map(|fname| parent_canonical.join(fname)))
            .unwrap_or_else(|| path.to_path_buf())
    })
}

// ---------------------------------------------------------------------------
// write_skill_file
// ---------------------------------------------------------------------------

/// Write `content` to the skill file at `path`.
///
/// Enforcements:
///   - POSIX-normalize path at entry
///   - CRLF → LF normalize content at entry
///   - FS runtime scope check (is_allowed_for_probe)
///   - Path must be under $HOME/.claude/skills/
///
/// The UI is responsible for serializing the full file content (front-matter +
/// body) before calling this command. This command only performs the disk write.
///
/// Returns `Ok(CommandResponse)` always — all errors are encoded as
/// `CommandResponse::err(...)` to avoid unhandled promise rejections on the
/// JS side (AC #7 pattern, consistent with editor.rs / assets.rs).
#[command]
pub async fn write_skill_file(
    app: tauri::AppHandle,
    path: String,
    content: String,
) -> Result<CommandResponse, String> {
    // 1. POSIX-normalize path at entry (feedback_path_helpers_normalize_posix.md)
    let path = to_posix(&path);

    // 2. CRLF → LF normalize content at entry (feedback_text_content_crlf_normalize.md)
    let content = content.replace("\r\n", "\n");

    info!(
        target: "skill-write",
        path = %path,
        bytes = content.len(),
        "write_skill_file: requested"
    );

    // 3. Verify path is under ~/.claude/skills/ using canonicalized Path::starts_with.
    //    String starts_with is bypassable via path-traversal components (e.g. `/../`).
    //    Path::starts_with operates on path components after canonicalization, making
    //    traversal sequences ineffective.
    let home_dir = match app.path().home_dir() {
        Ok(h) => h,
        Err(e) => {
            let msg = format!("write_skill_file: failed to resolve home_dir: {e}");
            error!(target: "skill-write", path = %path, "{}", msg);
            return Ok(CommandResponse::internal_error(msg));
        }
    };
    let skills_root = home_dir.join(".claude").join("skills");
    let resolved = PathBuf::from(&path);

    // Canonicalize skills_root (it must exist; if not, deny all writes).
    let skills_root_canonical = match std::fs::canonicalize(&skills_root) {
        Ok(c) => c,
        Err(e) => {
            let msg =
                format!("write_skill_file: skills root does not exist or is inaccessible: {e}");
            warn!(target: "skill-write", path = %path, "{}", msg);
            return Ok(CommandResponse::scope_denied(&path));
        }
    };

    // Canonicalize the resolved path via the shared helper (handles nonexistent files
    // by canonicalizing the parent and re-appending the filename).
    let resolved_canonical = canonicalize_for_probe(&resolved);

    if !resolved_canonical.starts_with(&skills_root_canonical) {
        warn!(target: "skill-write", path = %path, "path outside skills root — denied");
        return Ok(CommandResponse::scope_denied(&path));
    }

    // 4. FS runtime scope check
    let scope = app.fs_scope();
    if !is_allowed_for_probe(&scope, &resolved) {
        warn!(
            target: "skill-write",
            path = %path,
            "write_skill_file: path denied by FS runtime scope"
        );
        return Ok(CommandResponse::scope_denied(&path));
    }

    // 5. Write the file
    match std::fs::write(&resolved, content.as_bytes()) {
        Ok(()) => {
            info!(
                target: "skill-write",
                path = %path,
                bytes = content.len(),
                "write_skill_file: success"
            );
            Ok(CommandResponse::success())
        }
        Err(e) => {
            let msg = format!("write_skill_file: I/O error writing {path}: {e}");
            error!(
                target: "skill-write",
                path = %path,
                error = %e,
                "write_skill_file: I/O error"
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
    use super::{canonicalize_for_probe, to_posix};
    use std::path::PathBuf;

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

    // ── Path-traversal guard (Medium Issue 4) ─────────────────────────────────
    //
    // These tests exercise `canonicalize_for_probe` + `Path::starts_with` to
    // verify that traversal components (`..`) cannot escape the skills root.
    //
    // We use a real tmpdir so that `std::fs::canonicalize` resolves symlinks
    // (e.g. macOS /private/tmp alias). The skills root is `<tmpdir>/skills/`
    // and we assert that paths with traversal sequences are rejected.

    /// Build a temporary directory tree:
    ///   <tmp>/skills/
    ///   <tmp>/skills/sub/
    /// Returns the root tmpdir path and the skills root PathBuf.
    fn setup_tmpdir() -> (tempfile::TempDir, PathBuf) {
        let tmp = tempfile::tempdir().expect("tempdir");
        let skills_root = tmp.path().join("skills");
        std::fs::create_dir_all(skills_root.join("sub")).expect("create skills/sub");
        (tmp, skills_root)
    }

    #[test]
    fn traversal_path_is_rejected_by_starts_with() {
        let (_tmp, skills_root) = setup_tmpdir();

        // skills_root is real on disk — canonicalize succeeds
        let skills_root_canonical =
            std::fs::canonicalize(&skills_root).expect("canonicalize skills_root");

        // Traversal: `<skills_root>/../../../etc/passwd` — after canonicalization
        // this resolves to `/etc/passwd` (or tmpdir-relative equivalent), which
        // does NOT start with skills_root_canonical.
        let traversal = skills_root.join("..").join("..").join("etc").join("passwd");
        let traversal_canonical = canonicalize_for_probe(&traversal);

        assert!(
            !traversal_canonical.starts_with(&skills_root_canonical),
            "traversal path should be rejected: canonical={traversal_canonical:?}, root={skills_root_canonical:?}"
        );
    }

    #[test]
    fn normal_skill_path_is_accepted_by_starts_with() {
        let (_tmp, skills_root) = setup_tmpdir();

        let skills_root_canonical =
            std::fs::canonicalize(&skills_root).expect("canonicalize skills_root");

        // A normal skill path under skills/sub/ (directory exists)
        let normal = skills_root.join("sub").join("my-skill.md");
        let normal_canonical = canonicalize_for_probe(&normal);

        assert!(
            normal_canonical.starts_with(&skills_root_canonical),
            "normal skill path should be accepted: canonical={normal_canonical:?}, root={skills_root_canonical:?}"
        );
    }

    #[test]
    fn new_skill_file_path_accepted_when_parent_exists() {
        let (_tmp, skills_root) = setup_tmpdir();

        let skills_root_canonical =
            std::fs::canonicalize(&skills_root).expect("canonicalize skills_root");

        // File doesn't exist yet, but parent directory does
        let new_file = skills_root.join("new-skill-not-yet-created.md");
        assert!(!new_file.exists(), "precondition: file must not exist");

        let new_canonical = canonicalize_for_probe(&new_file);

        assert!(
            new_canonical.starts_with(&skills_root_canonical),
            "new file path should be accepted when parent is in scope: canonical={new_canonical:?}, root={skills_root_canonical:?}"
        );
    }
}
