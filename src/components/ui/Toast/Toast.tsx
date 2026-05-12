/** @see docs/design/components/Toast-spec.md */
import * as React from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import type { ToasterProps } from "sonner";
import { Icon } from "@/components/ui/Icon/Icon";

// ─── Toaster ──────────────────────────────────────────────────────────────────

/**
 * Toaster — the provider that must be mounted once at the app root (HostShell / main.tsx).
 *
 * Sonner's shadcn variant uses next-themes, which ZoePlane does not use (we have
 * our own ThemeProvider). This Toaster reads ZoePlane's `data-theme` attribute
 * directly from `<html>` to set Sonner's theme.
 *
 * Spec defaults (Toast-spec §1):
 *   - position="top-right" — clears StatusBar at the bottom
 *   - expand={false} — stacked mode; click "+N" pill to expand
 *   - richColors={false} — ZoePlane token system manages colors
 *   - closeButton={true} — always render the × dismiss button
 */
/**
 * Reads the theme value ZoePlane currently has active on <html>.
 * Returns Sonner's `theme` prop value — not a JSX theme branch (see no-theme-branch.test.ts exclusion).
 * Isolated in a helper so the comparison never appears in JSX scope.
 */
function readHtmlTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light"; // sonner interop — not a JSX theme branch (see no-theme-branch.test.ts exclusion)
}

function Toaster({ ...props }: Omit<ToasterProps, "theme">) {
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">(readHtmlTheme);

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setResolvedTheme(readHtmlTheme());
    });
    // Observing ZoePlane's theme attribute on the html root element.
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <SonnerToaster
      theme={resolvedTheme}
      position="top-right"
      expand={false}
      richColors={false}
      closeButton
      toastOptions={{
        classNames: {
          toast: [
            "group toast",
            "rounded-md border border-border bg-surface-overlay text-foreground shadow-md",
            "max-w-[420px]",
          ].join(" "),
          title: "text-sm font-semibold leading-none",
          description: "text-xs text-foreground-muted",
          actionButton: "text-xs",
          closeButton: "absolute right-2 top-2 rounded-sm opacity-70 hover:opacity-100",
        },
      }}
      {...props}
    />
  );
}

// ─── Icon map per severity ────────────────────────────────────────────────────

const SEVERITY_ICONS = {
  info: <Icon name="info" size="sm" aria-hidden="true" className="text-info shrink-0" />,
  success: (
    <Icon name="check-circle" size="sm" aria-hidden="true" className="text-success shrink-0" />
  ),
  warning: (
    <Icon name="alert-triangle" size="sm" aria-hidden="true" className="text-warning shrink-0" />
  ),
  error: <Icon name="x-circle" size="sm" aria-hidden="true" className="text-danger shrink-0" />,
  quarantine: (
    <Icon name="shield" size="sm" aria-hidden="true" className="text-quarantine shrink-0" />
  ),
} as const;

// ─── Toast auto-dismiss durations (Toast-spec §3) ─────────────────────────────

const DURATIONS = {
  info: 5000,
  success: 4000,
  warning: 7000,
  error: 10000,
  quarantine: Infinity,
} as const;

// ─── Toast options type ───────────────────────────────────────────────────────

export interface ZoePlaneToastOptions {
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  id?: string | number;
}

// ─── toast API ────────────────────────────────────────────────────────────────

/**
 * toast — the imperative API for dispatching toasts.
 *
 * Severities:
 *   - toast.info()        — neutral status
 *   - toast.success()     — completed user-initiated action
 *   - toast.warning()     — non-blocking concern
 *   - toast.error()       — actionable failure
 *   - toast.quarantine()  — Strict Mode governance event (persistent, operator decision 2)
 *
 * Each call: leading icon (variant-tinted) + title + optional description + optional action.
 */
const toast = {
  info(title: string, options?: ZoePlaneToastOptions) {
    return sonnerToast(title, {
      icon: SEVERITY_ICONS.info,
      description: options?.description,
      action: options?.action
        ? { label: options.action.label, onClick: options.action.onClick }
        : undefined,
      duration: options?.duration ?? DURATIONS.info,
      id: options?.id,
    });
  },

  success(title: string, options?: ZoePlaneToastOptions) {
    return sonnerToast(title, {
      icon: SEVERITY_ICONS.success,
      description: options?.description,
      action: options?.action
        ? { label: options.action.label, onClick: options.action.onClick }
        : undefined,
      duration: options?.duration ?? DURATIONS.success,
      id: options?.id,
    });
  },

  warning(title: string, options?: ZoePlaneToastOptions) {
    return sonnerToast(title, {
      icon: SEVERITY_ICONS.warning,
      description: options?.description,
      action: options?.action
        ? { label: options.action.label, onClick: options.action.onClick }
        : undefined,
      duration: options?.duration ?? DURATIONS.warning,
      id: options?.id,
    });
  },

  error(title: string, options?: ZoePlaneToastOptions) {
    // Error with action button: persistent (spec §3)
    const duration =
      options?.duration !== undefined
        ? options.duration
        : options?.action
          ? Infinity
          : DURATIONS.error;

    return sonnerToast(title, {
      icon: SEVERITY_ICONS.error,
      description: options?.description,
      action: options?.action
        ? { label: options.action.label, onClick: options.action.onClick }
        : undefined,
      duration,
      id: options?.id,
    });
  },

  /**
   * toast.quarantine() — Strict Mode governance event toast.
   * Always persistent (no auto-dismiss). Custom extension wrapping sonner.
   * operator decision 2: preserved quarantine extension.
   */
  quarantine(title: string, options?: ZoePlaneToastOptions) {
    return sonnerToast(title, {
      icon: SEVERITY_ICONS.quarantine,
      description: options?.description,
      action: options?.action
        ? { label: options.action.label, onClick: options.action.onClick }
        : undefined,
      duration: options?.duration ?? DURATIONS.quarantine,
      id: options?.id,
    });
  },

  /** Dismiss a specific toast by id, or all toasts if no id given. */
  dismiss: sonnerToast.dismiss,
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export { Toaster, toast };
export type { ZoePlaneToastOptions as ToastOptions };
