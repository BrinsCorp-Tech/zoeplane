/**
 * Animation Catalog stories — Story 2.12 (Batches A, B, C, D).
 *
 * Documents animation classes from src/styles/animations.css:
 *   Batch A (foundation + interactive states): A-10, A-11, A-12, A-13, A-14, A-15, A-24
 *   Batch B (modal / overlay family): A-07, A-08, A-09, A-33, A-39, A-41
 *   Batch C (pane / region / banner transitions): A-03, A-04, A-05, A-06, A-19,
 *     A-21, A-22, A-23, A-27, A-28, A-30, A-32, A-34, A-35
 *   Batch D (skeleton / streaming / editor / workflow / hook animations): A-01, A-02,
 *     A-16, A-17, A-18, A-20, A-25, A-26, A-29, A-31, A-36, A-37, A-38, A-40
 *
 * Each story renders a small demo element with the animation class applied so
 * developers and designers can inspect motion behavior directly in Storybook.
 *
 * The Storybook toolbar "Reduced motion" toggle (Story 2.4 decorator) applies
 * `.prefers-reduced-motion` to `document.documentElement`. All animation
 * classes in this catalog respond to that toggle — transition-only animations
 * become instant; layout-changing animations swap to fade-only or stop entirely.
 *
 * Instant-by-design animations (A-11, A-24) have no visible motion in either
 * mode — that is intentional and documented in each story description.
 *
 * ## Selection guide for consumers
 *
 * Pick the animation ID that matches your component's semantic intent.
 * Reference by class name (e.g., className="animate-A-07-modal-open").
 *
 * Common use cases:
 * - Skeleton loading: A-01 (shimmer), A-25 (card grid stagger)
 * - Streaming / agent pane: A-02 (cursor blink), A-16 (tool-use card slide-in)
 * - Modal interactions: A-07 (open), A-08 (close), A-39 (StrictMode confirm)
 * - Command palette: A-09
 * - Dropdown menus: A-41
 * - Pane toggling (sidebar/inspector): A-05 (open + close split, see CSS)
 * - Toast notifications: A-03 (enter) + A-04 (exit)
 * - Banner appear/dismiss: A-21 + A-22 (Active Tasks), A-32 (inline error), A-35 (file modified)
 * - Hook banners: A-37 (HookSoftNotificationBanner), A-38 (HookQuarantineBanner)
 * - HookCard: A-36 (badge crossfade + stripe fade), A-40 (stripe appear)
 * - Approval flow: A-12 (border pulse — awaiting) + A-27 (slide-in)
 * - Tab interactions: A-06 (content fade), A-19 (drag reorder)
 * - Route transitions: A-30
 * - Hover states: A-10 (button/card), A-33 (destructive button), A-34 (DnD target)
 * - State transitions (pane states): A-13, A-14, A-15
 * - Notification bell badge: A-23 (count change pop)
 * - Diff viewer: A-28
 * - Workflow Builder: A-17 (edge snap), A-18 (node snap)
 * - Evaluator: A-26 (phase bar fill)
 * - Plugin: A-31 (content fade-in after handshake)
 * - Onboarding: A-29 (tour panel crossfade)
 * - Sidebar badge: A-20 (count badge appear)
 * - Theme + focus ring: A-24 (theme switch — instant by design), A-11 (focus — instant by design)
 *
 * Each story below demonstrates default and reduced-motion variants via the
 * Storybook toolbar toggle (Story 2.4 decorator).
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Animations / Catalog (A-01 to A-41)",
  parameters: {
    layout: "centered",
  },
};

export default meta;

// ─── Shared demo element styles ────────────────────────────────────────────────

const demoButtonStyle: React.CSSProperties = {
  padding: "var(--space-3) var(--space-5)",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  color: "var(--color-foreground)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
};

const demoPaneStyle: React.CSSProperties = {
  width: "240px",
  padding: "var(--space-4)",
  background: "var(--color-surface)",
  border: "2px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-sm)",
  color: "var(--color-foreground)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-foreground-muted)",
  fontFamily: "var(--font-sans)",
  marginTop: "var(--space-3)",
  textAlign: "center",
};

// ─── A-10 Hover state on buttons / cards ─────────────────────────────────────

export const A10_HoverState: StoryObj = {
  name: "A-10 Hover state on buttons / cards",
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-2)",
      }}
    >
      <button className="animate-A-10-hover-state" style={demoButtonStyle}>
        Hover me — color transitions at 120ms
      </button>
      <div
        className="animate-A-10-hover-state"
        style={{
          ...demoPaneStyle,
          cursor: "pointer",
        }}
      >
        Card surface — hover for border + bg transition
      </div>
      <p style={labelStyle}>
        Transition: color + background-color + border-color | 120ms fast | easing: decelerate
      </p>
    </div>
  ),
};

// ─── A-11 Focus ring appearance — INSTANT BY DESIGN ──────────────────────────

export const A11_FocusRing: StoryObj = {
  name: "A-11 Focus ring appearance (instant by design)",
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-2)",
      }}
    >
      <button
        className="animate-A-11-focus-ring"
        style={{
          ...demoButtonStyle,
          outline: "2px solid var(--color-focus-ring)",
          outlineOffset: "2px",
        }}
      >
        Focus ring shown (static demo)
      </button>
      <p style={labelStyle}>
        INSTANT BY DESIGN — no transition on focus ring (accessibility requirement). Class is a
        no-op; exists for catalog ID consistency. Tab to this button — the ring appears instantly.
      </p>
    </div>
  ),
};

// ─── A-12 Approval card border-tint pulse ────────────────────────────────────

export const A12_ApprovalPulse: StoryObj = {
  name: "A-12 Approval card border-tint pulse",
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-2)",
      }}
    >
      <div
        className="animate-A-12-approval-pulse"
        style={{
          ...demoPaneStyle,
          borderWidth: "2px",
        }}
      >
        <div
          style={{
            fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"],
            marginBottom: "var(--space-1)",
          }}
        >
          Approval Required
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>
          Border pulses between pane-approval and warning color
        </div>
      </div>
      <p style={labelStyle}>
        Keyframe: border-color pulse | 1.5s infinite | easing: standard. Reduced motion: animation:
        none (explicit — stops the infinite loop).
      </p>
    </div>
  ),
};

// ─── A-13 Per-agent pane state transitions ────────────────────────────────────

export const A13_PaneStateTransition: StoryObj = {
  name: "A-13 Per-agent pane state transitions",
  render: () => {
    const [active, setActive] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        <div
          className="animate-A-13-pane-state-transition"
          style={{
            ...demoPaneStyle,
            background: active ? "var(--color-success-muted)" : "var(--color-surface)",
            borderColor: active ? "var(--color-pane-running)" : "var(--color-border)",
          }}
        >
          <div
            style={{ fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"] }}
          >
            Agent Pane — {active ? "Running" : "Idle"}
          </div>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-foreground-muted)",
              marginTop: "var(--space-1)",
            }}
          >
            Background + border tint transitions on state change
          </div>
        </div>
        <button
          onClick={() => setActive((v) => !v)}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Toggle Running / Idle
        </button>
        <p style={labelStyle}>
          Transition: background-color + border-color | 200ms base | easing: standard. Reduced
          motion: instant.
        </p>
      </div>
    );
  },
};
A13_PaneStateTransition.parameters = { docs: { source: { type: "code" } } };

// ─── A-14 Pane completion transition ─────────────────────────────────────────

export const A14_PaneCompletion: StoryObj = {
  name: "A-14 Pane completion transition (Streaming → Completed)",
  render: () => {
    const [completed, setCompleted] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        <div
          className="animate-A-14-pane-completion"
          style={{
            ...demoPaneStyle,
            background: completed ? "var(--color-success-muted)" : "var(--color-surface)",
          }}
        >
          <div
            style={{ fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"] }}
          >
            Agent Pane — {completed ? "Completed" : "Streaming…"}
          </div>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-foreground-muted)",
              marginTop: "var(--space-1)",
            }}
          >
            Background tone shifts on completion (400ms slow)
          </div>
        </div>
        <button
          onClick={() => setCompleted((v) => !v)}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Toggle Streaming / Completed
        </button>
        <p style={labelStyle}>
          Transition: background-color | 200ms base | easing: standard. (ux-spec §5.1 specifies
          250ms; base is the nearest token tier.) Reduced motion: instant.
        </p>
      </div>
    );
  },
};
A14_PaneCompletion.parameters = { docs: { source: { type: "code" } } };

// ─── A-15 Pane error transition ───────────────────────────────────────────────

export const A15_PaneError: StoryObj = {
  name: "A-15 Pane error transition",
  render: () => {
    const [errored, setErrored] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        <div
          className="animate-A-15-pane-error"
          style={{
            ...demoPaneStyle,
            borderColor: errored ? "var(--color-pane-error)" : "var(--color-border)",
          }}
        >
          <div
            style={{ fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"] }}
          >
            Agent Pane — {errored ? "Error" : "Running"}
          </div>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-foreground-muted)",
              marginTop: "var(--space-1)",
            }}
          >
            Border tint shifts to danger color on error (400ms slow)
          </div>
        </div>
        <button
          onClick={() => setErrored((v) => !v)}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Toggle Running / Error
        </button>
        <p style={labelStyle}>
          Transition: border-color | 200ms base | easing: standard. (ux-spec §5.1 specifies 250ms;
          base is the nearest token tier.) Reduced motion: instant.
        </p>
      </div>
    );
  },
};
A15_PaneError.parameters = { docs: { source: { type: "code" } } };

// ─── A-24 Theme switch — INSTANT BY DESIGN ────────────────────────────────────

export const A24_ThemeSwitch: StoryObj = {
  name: "A-24 Theme switch (instant by design)",
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-2)",
      }}
    >
      <div
        className="animate-A-24-theme-switch"
        style={{
          ...demoPaneStyle,
          textAlign: "center",
        }}
      >
        Theme switch surface — no animation
      </div>
      <p style={labelStyle}>
        INSTANT BY DESIGN — per dark-mode-architecture.md: theme switch is always instant. Class is
        a no-op; exists for catalog ID consistency. Use the Storybook background toolbar to switch
        themes.
      </p>
    </div>
  ),
};

// ════════════════════════════════════════════════════════════════════════════════
// Batch B — Modal / overlay family
// ════════════════════════════════════════════════════════════════════════════════

// ─── A-07 / A-08 Modal open/close cycle ──────────────────────────────────────

const demoModalStyle: React.CSSProperties = {
  width: "320px",
  padding: "var(--space-6)",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  fontFamily: "var(--font-sans)",
  color: "var(--color-foreground)",
};

export const A07_A08_ModalOpenCloseCycle: StoryObj = {
  name: "A-07 / A-08 Modal open/close cycle",
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          minHeight: "220px",
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          {open ? "Close modal" : "Open modal"}
        </button>

        {open && (
          <div className="animate-A-07-modal-open" style={demoModalStyle}>
            <div
              style={{
                fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"],
                marginBottom: "var(--space-2)",
              }}
            >
              Modal — open state
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)" }}>
              Fades in + scales from 0.96 → 1.0 (A-07). Close button applies A-08 (fade-out + scale
              back to 0.96).
            </div>
          </div>
        )}

        {!open && (
          <div
            className="animate-A-08-modal-close"
            key="closed"
            style={{ ...demoModalStyle, pointerEvents: "none" }}
          >
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)" }}>
              Closing… (A-08 fade-out + scale 1.0 → 0.96)
            </div>
          </div>
        )}

        <p style={labelStyle}>
          A-07: 200ms base | scale 0.96 → 1.0 | easing: standard. A-08: 120ms fast (ux-spec 150ms;
          rounding to nearest tier) | scale 1.0 → 0.96. Reduced: fade only, no scale.
        </p>
      </div>
    );
  },
};
A07_A08_ModalOpenCloseCycle.parameters = { docs: { source: { type: "code" } } };

// ─── A-09 Command palette open ────────────────────────────────────────────────

export const A09_CommandPaletteOpen: StoryObj = {
  name: "A-09 Command palette open",
  render: () => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          minHeight: "180px",
        }}
      >
        <button
          onClick={() => {
            setVisible(false);
            // force remount so animation re-triggers on re-open
            setTimeout(() => setVisible(true), 20);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Open command palette
        </button>

        {visible && (
          <div
            className="animate-A-09-command-palette-open"
            style={{
              ...demoModalStyle,
              width: "400px",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)" }}>
              Command palette — slides down 4 px + fades in
            </div>
          </div>
        )}

        <p style={labelStyle}>
          A-09: 120ms fast (ux-spec 150ms; rounding to nearest tier) | translateY(-4px) → 0 |
          easing: standard. Reduced: fade only, no slide.
        </p>
      </div>
    );
  },
};
A09_CommandPaletteOpen.parameters = { docs: { source: { type: "code" } } };

// ─── A-33 Confirmation modal destructive button hover ─────────────────────────

export const A33_DestructiveHover: StoryObj = {
  name: "A-33 Confirmation modal destructive button hover",
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-3)",
      }}
    >
      <button
        className="animate-A-33-destructive-hover"
        style={{
          ...demoButtonStyle,
          background: "var(--color-destructive)",
          color: "var(--color-destructive-foreground)",
          border: "none",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "var(--color-destructive-hover, color-mix(in srgb, var(--color-destructive) 85%, black))";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--color-destructive)";
        }}
      >
        Delete permanently
      </button>
      <p style={labelStyle}>
        A-33: transition background-color | 120ms fast (ux-spec 100ms; rounding to nearest tier) |
        easing: standard. Hover to see tone shift. Reduced: instant (globals.css nuclear block).
      </p>
    </div>
  ),
};

// ─── A-39 StrictModeToggle confirmation dialog ────────────────────────────────

export const A39_StrictModeConfirm: StoryObj = {
  name: "A-39 StrictModeToggle confirmation dialog",
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          minHeight: "200px",
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          {open ? "Dismiss" : "Open StrictMode confirm"}
        </button>

        {open && (
          <div
            className="animate-A-39-strict-mode-confirm"
            style={{
              ...demoModalStyle,
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              style={{
                fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"],
                marginBottom: "var(--space-2)",
              }}
            >
              Enable Strict Mode?
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)" }}>
              Shares motion with A-07 (200ms fade + scale 0.96 → 1.0). Distinct class for
              consumer-ID semantics. Softer framing — no red destructive accent in the animation.
            </div>
          </div>
        )}

        <p style={labelStyle}>
          A-39: reuses A-07 keyframe (strategy a — distinct class, shared keyframe). 200ms base |
          easing: standard. Reduced: fade only, no scale (same as A-07 reduced).
        </p>
      </div>
    );
  },
};
A39_StrictModeConfirm.parameters = { docs: { source: { type: "code" } } };

// ─── A-41 Dropdown menu open/close ────────────────────────────────────────────

export const A41_DropdownOpen: StoryObj = {
  name: "A-41 Dropdown menu open/close",
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-3)",
          minHeight: "200px",
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Toggle dropdown
        </button>

        {open && (
          <div
            className="animate-A-41-dropdown-open"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              minWidth: "180px",
              overflow: "hidden",
            }}
          >
            {["Option 1", "Option 2", "Option 3"].map((item) => (
              <div
                key={item}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  color: "var(--color-foreground)",
                  cursor: "pointer",
                }}
              >
                {item}
              </div>
            ))}
          </div>
        )}

        <p style={labelStyle}>
          A-41: 120ms fast (ux-spec 150ms; rounding to nearest tier) | scale 0.97 → 1.0 | easing:
          standard. Reduced: fade only, no scale.
        </p>
      </div>
    );
  },
};
A41_DropdownOpen.parameters = { docs: { source: { type: "code" } } };

// ════════════════════════════════════════════════════════════════════════════════
// Batch C — Pane / region / banner transitions
// ════════════════════════════════════════════════════════════════════════════════

// ─── A-03 / A-04 Toast notification entrance / exit cycle ────────────────────

const demoToastStyle: React.CSSProperties = {
  padding: "var(--space-3) var(--space-5)",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-sm)",
  color: "var(--color-foreground)",
  minWidth: "240px",
};

export const A03_A04_ToastEntranceExitCycle: StoryObj = {
  name: "A-03 / A-04 Toast notification entrance / exit cycle",
  render: () => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          minHeight: "160px",
        }}
      >
        <button
          onClick={() => setVisible((v) => !v)}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          {visible ? "Dismiss toast (A-04)" : "Show toast (A-03)"}
        </button>

        {visible && (
          <div className="animate-A-03-toast-entrance" style={demoToastStyle}>
            Toast notification — slides up 8px + fades in (A-03)
          </div>
        )}

        {!visible && (
          <div
            className="animate-A-04-toast-exit"
            key="exit"
            style={{ ...demoToastStyle, pointerEvents: "none" }}
          >
            Dismissing… (A-04 fade-out + slide-up 8px)
          </div>
        )}

        <p style={labelStyle}>
          A-03: 200ms base (ux-spec 250ms; rounding to nearest tier) | translateY(8px) → 0 | easing:
          decelerate. A-04: 120ms fast | translateY(0) → -8px | easing: standard. Reduced: fade
          only, no slide.
        </p>
      </div>
    );
  },
};
A03_A04_ToastEntranceExitCycle.parameters = { docs: { source: { type: "code" } } };

// ─── A-23 Notification bell badge count change ────────────────────────────────

export const A23_BellBadgePop: StoryObj = {
  name: "A-23 Notification bell badge count change",
  render: () => {
    const [count, setCount] = React.useState(0);
    const [key, setKey] = React.useState(0);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        <div style={{ position: "relative", display: "inline-block" }}>
          <div
            style={{
              ...demoButtonStyle,
              fontSize: "var(--text-lg)",
              userSelect: "none",
            }}
          >
            Bell
          </div>
          {count > 0 && (
            <span
              key={key}
              className="animate-A-23-bell-pop"
              style={{
                position: "absolute",
                top: "-6px",
                right: "-6px",
                background: "var(--color-destructive)",
                color: "var(--color-destructive-foreground)",
                borderRadius: "9999px",
                fontSize: "var(--text-xs)",
                fontFamily: "var(--font-sans)",
                fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"],
                minWidth: "18px",
                height: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
              }}
            >
              {count}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setCount((c) => c + 1);
            setKey((k) => k + 1);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Increment count (triggers pop)
        </button>
        <p style={labelStyle}>
          A-23: 120ms fast (ux-spec 100ms; rounding to nearest tier) | scale 1.0 → 1.15 → 1.0 |
          easing: standard. Reduced: animation: none — count changes instantly.
        </p>
      </div>
    );
  },
};
A23_BellBadgePop.parameters = { docs: { source: { type: "code" } } };

// ─── A-05 Pane open/close (sidebar, inspector) ───────────────────────────────

export const A05_PaneOpenClose: StoryObj = {
  name: "A-05 Pane open/close (sidebar, inspector)",
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          minHeight: "200px",
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          {open ? "Close pane (A-05)" : "Open pane (A-05)"}
        </button>

        {open && (
          <div
            className="animate-A-05-pane-open"
            style={{
              ...demoPaneStyle,
              width: "200px",
              borderLeft: "3px solid var(--color-focus-ring)",
            }}
          >
            <div
              style={{ fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"] }}
            >
              Sidebar Pane
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-foreground-muted)",
                marginTop: "var(--space-1)",
              }}
            >
              Slides in from left + fades in (A-05)
            </div>
          </div>
        )}

        {!open && (
          <div
            className="animate-A-05-pane-close"
            key="close"
            style={{ ...demoPaneStyle, width: "200px", pointerEvents: "none" }}
          >
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)" }}>
              Closing… (A-05 fade-out + slide left)
            </div>
          </div>
        )}

        <p style={labelStyle}>
          A-05: 200ms base | translateX(-12px) → 0 (open) | easing: decelerate. Reduced: instant
          (spec "Instant (no transition)") — animation: none; transition zeroed by globals.css
          nuclear block. CollapsiblePane.tsx wires these classes in Batch D.
        </p>
      </div>
    );
  },
};
A05_PaneOpenClose.parameters = { docs: { source: { type: "code" } } };

// ─── A-06 Tab open/close in primary work area ─────────────────────────────────

export const A06_TabOpenClose: StoryObj = {
  name: "A-06 Tab open/close in primary work area",
  render: () => {
    const [activeTab, setActiveTab] = React.useState(0);
    const [contentKey, setContentKey] = React.useState(0);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-3)",
          width: "320px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--space-1)",
            borderBottom: "1px solid var(--color-border)",
            width: "100%",
          }}
        >
          {["Tab 1", "Tab 2", "Tab 3"].map((tab, i) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(i);
                setContentKey((k) => k + 1);
              }}
              className="animate-A-06-tab-strip-width"
              style={{
                ...demoButtonStyle,
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md) var(--radius-md) 0 0",
                borderBottom: "none",
                background:
                  activeTab === i ? "var(--color-surface)" : "var(--color-surface-subtle)",
                fontWeight:
                  activeTab === i
                    ? ("var(--weight-semibold)" as React.CSSProperties["fontWeight"])
                    : ("var(--weight-normal)" as React.CSSProperties["fontWeight"]),
                cursor: "pointer",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <div
          key={contentKey}
          className="animate-A-06-tab-content-open"
          style={{
            ...demoPaneStyle,
            width: "100%",
            minHeight: "80px",
          }}
        >
          Content for Tab {activeTab + 1} — fades in (A-06)
        </div>
        <p style={labelStyle}>
          A-06: 120ms fast (ux-spec 150ms; rounding to nearest tier) | content: fade-in keyframe |
          strip: width transition | easing: standard. Reduced: instant via globals.css nuclear
          block.
        </p>
      </div>
    );
  },
};
A06_TabOpenClose.parameters = { docs: { source: { type: "code" } } };

// ─── A-19 Tab strip drag reorder ─────────────────────────────────────────────

export const A19_TabReorder: StoryObj = {
  name: "A-19 Tab strip drag reorder",
  render: () => {
    const [tabs, setTabs] = React.useState(["Agent 1", "Agent 2", "Agent 3"]);
    const [dragging, setDragging] = React.useState<number | null>(null);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-3)",
          width: "360px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--space-1)",
            width: "100%",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          {tabs.map((tab, i) => (
            <div
              key={tab}
              draggable
              onDragStart={() => setDragging(i)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragging !== null && dragging !== i) {
                  const next = [...tabs];
                  const [moved] = next.splice(dragging, 1);
                  next.splice(i, 0, moved);
                  setTabs(next);
                  setDragging(i);
                }
              }}
              onDragEnd={() => setDragging(null)}
              className="animate-A-19-tab-reorder"
              style={{
                ...demoButtonStyle,
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md) var(--radius-md) 0 0",
                cursor: "grab",
                opacity: dragging === i ? 0.5 : 1,
                userSelect: "none",
              }}
            >
              {tab}
            </div>
          ))}
        </div>
        <p style={labelStyle}>
          A-19: 120ms fast (ux-spec 150ms; rounding to nearest tier) | transform transition on
          reorder | easing: standard. Drag tabs to reorder. Reduced: instant via globals.css nuclear
          block.
        </p>
      </div>
    );
  },
};
A19_TabReorder.parameters = { docs: { source: { type: "code" } } };

// ─── A-21 / A-22 Active Tasks banner appearance / dismissal ──────────────────

const demoBannerStyle: React.CSSProperties = {
  width: "100%",
  padding: "var(--space-3) var(--space-4)",
  background: "var(--color-success-muted)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-sm)",
  color: "var(--color-foreground)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

export const A21_A22_BannerAppearDismiss: StoryObj = {
  name: "A-21 / A-22 Active Tasks banner appearance / dismissal",
  render: () => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          width: "360px",
          minHeight: "120px",
          overflow: "hidden",
        }}
      >
        {visible && (
          <div className="animate-A-21-banner-appear" style={{ width: "100%" }}>
            <div style={demoBannerStyle}>
              <span>2 active tasks running</span>
              <button
                onClick={() => setVisible(false)}
                style={{
                  ...demoButtonStyle,
                  padding: "var(--space-1) var(--space-3)",
                  cursor: "pointer",
                }}
              >
                Dismiss (A-22)
              </button>
            </div>
          </div>
        )}

        {!visible && (
          <div
            className="animate-A-22-banner-dismiss"
            key="dismiss"
            style={{ width: "100%", pointerEvents: "none" }}
          >
            <div style={{ ...demoBannerStyle, opacity: 0.5 }}>Dismissing… (A-22 slide-up)</div>
          </div>
        )}

        <button
          onClick={() => setVisible(true)}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
          disabled={visible}
        >
          Show banner (A-21)
        </button>

        <p style={labelStyle}>
          A-21: 200ms base | translateY(-100%) → 0 | easing: decelerate. A-22: 120ms fast (ux-spec
          150ms; rounding) | translateY(0) → -100% | easing: standard. Reduced: animation: none
          (instant per spec).
        </p>
      </div>
    );
  },
};
A21_A22_BannerAppearDismiss.parameters = { docs: { source: { type: "code" } } };

// ─── A-27 Approval card slide-in ─────────────────────────────────────────────

export const A27_ApprovalCardSlideIn: StoryObj = {
  name: "A-27 Approval card slide-in",
  render: () => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          minHeight: "180px",
        }}
      >
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(() => setVisible(true), 20);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Trigger approval card
        </button>

        {visible && (
          <div
            className="animate-A-27-approval-card-in"
            style={{
              ...demoPaneStyle,
              width: "280px",
              borderLeft: "3px solid var(--color-warning)",
            }}
          >
            <div
              style={{ fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"] }}
            >
              Approval Required
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-foreground-muted)",
                marginTop: "var(--space-1)",
              }}
            >
              Slides up 12px + fades in (A-27)
            </div>
          </div>
        )}

        <p style={labelStyle}>
          A-27: 200ms base | translateY(12px) → 0 + fade | easing: decelerate. Reduced: animation:
          none (instant per spec).
        </p>
      </div>
    );
  },
};
A27_ApprovalCardSlideIn.parameters = { docs: { source: { type: "code" } } };

// ─── A-28 Diff Viewer pane reveal ─────────────────────────────────────────────

export const A28_DiffViewerReveal: StoryObj = {
  name: "A-28 Diff Viewer pane reveal",
  render: () => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          minHeight: "180px",
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(() => setVisible(true), 20);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Reveal diff viewer
        </button>

        {visible && (
          <div
            className="animate-A-28-diff-viewer-reveal"
            style={{
              ...demoPaneStyle,
              width: "280px",
              fontFamily: "var(--font-mono, monospace)",
              borderLeft: "3px solid var(--color-focus-ring)",
            }}
          >
            <div style={{ color: "var(--color-success)", marginBottom: "var(--space-1)" }}>
              + added line
            </div>
            <div style={{ color: "var(--color-destructive)" }}>- removed line</div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-foreground-muted)",
                marginTop: "var(--space-2)",
                fontFamily: "var(--font-sans)",
              }}
            >
              Slides from right 12px + fades in (A-28)
            </div>
          </div>
        )}

        <p style={labelStyle}>
          A-28: 200ms base | translateX(12px) → 0 + fade | easing: decelerate. Reduced: animation:
          none (instant per spec).
        </p>
      </div>
    );
  },
};
A28_DiffViewerReveal.parameters = { docs: { source: { type: "code" } } };

// ─── A-30 Page-level route transition ─────────────────────────────────────────

export const A30_RouteTransition: StoryObj = {
  name: "A-30 Page-level route transition",
  render: () => {
    const [page, setPage] = React.useState<"a" | "b">("a");
    const [key, setKey] = React.useState(0);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          width: "280px",
          minHeight: "180px",
        }}
      >
        <div
          key={key}
          className="animate-A-30-route-fade-in"
          style={{
            ...demoPaneStyle,
            width: "100%",
            textAlign: "center",
          }}
        >
          <div
            style={{ fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"] }}
          >
            Page {page === "a" ? "A" : "B"}
          </div>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-foreground-muted)",
              marginTop: "var(--space-1)",
            }}
          >
            Fades in on route change (A-30)
          </div>
        </div>

        <button
          onClick={() => {
            setPage((p) => (p === "a" ? "b" : "a"));
            setKey((k) => k + 1);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Navigate to Page {page === "a" ? "B" : "A"}
        </button>

        <p style={labelStyle}>
          A-30: 120ms fast (ux-spec 100ms exit + 150ms enter; both round to fast) | fade-out then
          fade-in | easing: standard. Reduced: instant via globals.css nuclear block.
        </p>
      </div>
    );
  },
};
A30_RouteTransition.parameters = { docs: { source: { type: "code" } } };

// ─── A-32 Inline error banner appearance ─────────────────────────────────────

export const A32_InlineErrorBanner: StoryObj = {
  name: "A-32 Inline error banner appearance",
  render: () => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          width: "300px",
          minHeight: "140px",
        }}
      >
        {visible && (
          <div
            className="animate-A-32-error-banner-appear"
            style={{
              width: "100%",
              padding: "var(--space-3) var(--space-4)",
              background:
                "var(--color-destructive-muted, color-mix(in srgb, var(--color-destructive) 15%, transparent))",
              border: "1px solid var(--color-destructive)",
              borderRadius: "var(--radius-md)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              color: "var(--color-foreground)",
            }}
          >
            Error: Command failed — slides down + fades in (A-32)
          </div>
        )}

        <button
          onClick={() => {
            setVisible(false);
            setTimeout(() => setVisible(true), 20);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Trigger error banner
        </button>

        <p style={labelStyle}>
          A-32: 200ms base | translateY(-8px) → 0 + fade | easing: decelerate. Reduced: fade-in
          only, no slide (per spec "100ms fade-in only").
        </p>
      </div>
    );
  },
};
A32_InlineErrorBanner.parameters = { docs: { source: { type: "code" } } };

// ─── A-34 Drag-and-drop hover-target highlight ────────────────────────────────

export const A34_DndHoverHighlight: StoryObj = {
  name: "A-34 Drag-and-drop hover-target highlight",
  render: () => {
    const [hovered, setHovered] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        <div
          className="animate-A-34-dnd-hover-highlight"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            ...demoPaneStyle,
            width: "240px",
            background: hovered ? "var(--color-success-muted)" : "var(--color-surface)",
            borderColor: hovered ? "var(--color-focus-ring)" : "var(--color-border)",
            borderStyle: "dashed",
            textAlign: "center",
            cursor: "default",
          }}
        >
          {hovered ? "Drop target active" : "Hover to simulate drop target"}
        </div>
        <p style={labelStyle}>
          A-34: 120ms fast (ux-spec 100ms; rounding to nearest tier) | background-color transition |
          easing: standard. Hover the zone above. Reduced: instant via globals.css nuclear block.
        </p>
      </div>
    );
  },
};

// ─── A-35 File-modified-externally banner ────────────────────────────────────

export const A35_FileModifiedBanner: StoryObj = {
  name: "A-35 File-modified-externally banner",
  render: () => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          width: "320px",
          minHeight: "140px",
          overflow: "hidden",
        }}
      >
        {visible && (
          <div
            className="animate-A-35-file-modified-banner"
            style={{
              width: "100%",
              padding: "var(--space-2) var(--space-4)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              color: "var(--color-foreground)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>File modified externally — reload?</span>
            <button
              onClick={() => setVisible(false)}
              style={{
                ...demoButtonStyle,
                padding: "var(--space-1) var(--space-2)",
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        <button
          onClick={() => {
            setVisible(false);
            setTimeout(() => setVisible(true), 20);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Trigger file-modified banner
        </button>

        <p style={labelStyle}>
          A-35: 200ms base | translateY(-100%) → 0 | easing: decelerate. Reduced: animation: none
          (instant per spec).
        </p>
      </div>
    );
  },
};
A35_FileModifiedBanner.parameters = { docs: { source: { type: "code" } } };

// ════════════════════════════════════════════════════════════════════════════════
// Batch D — Skeleton / streaming / editor / workflow / hook animations
// ════════════════════════════════════════════════════════════════════════════════

// ─── A-01 Skeleton shimmer ────────────────────────────────────────────────────

export const A01_SkeletonShimmer: StoryObj = {
  name: "A-01 Skeleton shimmer (LibraryShell cards, route shells)",
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "280px",
      }}
    >
      {/* Card skeleton row */}
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          style={{
            width: "100%",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            border: "1px solid var(--color-border)",
          }}
        >
          <div
            className="animate-A-01-skeleton-shimmer"
            style={{ height: "80px", borderRadius: "var(--radius-md)" }}
          />
        </div>
      ))}
      <p style={labelStyle}>
        A-01: 1.2s infinite shimmer gradient sweep | easing: standard. Reduced motion: animation:
        none — static muted fill (explicit override required for infinite loops).
      </p>
    </div>
  ),
};

// ─── A-02 Streaming text cursor blink ────────────────────────────────────────

export const A02_StreamingCursorBlink: StoryObj = {
  name: "A-02 Streaming text cursor blink (agent pane tail)",
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-3)",
      }}
    >
      <div
        style={{
          ...demoPaneStyle,
          display: "flex",
          alignItems: "center",
          gap: "2px",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        <span>Streaming response…</span>
        <span
          className="animate-A-02-cursor-blink"
          style={{
            display: "inline-block",
            width: "2px",
            height: "1em",
            background: "var(--color-foreground)",
            borderRadius: "1px",
          }}
        />
      </div>
      <p style={labelStyle}>
        A-02: 1.2s infinite opacity blink (50% midpoint) | easing: standard. Reduced motion:
        animation: none — static caret (explicit override required for infinite loops).
      </p>
    </div>
  ),
};

// ─── A-16 Tool-use card slide-in ─────────────────────────────────────────────

export const A16_ToolCardSlideIn: StoryObj = {
  name: "A-16 Tool-use card slide-in (within agent pane)",
  render: () => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          minHeight: "160px",
        }}
      >
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(() => setVisible(true), 20);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Trigger tool-use card
        </button>

        {visible && (
          <div
            className="animate-A-16-tool-card-slide-in"
            style={{
              ...demoPaneStyle,
              width: "260px",
              borderLeft: "3px solid var(--color-focus-ring)",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "var(--text-xs)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"],
                marginBottom: "var(--space-1)",
                fontSize: "var(--text-sm)",
              }}
            >
              read_file
            </div>
            <div style={{ color: "var(--color-foreground-muted)" }}>path: src/main.tsx</div>
          </div>
        )}

        <p style={labelStyle}>
          A-16: 200ms base | translateY(8px) → 0 + fade | easing: decelerate. Reduced motion:
          animation: none — instant appearance.
        </p>
      </div>
    );
  },
};
A16_ToolCardSlideIn.parameters = { docs: { source: { type: "code" } } };

// ─── A-17 Workflow Builder edge drawing during drag ────────────────────────────

export const A17_EdgeSnap: StoryObj = {
  name: "A-17 Workflow Builder edge snap on release",
  render: () => {
    const [snapped, setSnapped] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "280px",
            height: "80px",
            background: "var(--color-surface-subtle)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}
        >
          {/* Simulated edge line */}
          <div
            className="animate-A-17-edge-snap"
            style={{
              position: "absolute",
              top: "50%",
              left: snapped ? "40px" : "20px",
              right: snapped ? "40px" : "60px",
              height: "2px",
              background: "var(--color-focus-ring)",
              transformOrigin: "left center",
              transform: "translateY(-50%)",
            }}
          />
        </div>
        <button
          onClick={() => setSnapped((v) => !v)}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          {snapped ? "Reset position" : "Snap edge"}
        </button>
        <p style={labelStyle}>
          A-17: 120ms fast (ux-spec 100ms; rounding to nearest tier) | transform transition |
          easing: decelerate (snap-to-grid arrival). Reduced motion: instant via globals.css nuclear
          block.
        </p>
      </div>
    );
  },
};
A17_EdgeSnap.parameters = { docs: { source: { type: "code" } } };

// ─── A-18 Workflow Builder node drag ─────────────────────────────────────────

export const A18_NodeSnap: StoryObj = {
  name: "A-18 Workflow Builder node drag snap-to-grid",
  render: () => {
    const [gridPos, setGridPos] = React.useState({ x: 0, y: 0 });
    const GRID = 40;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "240px",
            height: "160px",
            background: "var(--color-surface-subtle)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            // Draw grid lines
            backgroundImage:
              "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
            backgroundSize: `${GRID}px ${GRID}px`,
          }}
        >
          <div
            className="animate-A-18-node-snap"
            style={{
              position: "absolute",
              top: `${20 + gridPos.y * GRID}px`,
              left: `${20 + gridPos.x * GRID}px`,
              padding: "var(--space-2) var(--space-3)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-focus-ring)",
              borderRadius: "var(--radius-md)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"],
              color: "var(--color-foreground)",
              userSelect: "none",
              cursor: "pointer",
            }}
          >
            Agent Node
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          {[
            { label: "← Left", dx: -1, dy: 0 },
            { label: "Right →", dx: 1, dy: 0 },
            { label: "↑ Up", dx: 0, dy: -1 },
            { label: "↓ Down", dx: 0, dy: 1 },
          ].map(({ label, dx, dy }) => (
            <button
              key={label}
              onClick={() =>
                setGridPos((p) => ({
                  x: Math.max(0, Math.min(3, p.x + dx)),
                  y: Math.max(0, Math.min(2, p.y + dy)),
                }))
              }
              style={{
                ...demoButtonStyle,
                padding: "var(--space-1) var(--space-2)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <p style={labelStyle}>
          A-18: 120ms fast (ux-spec 80ms; rounding to nearest tier) | transform transition | easing:
          decelerate (snap-to-grid). Reduced motion: instant snap via globals.css nuclear block.
        </p>
      </div>
    );
  },
};
A18_NodeSnap.parameters = { docs: { source: { type: "code" } } };

// ─── A-20 Sidebar item-count badge appearance ─────────────────────────────────

export const A20_BadgeAppear: StoryObj = {
  name: "A-20 Sidebar item-count badge appearance (cold-launch)",
  render: () => {
    const [count, setCount] = React.useState<number | null>(null);
    const [key, setKey] = React.useState(0);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        <div style={{ position: "relative", display: "inline-block" }}>
          <div style={{ ...demoButtonStyle, paddingRight: "var(--space-8)" }}>Projects</div>
          {count !== null && (
            <span
              key={key}
              className="animate-A-20-badge-appear"
              style={{
                position: "absolute",
                top: "50%",
                right: "var(--space-2)",
                transform: "translateY(-50%)",
                background: "var(--color-surface-subtle)",
                color: "var(--color-foreground-muted)",
                borderRadius: "9999px",
                fontSize: "var(--text-xs)",
                fontFamily: "var(--font-sans)",
                fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"],
                minWidth: "18px",
                height: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
              }}
            >
              {count}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setCount(Math.floor(Math.random() * 12) + 1);
            setKey((k) => k + 1);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Simulate cold-launch count resolve
        </button>
        <p style={labelStyle}>
          A-20: 120ms fast (ux-spec 150ms; rounding to nearest tier) | fade-in keyframe | easing:
          decelerate. Reduced motion: instant via globals.css nuclear block (fade-only, no
          transform).
        </p>
      </div>
    );
  },
};
A20_BadgeAppear.parameters = { docs: { source: { type: "code" } } };

// ─── A-25 Skeleton card grid stagger entrance ─────────────────────────────────

export const A25_CardGridStagger: StoryObj = {
  name: "A-25 Skeleton card grid stagger entrance",
  render: () => {
    const [visible, setVisible] = React.useState(false);
    const [mountKey, setMountKey] = React.useState(0);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          width: "300px",
        }}
      >
        {visible && (
          <div
            key={mountKey}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-3)",
              width: "100%",
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-A-25-card-stagger"
                // --card-index drives the 30ms stagger delay
                style={
                  {
                    "--card-index": i,
                    height: "64px",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-xs)",
                    color: "var(--color-foreground-muted)",
                  } as React.CSSProperties
                }
              >
                Card {i + 1}
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(() => {
              setMountKey((k) => k + 1);
              setVisible(true);
            }, 50);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Trigger stagger entrance
        </button>
        <p style={labelStyle}>
          A-25: 120ms fast | stagger: calc(var(--card-index, 0) * 30ms) delay per card | easing:
          decelerate. Set --card-index on each card element. Reduced motion: animation: none +
          animation-delay: 0ms — all cards appear simultaneously.
        </p>
      </div>
    );
  },
};
A25_CardGridStagger.parameters = { docs: { source: { type: "code" } } };

// ─── A-26 Evaluator progress phase highlight ──────────────────────────────────

export const A26_EvaluatorPhaseBar: StoryObj = {
  name: "A-26 Evaluator progress phase highlight",
  render: () => {
    const phases = ["Planning", "Execution", "Review", "Complete"];
    const [activePhase, setActivePhase] = React.useState(0);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          width: "280px",
        }}
      >
        <div
          style={{ width: "100%", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
        >
          {phases.map((phase, i) => (
            <div
              key={phase}
              style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}
            >
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-sm)",
                  color:
                    i === activePhase ? "var(--color-foreground)" : "var(--color-foreground-muted)",
                  fontWeight:
                    i === activePhase
                      ? ("var(--weight-semibold)" as React.CSSProperties["fontWeight"])
                      : ("var(--weight-normal)" as React.CSSProperties["fontWeight"]),
                }}
              >
                {phase}
              </div>
              <div
                style={{
                  height: "4px",
                  background: "var(--color-surface-subtle)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  className="animate-A-26-phase-bar-fill"
                  style={{
                    height: "100%",
                    width: i <= activePhase ? "100%" : "0%",
                    background:
                      i < activePhase
                        ? "var(--color-success)"
                        : i === activePhase
                          ? "var(--color-focus-ring)"
                          : "transparent",
                    borderRadius: "2px",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button
            onClick={() => setActivePhase((p) => Math.max(0, p - 1))}
            style={{ ...demoButtonStyle, cursor: "pointer" }}
            disabled={activePhase === 0}
          >
            ← Prev
          </button>
          <button
            onClick={() => setActivePhase((p) => Math.min(phases.length - 1, p + 1))}
            style={{ ...demoButtonStyle, cursor: "pointer" }}
            disabled={activePhase === phases.length - 1}
          >
            Next →
          </button>
        </div>
        <p style={labelStyle}>
          A-26: transition width | 200ms base | easing: standard. Set --card-index on consumers.
          Reduced motion: instant via globals.css nuclear block. Component renders ▸ glyph adjacent
          to active phase label as ux-spec fallback.
        </p>
      </div>
    );
  },
};
A26_EvaluatorPhaseBar.parameters = { docs: { source: { type: "code" } } };

// ─── A-29 Onboarding tour panel transitions ───────────────────────────────────

export const A29_TourCrossfade: StoryObj = {
  name: "A-29 Onboarding tour panel transitions",
  render: () => {
    const steps = [
      { title: "Welcome to ZoePlane", body: "A multi-agent cockpit for Claude Code teams." },
      { title: "Agent Panes", body: "Each agent runs in its own pane with live streaming output." },
      {
        title: "Approval Flow",
        body: "Review, approve, or reject tool-use requests in one click.",
      },
    ];
    const [step, setStep] = React.useState(0);
    const [panelKey, setPanelKey] = React.useState(0);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          width: "300px",
        }}
      >
        <div
          key={panelKey}
          className="animate-A-29-tour-crossfade"
          style={{
            ...demoPaneStyle,
            width: "100%",
            minHeight: "80px",
          }}
        >
          <div
            style={{
              fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"],
              marginBottom: "var(--space-2)",
            }}
          >
            {steps[step].title}
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)" }}>
            {steps[step].body}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <button
            onClick={() => {
              setStep((s) => Math.max(0, s - 1));
              setPanelKey((k) => k + 1);
            }}
            style={{ ...demoButtonStyle, cursor: "pointer" }}
            disabled={step === 0}
          >
            ← Back
          </button>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              color: "var(--color-foreground-muted)",
            }}
          >
            {step + 1} / {steps.length}
          </span>
          <button
            onClick={() => {
              setStep((s) => Math.min(steps.length - 1, s + 1));
              setPanelKey((k) => k + 1);
            }}
            style={{ ...demoButtonStyle, cursor: "pointer" }}
            disabled={step === steps.length - 1}
          >
            Next →
          </button>
        </div>
        <p style={labelStyle}>
          A-29: 200ms base (ux-spec 250ms; rounding to nearest tier) | crossfade fade-in | easing:
          standard. Reduced motion: swap to -reduced keyframe (same fade; consumer controls
          mount/unmount timing for sequential fade-out → fade-in).
        </p>
      </div>
    );
  },
};
A29_TourCrossfade.parameters = { docs: { source: { type: "code" } } };

// ─── A-31 Plugin slot skeleton-to-content transition ─────────────────────────

export const A31_PluginFadeIn: StoryObj = {
  name: "A-31 Plugin slot skeleton-to-content fade-in",
  render: () => {
    const [loaded, setLoaded] = React.useState(false);
    const [contentKey, setContentKey] = React.useState(0);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        <div
          style={{
            width: "260px",
            height: "120px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {!loaded && (
            <div
              className="animate-A-01-skeleton-shimmer"
              style={{ position: "absolute", inset: 0 }}
            />
          )}
          {loaded && (
            <div
              key={contentKey}
              className="animate-A-31-plugin-fade-in"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--color-surface)",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-sm)",
                color: "var(--color-foreground-muted)",
              }}
            >
              Plugin loaded (handshake complete)
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setLoaded(false);
            setTimeout(() => {
              setContentKey((k) => k + 1);
              setLoaded(true);
            }, 800);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Simulate plugin handshake
        </button>
        <p style={labelStyle}>
          A-31: 200ms base | fade-in keyframe | easing: decelerate (content arrival). Reduced
          motion: animation: none — instant reveal.
        </p>
      </div>
    );
  },
};
A31_PluginFadeIn.parameters = { docs: { source: { type: "code" } } };

// ─── A-36 HookCard state-badge crossfade ─────────────────────────────────────

export const A36_HookCardBadgeCrossfade: StoryObj = {
  name: "A-36 HookCard state-badge crossfade (pending → approved)",
  render: () => {
    const states = ["pending-review", "approved", "quarantined"] as const;
    type State = (typeof states)[number];
    const [badgeState, setBadgeState] = React.useState<State>("pending-review");
    const [badgeKey, setBadgeKey] = React.useState(0);
    const [stripeVisible, setStripeVisible] = React.useState(false);

    const badgeColors: Record<State, string> = {
      "pending-review": "var(--color-warning)",
      approved: "var(--color-success)",
      quarantined: "var(--color-destructive)",
    };

    const badgeLabels: Record<State, string> = {
      "pending-review": "Pending review",
      approved: "Approved",
      quarantined: "Quarantined",
    };

    const advance = () => {
      const nextIdx = (states.indexOf(badgeState) + 1) % states.length;
      const next = states[nextIdx];
      setBadgeState(next);
      setBadgeKey((k) => k + 1);
      setStripeVisible(next === "quarantined");
    };

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        <div
          style={{
            ...demoPaneStyle,
            width: "260px",
            position: "relative",
            paddingLeft: stripeVisible ? "var(--space-6)" : "var(--space-4)",
            overflow: "hidden",
          }}
        >
          {/* Left-edge accent stripe (A-40 appear, A-36-stripe fade) */}
          <div
            className={stripeVisible ? "animate-A-40-stripe-appear" : "animate-A-36-stripe-fade"}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "4px",
              background: "var(--color-destructive)",
              opacity: stripeVisible ? 1 : 0,
            }}
          />
          <div
            style={{
              fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"],
              marginBottom: "var(--space-2)",
            }}
          >
            HookCard — read_file
          </div>
          {/* Badge crossfade (A-36) */}
          <span
            key={badgeKey}
            className="animate-A-36-badge-crossfade"
            style={{
              display: "inline-block",
              padding: "2px var(--space-2)",
              borderRadius: "9999px",
              background: badgeColors[badgeState],
              color: "white",
              fontSize: "var(--text-xs)",
              fontFamily: "var(--font-sans)",
              fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"],
            }}
          >
            {badgeLabels[badgeState]}
          </span>
        </div>
        <button onClick={advance} style={{ ...demoButtonStyle, cursor: "pointer" }}>
          Advance state
        </button>
        <p style={labelStyle}>
          A-36 badge: 200ms base | fade-in crossfade | easing: standard. A-36 stripe: 120ms fast
          (ux-spec 150ms; rounding). A-40 stripe appear: 120ms fast. Reduced: instant badge swap +
          instant stripe changes.
        </p>
      </div>
    );
  },
};
A36_HookCardBadgeCrossfade.parameters = { docs: { source: { type: "code" } } };

// ─── A-37 HookSoftNotificationBanner appearance ───────────────────────────────

export const A37_HookSoftBannerAppear: StoryObj = {
  name: "A-37 HookSoftNotificationBanner appearance (default mode)",
  render: () => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          width: "320px",
          minHeight: "120px",
          overflow: "hidden",
        }}
      >
        {visible && (
          <div
            className="animate-A-37-hook-banner-appear"
            style={{
              width: "100%",
              padding: "var(--space-3) var(--space-4)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              color: "var(--color-foreground)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Hook notification — action available</span>
            <button
              onClick={() => setVisible(false)}
              style={{
                ...demoButtonStyle,
                padding: "var(--space-1) var(--space-2)",
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(() => setVisible(true), 20);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Show banner
        </button>
        <p style={labelStyle}>
          A-37: 200ms base | translateY(-100%) → 0 + fade | easing: decelerate. Reduced motion:
          fade-in only (swap to -reduced keyframe, no slide).
        </p>
      </div>
    );
  },
};
A37_HookSoftBannerAppear.parameters = { docs: { source: { type: "code" } } };

// ─── A-38 HookQuarantineBanner appearance ────────────────────────────────────

export const A38_HookQuarantineBanner: StoryObj = {
  name: "A-38 HookQuarantineBanner appearance (Strict Mode)",
  render: () => {
    const [visible, setVisible] = React.useState(false);
    const [bannerKey, setBannerKey] = React.useState(0);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          width: "320px",
          minHeight: "120px",
          overflow: "hidden",
        }}
      >
        {visible && (
          <div
            key={bannerKey}
            className="animate-A-38-quarantine-banner-appear"
            style={{
              width: "100%",
              padding: "var(--space-3) var(--space-4)",
              background: "color-mix(in srgb, var(--color-danger) 12%, var(--color-surface))",
              border: "1px solid var(--color-destructive)",
              borderRadius: "var(--radius-md)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              color: "var(--color-foreground)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
            }}
          >
            {/* Shield icon with pulse animation for first 3 seconds */}
            <span
              className="animate-A-38-shield-pulse"
              style={{ fontSize: "var(--text-lg)", userSelect: "none" }}
            >
              🛡
            </span>
            <span>
              <strong>Hook quarantined</strong> — awaiting review before execution
            </span>
          </div>
        )}
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(() => {
              setBannerKey((k) => k + 1);
              setVisible(true);
            }, 20);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          Trigger quarantine banner
        </button>
        <p style={labelStyle}>
          A-38 banner: 200ms base | slide-down + fade | easing: decelerate. A-38 shield pulse: 1.5s
          × 3 iterations (first 3 seconds). Reduced motion: animation: none — static banner, no
          pulse.
        </p>
      </div>
    );
  },
};
A38_HookQuarantineBanner.parameters = { docs: { source: { type: "code" } } };

// ─── A-40 HookCard left-edge accent stripe appear ────────────────────────────

export const A40_StripeAppear: StoryObj = {
  name: "A-40 HookCard left-edge accent stripe appear (quarantine entry)",
  render: () => {
    const [quarantined, setQuarantined] = React.useState(false);
    const [stripeKey, setStripeKey] = React.useState(0);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        <div
          style={{
            ...demoPaneStyle,
            width: "260px",
            position: "relative",
            paddingLeft: "var(--space-6)",
            overflow: "hidden",
          }}
        >
          {quarantined && (
            <div
              key={stripeKey}
              className="animate-A-40-stripe-appear"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "4px",
                background: "var(--color-destructive)",
              }}
            />
          )}
          <div
            style={{
              fontWeight: "var(--weight-semibold)" as React.CSSProperties["fontWeight"],
              marginBottom: "var(--space-1)",
            }}
          >
            HookCard — write_file
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>
            State: {quarantined ? "quarantined" : "pending-review"}
          </div>
        </div>
        <button
          onClick={() => {
            const next = !quarantined;
            setQuarantined(next);
            if (next) setStripeKey((k) => k + 1);
          }}
          style={{ ...demoButtonStyle, cursor: "pointer" }}
        >
          {quarantined ? "Clear quarantine" : "Enter quarantine"}
        </button>
        <p style={labelStyle}>
          A-40: 120ms fast (ux-spec 150ms; rounding to nearest tier) | opacity 0 → 1 | easing:
          decelerate (stripe arrival). Reduced motion: animation: none — instant stripe appearance.
        </p>
      </div>
    );
  },
};
A40_StripeAppear.parameters = { docs: { source: { type: "code" } } };
