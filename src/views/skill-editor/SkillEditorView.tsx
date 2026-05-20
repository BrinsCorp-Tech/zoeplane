/**
 * SkillEditorView — edit mode for a single skill file.
 *
 * Layout:
 *   Header (sticky): ← Back | <h1>name</h1> | ● Modified | [Cancel] [Save]
 *   FrontMatterForm (edit mode)
 *   CodeMirror 6 body editor (with FallbackBodyEditor error boundary)
 *
 * Save flow (AC3):
 *   1. Run FrontMatterForm validation
 *   2. If invalid → block save, show summary alert, focus first invalid field
 *   3. If valid → invoke write_skill_file, on success → setMode("detail")
 *
 * Cancel flow: dirty check → alertdialog confirmation modal if dirty
 *
 * Deviations from ux-spec §7.6 (operator-approved):
 *   1. Layout: stacked single-column (NOT two-pane)
 *   2. Save button always enabled (NOT disabled-when-invalid) for a11y
 *   3. Known limitation (Story 6.5): sidebar-switch-while-dirty guard deferred
 *
 * Story: 6.4 — Skill Detail + Skill Editor (FR-004, FR-005)
 */

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/Button/Button";
import { Icon } from "@/components/ui/Icon/Icon";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import {
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/Modal/Modal";
import {
  FrontMatterForm,
  validateFrontMatter,
} from "@/components/ui/FrontMatterForm/FrontMatterForm";
import type {
  SkillFrontMatter,
  FrontMatterErrors,
} from "@/components/ui/FrontMatterForm/FrontMatterForm";
import { useSkillNav } from "@/stores/skill-nav";
import { getSidecarBaseUrl } from "@/lib/sidecar-client";
import type { AssetSummary } from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// Lazy CodeMirror import + error boundary fallback
// ---------------------------------------------------------------------------

const LazyCodeMirrorEditor = React.lazy(() =>
  import("@/components/editor/CodeMirrorBodyEditor").then((m) => ({
    default: m.CodeMirrorBodyEditor,
  })),
);

// FallbackBodyEditor is imported eagerly (it's the fallback)
import { FallbackBodyEditor } from "@/components/editor/FallbackBodyEditor";

// ---------------------------------------------------------------------------
// Serializer helper — reconstruct full file content from FM + body
// ---------------------------------------------------------------------------

/**
 * Lightweight front-matter serializer for the UI layer.
 *
 * Produces: ---\n<yaml>\n---\n<body>\n
 *
 * Uses simple key: value format for known fields; unknown fields with complex
 * values (arrays, objects) use JSON.stringify as fallback for safety.
 * The sidecar's gray-matter-based serializer is authoritative; this is used
 * only to produce content for the Tauri write command.
 */
function serializeFrontMatter(fm: SkillFrontMatter): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "string") {
      // Quote values that contain special YAML characters
      // Note: [] chars tested with indexOf to avoid useless-escape in character class
      const needsQuote =
        /[:{},#|>&*!'"@%]/.test(value) ||
        value.includes("[") ||
        value.includes("]") ||
        value.trim() !== value;
      lines.push(
        needsQuote
          ? `${key}: "${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
          : `${key}: ${value}`,
      );
    } else if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${String(item)}`);
      }
    } else if (typeof value === "object") {
      // Fallback for nested objects — YAML dump is complex, use JSON as safe override
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  return `---\n${lines.join("\n")}\n---\n`;
}

function buildFileContent(fm: SkillFrontMatter, body: string): string {
  // CRLF → LF normalize at entry (feedback_text_content_crlf_normalize.md)
  const normalizedBody = body.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  return serializeFrontMatter(fm) + normalizedBody + "\n";
}

// ---------------------------------------------------------------------------
// CodeMirror Error Boundary
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean;
}

class CodeMirrorErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Status indicator
// ---------------------------------------------------------------------------

type EditorStatus = "idle" | "modified" | "saving" | "saved";

function StatusChip({ status }: { status: EditorStatus }) {
  if (status === "idle") return null;

  if (status === "modified") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-1)",
          fontSize: "var(--text-sm)",
          color: "var(--color-warning)",
        }}
        aria-live="polite"
      >
        <span
          aria-hidden
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "var(--color-warning)",
            display: "inline-block",
          }}
        />
        Modified
      </span>
    );
  }

  if (status === "saving") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-1)",
          fontSize: "var(--text-sm)",
          color: "var(--color-foreground-muted)",
        }}
        aria-live="polite"
      >
        <Spinner size="xs" aria-hidden />
        Saving…
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-1)",
          fontSize: "var(--text-sm)",
          color: "var(--color-success)",
        }}
        aria-live="polite"
      >
        <Icon name="check" size="sm" aria-hidden />
        Saved
      </span>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// SkillEditorView
// ---------------------------------------------------------------------------

const EDITOR_HEADING_ID = "skill-editor-heading";

export function SkillEditorView(): React.JSX.Element {
  const { selectedSkillId, back, setMode } = useSkillNav();

  // ── State ──────────────────────────────────────────────────────────────────
  const [frontMatter, setFrontMatter] = React.useState<SkillFrontMatter>({});
  const [body, setBody] = React.useState<string>("");
  const [originalContent, setOriginalContent] = React.useState<string>("");
  const [sourcePath, setSourcePath] = React.useState<string | null>(null);
  const [loadState, setLoadState] = React.useState<"loading" | "loaded" | "error">("loading");
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [status, setStatus] = React.useState<EditorStatus>("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [validationErrors, setValidationErrors] = React.useState<FrontMatterErrors>({});
  const [showSummaryAlert, setShowSummaryAlert] = React.useState(false);

  const [confirmDiscardOpen, setConfirmDiscardOpen] = React.useState(false);
  const cancelButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const keepEditingRef = React.useRef<HTMLButtonElement | null>(null);

  // fieldRefs for focus management (AC4)
  const nameRef = React.useRef<HTMLInputElement | null>(null);
  const descriptionRef = React.useRef<HTMLInputElement | null>(null);
  const versionRef = React.useRef<HTMLInputElement | null>(null);
  const voice_idRef = React.useRef<HTMLInputElement | null>(null);
  const voice_nameRef = React.useRef<HTMLInputElement | null>(null);
  const colorRef = React.useRef<HTMLInputElement | null>(null);
  const modelRef = React.useRef<HTMLInputElement | null>(null);

  const fieldRefs: { [K in keyof FrontMatterErrors]: React.RefObject<HTMLInputElement | null> } = {
    name: nameRef,
    description: descriptionRef,
    version: versionRef,
    voice_id: voice_idRef,
    voice_name: voice_nameRef,
    color: colorRef,
    model: modelRef,
  };

  const dirty = React.useMemo(
    () => buildFileContent(frontMatter, body) !== originalContent,
    [frontMatter, body, originalContent],
  );

  // Update status chip based on dirty state
  React.useEffect(() => {
    if (status === "saving" || status === "saved") return;
    setStatus(dirty ? "modified" : "idle");
  }, [dirty, status]);

  // Clear "saved" status after 2s
  React.useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(() => {
      setStatus("idle");
    }, 2000);
    return () => {
      clearTimeout(t);
    };
  }, [status]);

  // Cmd-S global save shortcut
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [frontMatter, body, sourcePath]);

  // ── Load skill file ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!selectedSkillId) {
      setLoadState("error");
      setLoadError("No skill selected.");
      return;
    }

    setLoadState("loading");

    void (async () => {
      try {
        // Resolve source path
        let resolvedPath: string | null = selectedSkillId.includes("/") ? selectedSkillId : null;

        if (!resolvedPath) {
          const baseUrl = getSidecarBaseUrl();
          if (baseUrl) {
            const res = await fetch(`${baseUrl}/assets?kind=skill&scope=global`);
            if (res.ok) {
              const data = (await res.json()) as { assets: AssetSummary[] };
              const found = data.assets.find((a) => a.id === selectedSkillId);
              if (found) resolvedPath = found.sourcePath;
            }
          }
        }

        if (!resolvedPath) {
          setLoadState("error");
          setLoadError("Skill file path could not be resolved.");
          return;
        }

        setSourcePath(resolvedPath);

        const bytes = await invoke<number[]>("fs_read_file", {
          path: resolvedPath,
          caller: "SkillEditorView",
        });

        const text = new TextDecoder().decode(new Uint8Array(bytes));
        // CRLF → LF at entry
        const normalized = text.replace(/\r\n/g, "\n");
        setOriginalContent(normalized);

        // Parse into FM + body
        const FM_RE = /^---\s*\n([\s\S]*?)---\s*\n?([\s\S]*)$/;
        const match = normalized.match(FM_RE);
        const yamlBlock = match?.[1] ?? "";
        const bodyText = match?.[2] ?? normalized;

        // Parse front-matter (simple line-by-line for known fields + preserve unknown)
        const fm: SkillFrontMatter = {};
        const lines = yamlBlock.split("\n");
        let i = 0;
        while (i < lines.length) {
          const line = lines[i] ?? "";
          // Array value
          const arrayHeader = line.match(/^([a-zA-Z_-]+):\s*$/);
          if (arrayHeader && arrayHeader[1]) {
            const arrKey = arrayHeader[1];
            const items: string[] = [];
            i++;
            while (i < lines.length && (lines[i] ?? "").startsWith("  -")) {
              items.push((lines[i] ?? "").replace(/^\s+-\s+/, "").trim());
              i++;
            }
            fm[arrKey] = items;
            continue;
          }
          // Scalar value
          const scalar = line.match(/^([a-zA-Z_-]+):\s+(.+)$/);
          if (scalar && scalar[1] && scalar[2]) {
            let val: string = scalar[2].trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            fm[scalar[1]] = val;
          }
          i++;
        }

        setFrontMatter(fm);
        setBody(bodyText.trim());
        setLoadState("loaded");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setLoadState("error");
        setLoadError(msg);
      }
    })();
  }, [selectedSkillId]);

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    // Run validation
    const errors = validateFrontMatter(frontMatter);
    const errorCount = Object.keys(errors).length;

    if (errorCount > 0) {
      setValidationErrors(errors);
      setShowSummaryAlert(true);
      // AC4: focus first invalid field
      return;
    }

    if (!sourcePath) {
      setSaveError("Cannot save: source path unknown.");
      return;
    }

    setValidationErrors({});
    setShowSummaryAlert(false);
    setSaveError(null);
    setStatus("saving");

    const content = buildFileContent(frontMatter, body);

    try {
      type CommandResponse = { ok: boolean; code?: string; message?: string };
      const result = await invoke<CommandResponse>("write_skill_file", {
        path: sourcePath,
        content,
      });

      if (!result.ok) {
        throw new Error(result.message ?? result.code ?? "write_skill_file returned ok: false");
      }

      setOriginalContent(content);
      setStatus("saved");

      // Transition back to detail view after short delay
      setTimeout(() => {
        setMode("detail");
      }, 300);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
      setStatus("idle");
    }
  }

  // AC4: focus first invalid field when errors are set
  React.useEffect(() => {
    if (!showSummaryAlert) return;
    const ORDER: (keyof FrontMatterErrors)[] = [
      "name",
      "description",
      "version",
      "voice_id",
      "voice_name",
      "color",
      "model",
    ];
    for (const key of ORDER) {
      if (validationErrors[key] && fieldRefs[key]?.current) {
        fieldRefs[key].current?.focus();
        break;
      }
    }
  }, [showSummaryAlert, validationErrors]);

  // ── Back / Cancel ──────────────────────────────────────────────────────────
  function handleBack() {
    if (dirty) {
      setConfirmDiscardOpen(true);
    } else {
      back();
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loadState === "loading") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "var(--space-2)",
          color: "var(--color-foreground-muted)",
        }}
      >
        <Spinner size="sm" aria-label="Loading skill…" />
        <span style={{ fontSize: "var(--text-sm)" }}>Loading…</span>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "var(--space-3)",
          padding: "var(--space-6)",
        }}
      >
        <Icon
          name="alert-triangle"
          size="lg"
          aria-hidden
          style={{ color: "var(--color-warning)" }}
        />
        <p style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)" }}>
          Couldn&apos;t load skill
        </p>
        {loadError && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)" }}>
            {loadError}
          </p>
        )}
        <Button variant="secondary" size="sm" onClick={back}>
          Back to Skills
        </Button>
      </div>
    );
  }

  const skillName = (frontMatter.name as string | undefined) ?? "Untitled skill";

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Sticky header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid var(--color-border)",
            position: "sticky",
            top: 0,
            background: "var(--color-background)",
            zIndex: 1,
            flexShrink: 0,
          }}
        >
          <Button variant="ghost" size="sm" onClick={handleBack} aria-label="Back">
            <Icon name="chevron-left" size="sm" aria-hidden />
            Back
          </Button>

          <h1
            id={EDITOR_HEADING_ID}
            style={{
              flex: 1,
              fontSize: "var(--text-2xl)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--color-foreground)",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {skillName}
          </h1>

          {/* Status chip */}
          <StatusChip status={status} />

          {/* Cancel */}
          <Button ref={cancelButtonRef} variant="secondary" size="sm" onClick={handleBack}>
            Cancel
          </Button>

          {/* Save — always enabled (operator deviation #2) */}
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              void handleSave();
            }}
            disabled={status === "saving"}
            loading={status === "saving"}
          >
            Save
          </Button>
        </header>

        {/* Scrollable form + editor */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          {/* Validation summary alert (AC4) */}
          {showSummaryAlert && Object.keys(validationErrors).length > 0 && (
            <div
              role="alert"
              style={{
                padding: "var(--space-3) var(--space-4)",
                border: "1px solid var(--color-danger)",
                borderRadius: "var(--radius)",
                backgroundColor: "var(--color-danger-muted)",
                color: "var(--color-foreground)",
                fontSize: "var(--text-sm)",
              }}
            >
              <p style={{ fontWeight: "var(--weight-semibold)", marginBottom: "var(--space-2)" }}>
                Couldn&apos;t save — fix the highlighted fields and try again.
              </p>
              <ul style={{ margin: 0, paddingLeft: "var(--space-4)" }}>
                {Object.entries(validationErrors).map(([field, msg]) => (
                  <li key={field}>
                    {field}: {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Save error banner */}
          {saveError && (
            <div
              role="alert"
              style={{
                padding: "var(--space-3) var(--space-4)",
                border: "1px solid var(--color-danger)",
                borderRadius: "var(--radius)",
                backgroundColor: "var(--color-danger-muted)",
                color: "var(--color-foreground)",
                fontSize: "var(--text-sm)",
              }}
            >
              Couldn&apos;t save: {saveError}. Your changes are preserved.
            </div>
          )}

          {/* FrontMatterForm — edit mode */}
          <FrontMatterForm
            value={frontMatter}
            mode="edit"
            errors={showSummaryAlert ? validationErrors : {}}
            onChange={setFrontMatter}
            disabled={status === "saving"}
            labelledById={EDITOR_HEADING_ID}
            fieldRefs={fieldRefs}
          />

          {/* CodeMirror body editor with fallback */}
          <CodeMirrorErrorBoundary
            fallback={
              <FallbackBodyEditor
                value={body}
                onChange={setBody}
                onSave={() => {
                  void handleSave();
                }}
                readOnly={status === "saving"}
                ariaLabel="Skill markdown body"
              />
            }
          >
            <React.Suspense
              fallback={
                <div
                  style={{
                    minHeight: "320px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "var(--color-editor-background)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    color: "var(--color-foreground-muted)",
                    fontSize: "var(--text-sm)",
                    gap: "var(--space-2)",
                  }}
                >
                  <Spinner size="sm" aria-hidden />
                  Loading editor…
                </div>
              }
            >
              <LazyCodeMirrorEditor
                value={body}
                onChange={setBody}
                onSave={() => {
                  void handleSave();
                }}
                readOnly={status === "saving"}
                ariaLabel="Skill markdown body"
              />
            </React.Suspense>
          </CodeMirrorErrorBoundary>
        </div>
      </div>

      {/* Unsaved-changes confirmation modal */}
      <ModalRoot open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <ModalContent
          role="alertdialog"
          variant="destructive"
          size="sm"
          initialFocus={keepEditingRef}
        >
          <ModalHeader>
            <ModalTitle>Discard unsaved changes?</ModalTitle>
            <ModalDescription>
              Your edits to <strong>{skillName}</strong> will be lost.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button
              ref={keepEditingRef}
              variant="default"
              size="sm"
              onClick={() => {
                setConfirmDiscardOpen(false);
              }}
            >
              Keep editing
            </Button>
            <Button
              variant="ghost"
              size="sm"
              style={{ color: "var(--color-danger)" }}
              onClick={() => {
                setConfirmDiscardOpen(false);
                back();
              }}
            >
              Discard
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </>
  );
}
