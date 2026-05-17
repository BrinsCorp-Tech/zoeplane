#!/usr/bin/env bun
//
// clean-icloud-duplicates.ts — smoke-only iCloud Drive conflict-copy cleaner.
//
// AUDIENCE
// --------
// Internal/operator-only tool. NOT user-facing. NOT wired into any
// package.json script. NOT mentioned in CONTRIBUTING.md or README.md.
// OSS contributors building from source see a standard Tauri dev flow
// without macOS-iCloud-specific cleanup running on every build.
//
// USAGE
// -----
//   bun run scripts/clean-icloud-duplicates.ts              # remove conflict copies
//   bun run scripts/clean-icloud-duplicates.ts --dry-run    # preview, no changes, exit 0
//   bun run scripts/clean-icloud-duplicates.ts --check      # scan only, exit 1 if found
//   bun run scripts/clean-icloud-duplicates.ts --verbose    # also log pruned paths
//
// Pair with scripts/clean-state.sh during smoke tests:
//   1. bun run scripts/clean-icloud-duplicates.ts   (repair source tree)
//   2. bash  scripts/clean-state.sh                 (wipe app state)
//   3. bun run tauri                                (fresh-install smoke)
//
// BACKGROUND
// ----------
// ZoePlane is typically developed under `~/Documents`, which macOS iCloud
// Drive syncs by default. When cargo or bun writes a build tree mid-sync,
// iCloud creates `<original> N.<ext>` conflict copies (file pattern) and
// occasionally whole-directory `<original> N` siblings. Documented offenders:
//
//   1. `src-tauri/target/debug/migrations/002_asset_index 2.sql`
//      Tauri bundles sidecar migrations as a resource; the duplicate is
//      copied into the resource mirror. The sidecar migration runner has
//      a duplicate-version guard, so it exits(1) on every clean boot.
//
//   2. `src-tauri/target 2/`
//      Whole-directory conflict copy. Disk-space waste; can confuse `cargo
//      clean` and IDE indexers. Observed 2026-05-17.
//
// Tauri 2.x dev-mode resource resolution hard-codes the literal directory
// name `"target"` (tauri-utils/src/platform.rs:resource_dir_from), so the
// Apple-recommended `.nosync` suffix exclusion is NOT workable — renaming
// the cargo target dir breaks `resource_dir()` lookup with `UnknownPath`.
// On-demand cleanup is the workable mitigation.
//
// DETECTION
// ---------
// File conflict:      `<name> N.<ext>` where N is 2..99.
// Directory conflict: `<name> N`       where N is 2..99 AND a sibling
//                     `<name>` directory exists in the same parent.
//                     The sibling-check eliminates false positives like a
//                     legitimately-named `Sprint 2` folder.
//
// Excluded from walk: `.git/`, `node_modules/` (at any depth).
//

import { readdirSync, statSync, lstatSync, unlinkSync, rmSync } from "fs";
import { join, basename, relative, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), "..");

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const CHECK = args.has("--check");
const VERBOSE = args.has("--verbose");

if (DRY_RUN && CHECK) {
  console.error("[clean-icloud-duplicates] --dry-run and --check are mutually exclusive");
  process.exit(2);
}

const FILE_RE = /^(.+) ([2-9]|[1-9]\d)\.[A-Za-z0-9]+$/;
const DIR_RE = /^(.+) ([2-9]|[1-9]\d)$/;
const PRUNE_DIRS = new Set([".git", "node_modules", ".bun-cache"]);

type Finding = { kind: "file" | "dir"; path: string; original?: string };
const findings: Finding[] = [];

function rel(p: string): string {
  return relative(repoRoot, p) || ".";
}

function siblingDirExists(parent: string, originalName: string): boolean {
  try {
    return statSync(join(parent, originalName)).isDirectory();
  } catch {
    return false;
  }
}

function walk(dir: string): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    // Name-based prune saves a stat on huge node_modules trees.
    if (PRUNE_DIRS.has(entry)) {
      if (VERBOSE) console.log(`  prune: ${rel(join(dir, entry))}/`);
      continue;
    }

    const full = join(dir, entry);
    let lst;
    try {
      lst = lstatSync(full);
    } catch {
      continue;
    }

    // Symlinks: classify by name pattern; never descend. A broken symlink
    // named like a conflict copy (e.g. `target 2 -> target.nosync`) is itself
    // iCloud detritus from a failed workaround and should be removed.
    if (lst.isSymbolicLink()) {
      const dirMatch = entry.match(DIR_RE);
      if (dirMatch && siblingDirExists(dir, dirMatch[1])) {
        findings.push({ kind: "dir", path: full, original: join(dir, dirMatch[1]) });
        continue;
      }
      if (FILE_RE.test(basename(entry))) {
        findings.push({ kind: "file", path: full });
      }
      continue;
    }

    if (lst.isDirectory()) {
      const m = entry.match(DIR_RE);
      if (m && siblingDirExists(dir, m[1])) {
        findings.push({ kind: "dir", path: full, original: join(dir, m[1]) });
        // Don't descend — whole directory will be removed.
        continue;
      }
      walk(full);
      continue;
    }

    if (lst.isFile() && FILE_RE.test(basename(entry))) {
      findings.push({ kind: "file", path: full });
    }
  }
}

const mode = CHECK ? "CHECK" : DRY_RUN ? "DRY-RUN" : "scanning";
console.log(`[clean-icloud-duplicates] ${mode} from ${rel(repoRoot) || "."}`);
walk(repoRoot);

const dirCount = findings.filter((f) => f.kind === "dir").length;
const fileCount = findings.filter((f) => f.kind === "file").length;
const dirWord = (n: number) => `${n} director${n === 1 ? "y" : "ies"}`;
const fileWord = (n: number) => `${n} file${n === 1 ? "" : "s"}`;

if (findings.length === 0) {
  console.log("[clean-icloud-duplicates] no iCloud conflict artifacts found.");
  process.exit(0);
}

if (CHECK) {
  console.log(`[clean-icloud-duplicates] FOUND ${dirWord(dirCount)}, ${fileWord(fileCount)}:`);
  for (const f of findings) {
    if (f.kind === "dir") {
      console.log(`  DIR   ${rel(f.path)}/   (sibling of ${rel(f.original!)}/)`);
    } else {
      console.log(`  FILE  ${rel(f.path)}`);
    }
  }
  console.log("[clean-icloud-duplicates] FAIL — iCloud duplicates present; run without --check to remove.");
  process.exit(1);
}

const verb = DRY_RUN ? "would remove" : "removed";
console.log(`[clean-icloud-duplicates] ${verb} ${dirWord(dirCount)}, ${fileWord(fileCount)}:`);

for (const f of findings) {
  const label = f.kind === "dir" ? "DIR " : "FILE";
  const display = `${rel(f.path)}${f.kind === "dir" ? "/" : ""}`;
  if (DRY_RUN) {
    console.log(`  [dry-run] ${label} ${display}`);
    continue;
  }
  try {
    if (f.kind === "dir") {
      rmSync(f.path, { recursive: true, force: true });
    } else {
      unlinkSync(f.path);
    }
    console.log(`  ${label} ${display}`);
  } catch (err) {
    console.warn(`  WARN failed to remove ${display}: ${String(err)}`);
  }
}

if (DRY_RUN) {
  console.log("[clean-icloud-duplicates] dry-run complete — no files removed.");
}
