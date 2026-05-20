/**
 * FallbackBodyEditor — plain textarea fallback when CodeMirror 6 fails to load.
 *
 * Features:
 *   - Full-width monospace textarea
 *   - Tab key inserts \t (prevents focus shift)
 *   - Cmd-S / Ctrl-S fires onSave via global keydown handler
 *   - Dismissible warning banner (--color-warning-muted)
 *   - aria-label passed to textarea for accessibility
 *
 * Story: 6.4 AC5 — fallback editor (FR-004)
 */

import * as React from "react";
import { Icon } from "@/components/ui/Icon/Icon";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FallbackBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  ariaLabel?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FallbackBodyEditor({
  value,
  onChange,
  onSave,
  readOnly = false,
  ariaLabel = "Skill markdown body",
  className,
}: FallbackBodyEditorProps) {
  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Cmd-S / Ctrl-S global handler so save works even with focus inside textarea
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        onSave?.();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onSave]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Tab inserts \t instead of moving focus
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd } = textarea;
      const newValue = value.slice(0, selectionStart) + "\t" + value.slice(selectionEnd);
      onChange(newValue);
      // Restore caret position after React re-render
      requestAnimationFrame(() => {
        textarea.setSelectionRange(selectionStart + 1, selectionStart + 1);
      });
    }
  }

  return (
    <div
      className={className}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
    >
      {/* Warning banner */}
      {!bannerDismissed && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-2)",
            padding: "var(--space-3)",
            backgroundColor: "var(--color-warning-muted)",
            color: "var(--color-warning-foreground)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--color-warning)",
            fontSize: "var(--text-sm)",
          }}
        >
          <Icon
            name="alert-triangle"
            size="sm"
            aria-hidden="true"
            style={{ flexShrink: 0, marginTop: "2px" }}
          />
          <span style={{ flex: 1 }}>
            Markdown editor unavailable. Falling back to plain text. Syntax highlighting and
            keyboard shortcuts are reduced. Save still works.
          </span>
          <button
            type="button"
            aria-label="Dismiss warning"
            onClick={() => {
              setBannerDismissed(true);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px",
              color: "var(--color-warning-foreground)",
              flexShrink: 0,
            }}
          >
            <Icon name="x" size="sm" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        aria-label={ariaLabel}
        aria-multiline="true"
        style={{
          width: "100%",
          minHeight: "320px",
          maxHeight: "800px",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono-base)",
          backgroundColor: "var(--color-editor-background)",
          color: "var(--color-editor-foreground)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          padding: "var(--space-3)",
          resize: "vertical",
          lineHeight: "var(--leading-relaxed)",
          whiteSpace: "pre",
          overflowWrap: "normal",
          overflowX: "auto",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
