/**
 * CodeMirrorBodyEditor — CodeMirror 6 markdown body editor.
 *
 * Features:
 *   - Markdown + embedded YAML syntax highlighting
 *   - Theme via CSS custom properties (--color-editor-* tokens)
 *   - Line numbers, gutter, line wrapping, active line highlight
 *   - Cmd-S / Ctrl-S → onSave; Cmd-F → in-editor find
 *   - EditorView.contentAttributes for a11y (role="textbox" aria-multiline)
 *
 * DO NOT import @codemirror/theme-one-dark — use Tailwind design tokens only.
 *
 * Story: 6.4 — Skill Detail + Skill Editor (FR-004)
 */

import * as React from "react";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { search, searchKeymap } from "@codemirror/search";

// ---------------------------------------------------------------------------
// Token-driven theme
// ---------------------------------------------------------------------------

const zoeplaneTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--color-editor-background)",
    color: "var(--color-editor-foreground)",
    fontSize: "var(--text-mono-base)",
    fontFamily: "var(--font-mono)",
    height: "100%",
  },
  ".cm-content": {
    caretColor: "var(--color-editor-cursor)",
    padding: "var(--space-3) 0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--color-editor-cursor)",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--color-editor-cursor)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--color-editor-selection-background) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--color-editor-selection-background) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--color-editor-active-line-background)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-editor-gutter-background)",
    color: "var(--color-editor-gutter-foreground)",
    border: "none",
    borderRight: "1px solid var(--color-border)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--color-editor-active-line-background)",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 var(--space-3)",
    minWidth: "2.5rem",
  },
  // Search panel
  ".cm-search": {
    backgroundColor: "var(--color-surface-raised)",
    borderTop: "1px solid var(--color-border)",
    padding: "var(--space-2) var(--space-3)",
  },
  // Markdown syntax highlights
  ".cm-header": {
    color: "var(--color-editor-syntax-heading)",
    fontWeight: "var(--weight-semibold)",
  },
  ".cm-em": { color: "var(--color-editor-syntax-emphasis)", fontStyle: "italic" },
  ".cm-code": { color: "var(--color-editor-syntax-code)", fontFamily: "var(--font-mono)" },
  ".cm-link": { color: "var(--color-editor-syntax-link)" },
  // Error markers
  ".cm-lintRange-error": {
    borderBottom: `2px solid var(--color-editor-error-marker)`,
    backgroundColor: "var(--color-editor-error-marker-background)",
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CodeMirrorBodyEditorProps {
  /** Markdown body content (controlled). */
  value: string;
  /** Called when the editor content changes. */
  onChange: (value: string) => void;
  /** Called when Cmd-S / Ctrl-S is pressed. */
  onSave?: () => void;
  /** When true, disables editing (still allows selection). */
  readOnly?: boolean;
  /** Accessible label for the editor region. */
  ariaLabel?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CodeMirrorBodyEditor — a thin wrapper around CodeMirror 6's EditorView.
 *
 * Uses an imperative approach: the EditorView is created once on mount and
 * kept in sync via transactions when the `value` prop changes externally.
 */
export function CodeMirrorBodyEditor({
  value,
  onChange,
  onSave,
  readOnly = false,
  ariaLabel = "Skill markdown body",
  className,
}: CodeMirrorBodyEditorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  // Track the last value we set programmatically to avoid spurious onChange calls
  const lastExternalValue = React.useRef<string>(value);
  // Compartment for dynamic readOnly reconfiguration
  const readOnlyCompartment = React.useRef(new Compartment());
  // Ref for onSave — declared before the mount effect so the keymap closure
  // captures the ref object (stable identity) rather than the mount-time prop
  // value. Updated after every render via the effect below.
  const onSaveRef = React.useRef(onSave);

  // On mount: create EditorView
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        run: () => {
          onSaveRef.current?.();
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: value,
      extensions: [
        // Language support
        markdown({ addKeymap: true }),
        yaml(),
        // Layout
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        // History (undo/redo)
        history(),
        // Keymaps
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        saveKeymap,
        // Search
        search({ top: false }),
        // Theme
        zoeplaneTheme,
        // Accessibility attributes on the content DOM node
        EditorView.contentAttributes.of({
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": ariaLabel,
        }),
        // Read-only extension (wrapped in compartment for dynamic reconfiguration)
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
        // onChange listener
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            lastExternalValue.current = newValue;
            onChange(newValue);
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: container });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Intentional empty deps: CodeMirror view is created once on mount.
    // Prop changes (value, readOnly) are synced via separate effects below.
  }, []);

  // Keep editor in sync when external value changes (e.g. initial load)
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    if (lastExternalValue.current === value) return;

    // External change: replace the doc without triggering onChange recursion
    lastExternalValue.current = value;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  // Update readOnly when prop changes
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  // Keep onSaveRef.current fresh after every render (no deps — runs every time)
  React.useEffect(() => {
    onSaveRef.current = onSave;
  });

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        minHeight: "320px",
        height: "calc(100vh - 320px)",
        maxHeight: "800px",
        overflow: "hidden",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius)",
      }}
    />
  );
}
