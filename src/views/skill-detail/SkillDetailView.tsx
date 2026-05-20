/**
 * SkillDetailView — read-mode view for a single skill.
 *
 * Layout:
 *   Header (sticky): ← Back | <h1>name</h1> | [Reveal (disabled)] [Edit]
 *   FrontMatterForm (read mode)
 *   Rendered markdown body (react-markdown)
 *
 * States:
 *   loading  — 2-boundary skeleton (loading-architecture.md §skills.detail)
 *   populated — header + front-matter + markdown body
 *   empty     — header + front-matter + "no body content" note
 *   error (file not found) — LibraryStatePanel error variant
 *   error (parse failure)  — LibraryStatePanel with "Edit raw" action
 *   file deleted while viewing — soft banner top
 *
 * Deviations from ux-spec §7.6 (operator-approved):
 *   1. Layout: stacked single-column (NOT two-pane)
 *   2. "Reveal in Finder" disabled with "Coming soon" tooltip (scope Story 6.9)
 *
 * Story: 6.4 — Skill Detail + Skill Editor (FR-003)
 */

import * as React from "react";
import ReactMarkdown from "react-markdown";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/Button/Button";
import { Icon } from "@/components/ui/Icon/Icon";
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip/Tooltip";
import { FrontMatterForm } from "@/components/ui/FrontMatterForm/FrontMatterForm";
import type { SkillFrontMatter } from "@/components/ui/FrontMatterForm/FrontMatterForm";
import { useSkillNav } from "@/stores/skill-nav";
import { SkillDetailLoadingSkeleton } from "./loading-skeleton";
import type { AssetSummary } from "@zoeplane/shared-types";
import { getSidecarBaseUrl } from "@/lib/sidecar-client";

// ---------------------------------------------------------------------------
// Front-matter parsing helper (thin wrapper around gray-matter-compatible read)
// ---------------------------------------------------------------------------

/**
 * Parse a skill file's content into { frontMatter, body }.
 * Returns null if the file has no front-matter delimiters.
 */
function parseSkillContent(raw: string): { frontMatter: SkillFrontMatter; body: string } | null {
  // CRLF → LF at entry (feedback_text_content_crlf_normalize.md)
  const normalized = raw.replace(/\r\n/g, "\n");

  const FM_RE = /^---\s*\n([\s\S]*?)---\s*\n?([\s\S]*)$/;
  const match = normalized.match(FM_RE);
  if (!match) return null;

  const yamlBlock = match[1] ?? "";
  const body = match[2] ?? "";

  // Parse YAML using a simple key-value approach that preserves unknown fields
  // For display purposes we parse the raw YAML block ourselves here.
  // The sidecar already has the parsed front_matter_json via the assets API;
  // here we parse the raw file for the editor flow.
  let frontMatter: SkillFrontMatter = {};
  try {
    // Use the stored front_matter_json from the asset if available (set by caller).
    // If not, do a best-effort simple parse for display.
    // The full three-tier parsing lives in the sidecar.
    // Simple line-by-line parse for scalar top-level fields:
    const lines = yamlBlock.split("\n");
    for (const line of lines) {
      const m = line.match(/^([a-zA-Z_-]+):\s+(.+)$/);
      if (m && m[1] && m[2]) {
        let val: unknown = m[2].trim();
        // Strip quotes
        if (
          (typeof val === "string" && val.startsWith('"') && val.endsWith('"')) ||
          (typeof val === "string" && val.startsWith("'") && val.endsWith("'"))
        ) {
          val = (val as string).slice(1, -1);
        }
        frontMatter[m[1]] = val;
      }
    }
  } catch {
    // If parsing fails, return empty front-matter
    frontMatter = {};
  }

  return { frontMatter, body: body.trim() };
}

// ---------------------------------------------------------------------------
// SkillDetailView
// ---------------------------------------------------------------------------

const DETAIL_HEADING_ID = "skill-detail-heading";

export function SkillDetailView(): React.JSX.Element {
  const { selectedSkillId, edit, back } = useSkillNav();

  // Asset data fetched from sidecar OR passed down via TanStack Query cache
  // For simplicity, we refetch from the assets API using the selectedSkillId
  const [asset, setAsset] = React.useState<AssetSummary | null>(null);
  const [parsed, setParsed] = React.useState<{
    frontMatter: SkillFrontMatter;
    body: string;
  } | null>(null);
  const [loadState, setLoadState] = React.useState<
    "loading" | "loaded" | "error-not-found" | "error-parse"
  >("loading");
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [deletedWhileViewing, setDeletedWhileViewing] = React.useState(false);

  // Cmd-E keyboard shortcut: enter editor while detail is mounted
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        edit();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [edit]);

  // Load the skill file via fs_read_file (Tauri command)
  React.useEffect(() => {
    if (!selectedSkillId) {
      setLoadState("error-not-found");
      return;
    }

    setLoadState("loading");
    setDeletedWhileViewing(false);

    void (async () => {
      try {
        // Use local variables — do NOT read React state after an await.
        // The `asset` state variable is still null from the render that registered
        // this effect; reading it after the fetch would be a stale-closure bug.
        let resolvedPath: string | null = selectedSkillId.includes("/")
          ? selectedSkillId // looks like a path already
          : null;
        let resolvedAsset: AssetSummary | null = null;

        // Fetch the asset summary to resolve the sourcePath (UUID → path mapping)
        if (!resolvedPath) {
          const baseUrl = getSidecarBaseUrl();
          if (baseUrl) {
            const res = await fetch(`${baseUrl}/assets?kind=skill&scope=global`);
            if (res.ok) {
              const data = (await res.json()) as { assets: AssetSummary[] };
              const found = data.assets.find((a) => a.id === selectedSkillId);
              if (found) {
                resolvedAsset = found;
                resolvedPath = found.sourcePath;
                setAsset(found); // still set state so the template can render the name
              }
            }
          }
        }

        if (!resolvedPath) {
          setLoadState("error-not-found");
          return;
        }

        const bytes = await invoke<number[]>("fs_read_file", {
          path: resolvedPath,
          caller: "SkillDetailView",
        });

        const text = new TextDecoder().decode(new Uint8Array(bytes));

        const parseResult = parseSkillContent(text);
        if (!parseResult) {
          setParseError("Could not parse front-matter delimiters.");
          setLoadState("error-parse");
          return;
        }

        // Merge front_matter_json from sidecar (richer parse) if available
        if (resolvedAsset?.frontMatter) {
          const mergedFm: SkillFrontMatter = {
            ...parseResult.frontMatter,
            ...(resolvedAsset.frontMatter as SkillFrontMatter),
          };
          setParsed({ frontMatter: mergedFm, body: parseResult.body });
        } else {
          setParsed(parseResult);
        }

        setLoadState("loaded");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes("path not allowed") ||
          msg.includes("not found") ||
          msg.includes("No such")
        ) {
          setLoadState("error-not-found");
        } else {
          setParseError(msg);
          setLoadState("error-parse");
        }
      }
    })();
  }, [selectedSkillId]);

  // ── Render: loading ────────────────────────────────────────────────────────
  if (loadState === "loading") {
    return <SkillDetailLoadingSkeleton />;
  }

  // ── Render: error — file not found ─────────────────────────────────────────
  if (loadState === "error-not-found") {
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
          name="file"
          size="lg"
          aria-hidden
          style={{ color: "var(--color-foreground-muted)" }}
        />
        <p style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)" }}>
          Skill file not found
        </p>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)" }}>
          Couldn&apos;t read the skill file. It may have been moved or deleted.
        </p>
        <Button variant="secondary" size="sm" onClick={back}>
          Back to Skills
        </Button>
      </div>
    );
  }

  // ── Render: error — parse failure ──────────────────────────────────────────
  if (loadState === "error-parse") {
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
          Couldn&apos;t parse skill front-matter
        </p>
        {parseError && (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-foreground-muted)",
              textAlign: "center",
            }}
          >
            {parseError}
          </p>
        )}
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button variant="default" size="sm" onClick={edit}>
            Edit raw
          </Button>
          <Button variant="secondary" size="sm" onClick={back}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: populated ──────────────────────────────────────────────────────
  const skillName = parsed?.frontMatter?.name ?? asset?.name ?? "Untitled skill";

  return (
    <TooltipProvider>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Deleted-while-viewing banner */}
        {deletedWhileViewing && (
          <div
            role="alert"
            style={{
              padding: "var(--space-2) var(--space-4)",
              backgroundColor: "var(--color-warning-muted)",
              color: "var(--color-warning-foreground)",
              fontSize: "var(--text-sm)",
              borderBottom: "1px solid var(--color-warning)",
            }}
          >
            This file was deleted on disk. Your view is stale.
          </div>
        )}

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
          {/* Back */}
          <Button
            variant="ghost"
            size="sm"
            onClick={back}
            aria-label="Back to Skills"
            style={{ gap: "var(--space-1)" }}
          >
            <Icon name="chevron-left" size="sm" aria-hidden />
            Skills
          </Button>

          {/* Skill name heading */}
          <h1
            id={DETAIL_HEADING_ID}
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

          {/* Reveal in Finder — disabled, "Coming soon" (operator deviation #3) */}
          <TooltipRoot>
            <TooltipTrigger asChild>
              <span tabIndex={0} style={{ display: "inline-flex" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled
                  aria-label="Reveal in Finder (coming soon)"
                >
                  <Icon name="folder-open" size="sm" aria-hidden />
                  Reveal
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </TooltipRoot>

          {/* Edit */}
          <Button variant="default" size="sm" onClick={edit}>
            Edit
          </Button>
        </header>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--space-6) var(--space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          {/* Front-matter (read mode) */}
          {parsed && (
            <section aria-labelledby="fm-section-heading">
              <h2
                id="fm-section-heading"
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--weight-semibold)",
                  color: "var(--color-foreground-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-wide)",
                  marginBottom: "var(--space-3)",
                }}
              >
                Properties
              </h2>
              <FrontMatterForm value={parsed.frontMatter} mode="read" />
            </section>
          )}

          {/* Markdown body */}
          {parsed && (
            <section aria-labelledby="body-section-heading">
              <h2
                id="body-section-heading"
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--weight-semibold)",
                  color: "var(--color-foreground-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-wide)",
                  marginBottom: "var(--space-3)",
                }}
              >
                Body
              </h2>
              {parsed.body.trim() === "" ? (
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-foreground-subtle)",
                    fontStyle: "italic",
                  }}
                >
                  This skill has no body content.
                </p>
              ) : (
                <div
                  style={{
                    fontSize: "var(--text-base)",
                    color: "var(--color-foreground)",
                    lineHeight: "var(--leading-relaxed)",
                  }}
                  className="skill-markdown-body"
                >
                  <ReactMarkdown>{parsed.body}</ReactMarkdown>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
