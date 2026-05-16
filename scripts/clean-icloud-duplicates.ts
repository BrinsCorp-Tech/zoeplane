#!/usr/bin/env bun
//
// clean-icloud-duplicates.ts — remove macOS iCloud Drive conflict copies from
// the cargo build tree before launching `cargo tauri dev` / `cargo tauri build`.
//
// Background
// ----------
// ZoePlane is typically developed under `~/Documents`, which macOS iCloud Drive
// syncs by default.  When cargo writes its target directory mid-sync, iCloud
// occasionally creates "<original> 2.<ext>" sibling files (its conflict
// resolution pattern).  Two of these have proven runtime-poisonous:
//
//   1. `src-tauri/target/debug/migrations/002_asset_index 2.sql`
//      Tauri bundles the sidecar migrations as a resource; the duplicate is
//      copied into the resource mirror.  The sidecar's migration runner has
//      a duplicate-version guard (Story 3.x), so it exits(1) on every clean
//      boot until the duplicate is removed.
//
//   2. `src-tauri/target/debug/libzoeplane_lib 2.{rlib,dylib}`
//      The Rust linker may pick the duplicate over the real artifact and
//      fail with unresolved-symbol errors.
//
// Tauri 2.x's dev-mode resource resolution hard-codes the literal `"target"`
// directory name (see `tauri-utils/src/platform.rs:resource_dir_from`), so
// the cleaner Apple-recommended `.nosync` suffix exclusion cannot be used —
// renaming the cargo target dir breaks Tauri's resource_dir() lookup with
// `UnknownPath`.  Pre-launch cleanup is the workable mitigation.
//
// Behaviour
// ---------
// Walks `src-tauri/target/` and removes any file whose basename matches the
// macOS conflict-copy pattern `<name> N.<ext>` where N is a small integer.
// Reports what was removed.  Exits 0 unconditionally — a clean tree is a
// no-op and missing target/ (first build) is also a no-op.
//
// Wired into the root `tauri` and `tauri:build` npm scripts.

import { readdirSync, statSync, unlinkSync } from "fs";
import { join, basename } from "path";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), "..");
const targetDir = join(repoRoot, "src-tauri", "target");

// macOS iCloud Drive conflict copies always follow the pattern
//   "<original-basename> <n>.<ext>"
// where <n> is a small positive integer (typically 2-6).  Match conservatively
// to avoid deleting any legitimate file that happens to contain a digit.
const CONFLICT_RE = /^(.+) ([2-9]|[1-9]\d)\.[A-Za-z0-9]+$/;

function walkAndClean(dir: string, removed: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // Directory missing (first build, after cargo clean) — nothing to do.
    return;
  }

  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkAndClean(full, removed);
      continue;
    }
    if (CONFLICT_RE.test(basename(entry))) {
      try {
        unlinkSync(full);
        removed.push(full);
      } catch (err) {
        // Permission-denied or in-use is rare here; log and continue.
        console.warn(`[clean-icloud-duplicates] WARN: failed to remove ${full}: ${String(err)}`);
      }
    }
  }
}

const removed: string[] = [];
walkAndClean(targetDir, removed);

if (removed.length === 0) {
  console.log("[clean-icloud-duplicates] no iCloud conflict copies found in src-tauri/target/");
} else {
  console.log(
    `[clean-icloud-duplicates] removed ${removed.length} iCloud conflict cop${removed.length === 1 ? "y" : "ies"}:`,
  );
  for (const f of removed) {
    console.log(`  ${f}`);
  }
}
