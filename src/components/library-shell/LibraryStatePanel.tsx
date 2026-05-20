/**
 * LibraryStatePanel — shared empty-state and error-state primitives for all
 * library views (Agents, Skills, Commands, and future resource types).
 *
 * Exports two parallel components:
 *   - LibraryEmptyPanel  — "nothing here yet" + open-in-finder + learn-more link
 *   - LibraryErrorPanel  — "fetch failed" + retry + reveal-in-finder
 *
 * Both carry the richer skill-library behavior: revealError React.useState hook,
 * inline role="alert" aria-live error display, and dev-mode-gated console.error
 * logging. Agent variants converge up to this richer standard (Story 6.13 AC #6).
 *
 * Internal hook:
 *   useRevealAction(dirSegments, errorMessage) — shared reveal-in-finder state
 *   machine; returns { revealError, handleReveal } consumed by both primitives.
 *
 * Story: 6.13 — Library empty/error state extraction
 */

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { homeDir, join } from "@tauri-apps/api/path";
import type { IconName } from "@zoeplane/shared-types";
import { Icon } from "@/components/ui/Icon/Icon";
import { Button } from "@/components/ui/Button/Button";

// ─── Internal hook ────────────────────────────────────────────────────────────

/**
 * useRevealAction — encapsulates the reveal_in_finder state machine shared by
 * both LibraryEmptyPanel and LibraryErrorPanel.
 *
 * @param dirSegments  Path segments appended to homeDir() — e.g. [".claude", "agents"]
 * @param errorMessage Inline error copy shown to the user when the invoke fails
 * @param logTag       Caller-scoped tag used in DEV console.error — e.g. "[LibraryEmptyPanel]"
 */
function useRevealAction(
  dirSegments: string[],
  errorMessage: string,
  logTag: string,
): { revealError: string | null; handleReveal: () => void } {
  const [revealError, setRevealError] = React.useState<string | null>(null);

  const handleReveal = () => {
    setRevealError(null);
    void (async () => {
      try {
        const home = await homeDir();
        const targetPath = await join(home, ...dirSegments);
        await invoke("reveal_in_finder", { path: targetPath });
      } catch (err: unknown) {
        if (import.meta.env.DEV) {
          console.error(`${logTag} reveal_in_finder failed:`, err);
        }
        setRevealError(errorMessage);
      }
    })();
  };

  return { revealError, handleReveal };
}

// ─── LibraryEmptyPanel ────────────────────────────────────────────────────────

export interface LibraryEmptyPanelProps {
  /** Lucide icon name — e.g. "folder-open" */
  icon: IconName;
  /** Tailwind arbitrary color class — e.g. "[color:var(--color-foreground-subtle)]" */
  iconColor: string;
  /** h2 heading text */
  heading: string;
  /** Body copy — supports React nodes for inline <code> interpolation */
  body: React.ReactNode;
  /** aria-label for the wrapping div */
  ariaLabel: string;
  /** Finder button label */
  primaryActionLabel: string;
  /**
   * Path segments passed to homeDir() + join() — e.g. [".claude", "agents"].
   * The primitive resolves the full absolute path before invoking reveal_in_finder.
   */
  revealDirSegments: string[];
  /** Inline error copy displayed when reveal_in_finder rejects */
  revealErrorMessage: string;
  /** Anthropic docs URL opened in a new tab */
  learnMoreUrl: string;
  /** Learn-more anchor visible label */
  learnMoreLabel: string;
}

export function LibraryEmptyPanel({
  icon,
  iconColor,
  heading,
  body,
  ariaLabel,
  primaryActionLabel,
  revealDirSegments,
  revealErrorMessage,
  learnMoreUrl,
  learnMoreLabel,
}: LibraryEmptyPanelProps): React.JSX.Element {
  const { revealError, handleReveal } = useRevealAction(
    revealDirSegments,
    revealErrorMessage,
    "[LibraryEmptyPanel]",
  );

  return (
    <div
      className="mx-auto flex max-w-[40ch] flex-col items-center justify-center gap-4 py-12 text-center"
      aria-label={ariaLabel}
    >
      {/* Icon */}
      <Icon name={icon} size="lg" className={iconColor} aria-hidden />

      {/* Heading */}
      <h2 className="text-lg font-semibold [color:var(--color-foreground)]">{heading}</h2>

      {/* Body copy */}
      <p className="text-sm leading-relaxed [color:var(--color-foreground-muted)]">{body}</p>

      {/* Actions */}
      <div className="flex w-full flex-col gap-2">
        <Button variant="secondary" size="sm" onClick={handleReveal} className="w-full">
          {primaryActionLabel}
        </Button>

        {/* Inline error — appears when reveal_in_finder rejects */}
        {revealError !== null && (
          <p role="alert" aria-live="polite" className="text-xs [color:var(--color-danger)]">
            {revealError}
          </p>
        )}

        <a
          href={learnMoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 w-full items-center justify-center rounded-md px-3 text-xs font-medium [color:var(--color-foreground)] hover:[background-color:var(--color-hover-overlay)]"
        >
          {learnMoreLabel}
        </a>
      </div>
    </div>
  );
}

// ─── LibraryErrorPanel ────────────────────────────────────────────────────────

export interface LibraryErrorPanelProps {
  /** Lucide icon name — e.g. "alert-circle" */
  icon: IconName;
  /** Tailwind arbitrary color class — e.g. "[color:var(--color-danger)]" */
  iconColor: string;
  /** h2 heading text */
  heading: string;
  /** Body copy — supports React nodes for inline interpolation */
  body: React.ReactNode;
  /** aria-label for the wrapping div */
  ariaLabel: string;
  /** TanStack Query refetch function — called on Retry click */
  onRetry: () => void;
  /**
   * Path segments passed to homeDir() + join() — e.g. [".claude", "agents"].
   * The primitive resolves the full absolute path before invoking reveal_in_finder.
   */
  revealDirSegments: string[];
  /** Inline error copy displayed when reveal_in_finder rejects */
  revealErrorMessage: string;
}

export function LibraryErrorPanel({
  icon,
  iconColor,
  heading,
  body,
  ariaLabel,
  onRetry,
  revealDirSegments,
  revealErrorMessage,
}: LibraryErrorPanelProps): React.JSX.Element {
  const { revealError, handleReveal } = useRevealAction(
    revealDirSegments,
    revealErrorMessage,
    "[LibraryErrorPanel]",
  );

  return (
    <div
      className="mx-auto flex max-w-[40ch] flex-col items-center justify-center gap-4 py-12 text-center"
      aria-label={ariaLabel}
    >
      {/* Icon */}
      <Icon name={icon} size="lg" className={iconColor} aria-hidden />

      {/* Heading */}
      <h2 className="text-lg font-semibold [color:var(--color-foreground)]">{heading}</h2>

      {/* Body copy */}
      <p className="text-sm leading-relaxed [color:var(--color-foreground-muted)]">{body}</p>

      {/* Actions */}
      <div className="flex w-full flex-col gap-2">
        <Button variant="default" size="sm" onClick={onRetry} className="w-full">
          Retry
        </Button>

        <Button variant="ghost" size="sm" onClick={handleReveal} className="w-full">
          Reveal in Finder
        </Button>

        {/* Inline error — appears when reveal_in_finder rejects */}
        {revealError !== null && (
          <p role="alert" aria-live="polite" className="text-xs [color:var(--color-danger)]">
            {revealError}
          </p>
        )}
      </div>
    </div>
  );
}
