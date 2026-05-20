/** @see docs/design/components/Icon-spec.md */
import * as React from "react";
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Clock,
  Copy,
  Database,
  Edit,
  ExternalLink,
  File,
  FileCode,
  Filter,
  Folder,
  FolderOpen,
  GitBranch,
  Grid,
  Home,
  Info,
  Link,
  List,
  Loader2,
  Lock,
  Menu,
  Minus,
  MoreHorizontal,
  Network,
  Pause,
  Play,
  Plus,
  Power,
  RefreshCw,
  Save,
  Search,
  Shield,
  Terminal,
  Trash,
  Unlock,
  X,
  XCircle,
  XOctagon,
  type LucideProps,
} from "lucide-react";
import type { IconName } from "@zoeplane/shared-types";

// ─── Size scale (Icon-spec §6) ─────────────────────────────────────────────

const SIZE_MAP = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export type IconSize = keyof typeof SIZE_MAP;

// ─── Static icon map (IconName → lucide component) ────────────────────────
// Static map is preferred over dynamic import for bundle-tree-shaking predictability
// and compile-time type safety. Only allowlisted icons are included.

const ICON_MAP: Record<IconName, React.ComponentType<LucideProps>> = {
  // Action
  check: Check,
  x: X,
  plus: Plus,
  edit: Edit,
  trash: Trash,
  copy: Copy,
  save: Save,
  "refresh-cw": RefreshCw,
  search: Search,
  filter: Filter,
  minus: Minus,
  // Navigation
  "chevron-up": ChevronUp,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "arrow-up": ArrowUp,
  "arrow-down": ArrowDown,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  menu: Menu,
  home: Home,
  "external-link": ExternalLink,
  "more-horizontal": MoreHorizontal,
  // File / Data
  file: File,
  folder: Folder,
  "folder-open": FolderOpen,
  "file-code": FileCode,
  database: Database,
  list: List,
  grid: Grid,
  // Status
  "check-circle": CheckCircle,
  "alert-circle": AlertCircle,
  "alert-triangle": AlertTriangle,
  info: Info,
  "loader-2": Loader2,
  shield: Shield,
  play: Play,
  pause: Pause,
  "circle-dot": CircleDot,
  "x-circle": XCircle,
  // Status — EvaluatorStatusBadge additions (Story 2.7, operator-approved 2026-05-13)
  clock: Clock, // evaluator-status "pending review"; validity-only "pending"
  "x-octagon": XOctagon, // "declined" — semantic-stronger than x-circle
  "alert-octagon": AlertOctagon, // SkillCard degraded state body icon (Story 6.3)
  power: Power, // hook "disabled by you" (user-toggled off)
  link: Link, // SkillCard plugin provenance chip icon (Story 6.3)
  // Domain
  terminal: Terminal,
  "git-branch": GitBranch,
  network: Network,
  lock: Lock,
  unlock: Unlock,
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface IconProps extends Omit<LucideProps, "size"> {
  /** The curated icon name. Adding to this list requires an architectural review. */
  name: IconName;
  /** Size from the 5-step scale: xs (12), sm (16), md (20), lg (24), xl (32). Default: sm. */
  size?: IconSize;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Icon — typed lucide-react wrapper.
 *
 * - Defaults to `aria-hidden="true"` (decorative). Pass `aria-label` to make it
 *   meaningful; this drops aria-hidden so screen readers announce it.
 * - Color inherits from parent via `currentColor` — no per-icon color props needed.
 * - Stroke width is always 2 (lucide default). Not exposed as a prop.
 *
 * @see docs/design/components/Icon-spec.md
 */
const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ name, size = "sm", "aria-label": ariaLabel, ...props }, ref) => {
    const LucideIcon = ICON_MAP[name];
    const px = SIZE_MAP[size];

    if (!LucideIcon) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[Icon] "${name}" is not in the ZoePlane icon allowlist.`);
      }
      return null;
    }

    // When aria-label is provided the icon carries meaning — drop aria-hidden.
    // When omitted, icon is decorative — aria-hidden="true" is the safe default.
    const a11yProps = ariaLabel
      ? { "aria-label": ariaLabel, "aria-hidden": undefined }
      : { "aria-hidden": true as const };

    return (
      <LucideIcon ref={ref} width={px} height={px} strokeWidth={2} {...a11yProps} {...props} />
    );
  },
);

Icon.displayName = "Icon";

export { Icon };
