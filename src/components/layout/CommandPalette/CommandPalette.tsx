/**
 * CommandPalette — keyboard-driven command overlay (Story 2.10, Layout tier P0)
 *
 * Renders a cmdk-powered fuzzy-search palette wrapped in the Modal primitive
 * for overlay, focus trap, and Escape-to-dismiss. Keyboard shortcut:
 *   - macOS:     Cmd+K
 *   - Win/Linux: Ctrl+K
 *
 * Architecture:
 *   - Open state lives in useCommandPaletteStore (Zustand)
 *   - Actions are registered by features via useCommandPalette().register()
 *   - cmdk handles fuzzy matching against action labels + keywords
 *   - Modal (Radix Dialog) handles focus trap + Escape key
 *
 * Reduced-motion: the overlay transition-duration is set to 0ms under
 * prefers-reduced-motion — applied via an inline <style> tag (same pattern
 * as CollapsiblePane and other Story 2.9+ components).
 *
 * @see src/stores/commandPalette.ts
 * @see src/hooks/useCommandPalette.ts
 * @see src/components/ui/Modal/Modal.tsx
 * @see docs/design/ux-spec.md §8.2 — CommandPalette states
 */
import * as React from "react";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "cmdk";
import { ModalRoot, ModalContent, ModalTitle } from "@/components/ui/Modal/Modal";
import { useCommandPaletteStore } from "@/stores/commandPalette";

// ─── Reduced-motion style injection ────────────────────────────────────────────
//
// Injected once at the document level so the animation override applies to the
// portaled dialog even when the inline style's owning element is unmounted.

const REDUCED_MOTION_STYLE = `
@media (prefers-reduced-motion: reduce) {
  .command-palette-overlay {
    transition-duration: 0ms !important;
    animation-duration: 0ms !important;
  }
}
`;

// ─── CommandPalette ────────────────────────────────────────────────────────────

export interface CommandPaletteProps {
  /** Optional className for the Command root (not the overlay). */
  className?: string;
}

/**
 * CommandPalette — full-screen overlay launched by Cmd+K / Ctrl+K.
 *
 * Mount once inside HostShell (outside the CSS Grid, portal-renders via Modal).
 * All open-state management is internal — consumers call toggle() / setOpen()
 * on useCommandPaletteStore to control the palette.
 */
export function CommandPalette({ className }: CommandPaletteProps): React.ReactElement {
  const { open, setOpen, toggle, actions } = useCommandPaletteStore();

  // ── Global Cmd+K / Ctrl+K shortcut ────────────────────────────────────────

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        toggle();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Reduced-motion style injection */}
      <style>{REDUCED_MOTION_STYLE}</style>

      <ModalRoot open={open} onOpenChange={setOpen}>
        <ModalContent
          size="lg"
          aria-label="Command palette"
          aria-describedby={undefined}
          className="command-palette-overlay"
          style={{
            padding: 0,
            overflow: "hidden",
          }}
        >
          {/*
           * Radix Dialog requires a DialogTitle for screen reader accessibility.
           * ModalTitle renders as DialogPrimitive.Title (aria-labelledby target).
           * The srOnly span hides it visually while keeping it in the a11y tree.
           */}
          <ModalTitle>
            <span
              style={{
                position: "absolute",
                width: "1px",
                height: "1px",
                padding: 0,
                margin: "-1px",
                overflow: "hidden",
                clip: "rect(0,0,0,0)",
                whiteSpace: "nowrap",
                borderWidth: 0,
              }}
            >
              Command palette
            </span>
          </ModalTitle>

          <Command
            className={className}
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              maxHeight: "calc(100vh - 4rem)",
              background: "var(--color-surface-overlay)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
            }}
          >
            {/* Search input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderBottom: "1px solid var(--color-border)",
                padding: "var(--space-3) var(--space-4)",
                gap: "var(--space-2)",
              }}
            >
              {/* Search icon */}
              <span
                aria-hidden="true"
                style={{
                  color: "var(--color-foreground-muted)",
                  fontSize: "var(--text-sm)",
                  flexShrink: 0,
                }}
              >
                ⌕
              </span>
              <CommandInput
                placeholder="Type a command or search…"
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-foreground)",
                  caretColor: "var(--color-accent)",
                }}
                aria-label="Command search"
              />
            </div>

            {/* Results list */}
            <CommandList
              style={{
                overflowY: "auto",
                maxHeight: "340px",
                padding: "var(--space-1) 0",
              }}
              aria-label="Commands"
            >
              <CommandEmpty
                style={{
                  padding: "var(--space-6) var(--space-4)",
                  textAlign: "center",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-foreground-muted)",
                }}
              >
                No commands found.
              </CommandEmpty>

              {actions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={action.id}
                  keywords={action.keywords}
                  onSelect={() => {
                    action.perform();
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-2) var(--space-4)",
                    cursor: "pointer",
                    borderRadius: "var(--radius-sm)",
                    margin: "0 var(--space-1)",
                    fontSize: "var(--text-sm)",
                    color: "var(--color-foreground)",
                    // cmdk sets [data-selected] on the active item
                    outline: "none",
                  }}
                  className="command-palette-item"
                >
                  {/* Optional icon */}
                  {action.icon != null && (
                    <span
                      aria-hidden="true"
                      style={{
                        color: "var(--color-foreground-muted)",
                        display: "flex",
                        alignItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      {action.icon}
                    </span>
                  )}

                  {/* Label */}
                  <span style={{ flex: 1 }}>{action.label}</span>

                  {/* Optional shortcut hint */}
                  {action.shortcut != null && (
                    <kbd
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-foreground-muted)",
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-xs, 2px)",
                        padding: "1px var(--space-1)",
                        fontFamily: "var(--font-mono, monospace)",
                        flexShrink: 0,
                      }}
                    >
                      {action.shortcut}
                    </kbd>
                  )}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </ModalContent>
      </ModalRoot>
    </>
  );
}

// Item hover/selected styles via a global <style> — minimal, avoids Tailwind class conflicts
const ITEM_STYLE = `
.command-palette-item[data-selected="true"] {
  background: var(--color-surface-hover, color-mix(in oklch, var(--color-surface) 90%, var(--color-accent) 10%));
}
.command-palette-item:hover {
  background: var(--color-surface-hover, color-mix(in oklch, var(--color-surface) 90%, var(--color-accent) 10%));
}
`;

// Inject item styles once
if (typeof document !== "undefined") {
  const id = "command-palette-item-styles";
  if (!document.getElementById(id)) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = ITEM_STYLE;
    document.head.appendChild(el);
  }
}
