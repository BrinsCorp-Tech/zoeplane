/**
 * Curated lucide-react icon allowlist for ZoePlane.
 *
 * Adding to the allowlist requires an architectural review — random lucide imports
 * are forbidden so the icon system stays consistent and bundle-size predictable.
 *
 * Families (per docs/design/components/Icon-spec.md §2):
 * - Action: check, x, plus, edit, trash, copy, save, refresh-cw, search, filter, minus
 * - Navigation: chevron-up/down/left/right, arrow-up/down/left/right, menu, home, external-link
 * - File/Data: file, folder, folder-open, file-code, database, list, grid
 * - Status: check-circle, alert-circle, alert-triangle, info, loader-2, shield, play, pause, circle-dot
 * - Domain: terminal, git-branch, network, lock, unlock
 */
export type IconName =
  // Action
  | "check"
  | "x"
  | "plus"
  | "edit"
  | "trash"
  | "copy"
  | "save"
  | "refresh-cw"
  | "search"
  | "filter"
  | "minus"
  // Navigation
  | "chevron-up"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "arrow-up"
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "menu"
  | "home"
  | "external-link"
  | "more-horizontal"
  // File / Data
  | "file"
  | "folder"
  | "folder-open"
  | "file-code"
  | "database"
  | "list"
  | "grid"
  // Status
  | "check-circle"
  | "alert-circle"
  | "alert-triangle"
  | "info"
  | "loader-2"
  | "shield"
  | "play"
  | "pause"
  | "circle-dot"
  | "x-circle"
  // Domain
  | "terminal"
  | "git-branch"
  | "network"
  | "lock"
  | "unlock";
