import type { Config } from "tailwindcss";

/**
 * ZoePlane Tailwind v4 configuration.
 *
 * Design decisions:
 *  - Dark mode: `["class", '[data-theme="dark"]']` — toggled via <html data-theme="dark">.
 *    DO NOT use `prefers-color-scheme` directly in Tailwind utilities. Theme toggling
 *    is explicit (user preference stored in SQLite) per dark-mode-architecture.md.
 *  - Token references: Tailwind color utilities reference CSS custom properties from
 *    tokens.css (semantic layer). Pattern: `hsl(var(--color-primary))` style.
 *    With Tailwind v4's CSS-first approach, tokens are available directly as CSS vars
 *    via the @theme directive in tokens.css.
 *  - Content: scans src/ and packages/ for class usage to eliminate unused CSS.
 */
const config: Config = {
  // Tailwind v4 uses CSS-first config; this JS file handles the few cases where
  // programmatic config is needed (darkMode, content paths, plugin registration).
  content: ["./src/**/*.{ts,tsx}", "./packages/*/src/**/*.{ts,tsx}"],

  // Dark mode: class strategy with the [data-theme="dark"] attribute selector.
  // This matches how the host sets the theme attribute on <html>.
  darkMode: ["class", '[data-theme="dark"]'],

  theme: {
    extend: {
      // Map Tailwind color utilities to ZoePlane semantic tokens.
      // Components can use Tailwind utilities like `bg-background`, `text-foreground`
      // which resolve to the semantic token CSS vars.
      //
      // NOTE: with Tailwind v4 CSS-first, most tokens flow via @theme in tokens.css.
      // This section handles the shadcn/ui convention mapping so shadcn components
      // (which use --background, --foreground, etc.) resolve to ZoePlane tokens.
      colors: {
        background: "var(--color-background)",
        foreground: {
          DEFAULT: "var(--color-foreground)",
          muted: "var(--color-foreground-muted)",
          subtle: "var(--color-foreground-subtle)",
          disabled: "var(--color-foreground-disabled)",
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          overlay: "var(--color-surface-overlay)",
          muted: "var(--color-surface-muted)",
          raised: "var(--color-surface-raised)",
          sunken: "var(--color-surface-sunken)",
        },
        border: "var(--color-border)",
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
          hover: "var(--color-accent-hover)",
          active: "var(--color-accent-active)",
          muted: "var(--color-accent-muted)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          muted: "var(--color-success-muted)",
          foreground: "var(--color-success-foreground)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          muted: "var(--color-warning-muted)",
          foreground: "var(--color-warning-foreground)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          muted: "var(--color-danger-muted)",
          foreground: "var(--color-danger-foreground)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          muted: "var(--color-info-muted)",
          foreground: "var(--color-info-foreground)",
        },
        quarantine: {
          DEFAULT: "var(--color-quarantine)",
          muted: "var(--color-quarantine-muted)",
          foreground: "var(--color-quarantine-foreground)",
        },
        // shadcn/ui convention aliases
        primary: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
        },
        card: {
          DEFAULT: "var(--color-surface)",
          foreground: "var(--color-foreground)",
          border: "var(--color-border)",
        },
        input: "var(--color-surface)",
        ring: "var(--color-focus-ring)",
        muted: {
          DEFAULT: "var(--color-surface-muted)",
          foreground: "var(--color-foreground-muted)",
        },
        // Additional shadcn/ui aliases (missing from initial scaffold)
        popover: {
          DEFAULT: "var(--color-surface-overlay)",
          foreground: "var(--color-foreground)",
        },
        destructive: {
          DEFAULT: "var(--color-danger)",
          foreground: "var(--color-danger-foreground)",
        },
        secondary: {
          DEFAULT: "var(--color-surface-muted)",
          foreground: "var(--color-foreground)",
        },
        "border-strong": "var(--color-border-strong)",
        "hover-overlay": "var(--color-hover-overlay)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        display: ["var(--font-display)"],
      },
      spacing: {
        // Expose ZoePlane spacing tokens as Tailwind utilities
        // (supplements Tailwind's default scale for token-aligned overrides)
        "0_5": "var(--space-0_5)",
        "1_5": "var(--space-1_5)",
        "2_5": "var(--space-2_5)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
    },
  },

  plugins: [
    // shadcn/ui animation utilities — required for Radix UI enter/exit transitions
    require("tailwindcss-animate"),
  ],
};

export default config;
