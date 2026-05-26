/**
 * FrontMatterForm — structured editor for skill front-matter fields.
 *
 * Two modes:
 *   - read: renders a semantic <dl> list of fields (read-only)
 *   - edit: renders labeled form fields with inline per-field validation
 *
 * Field schema (skills v1 per ux-spec §7.6 Section 1):
 *   name         — required; letters/digits/hyphens; ≤64 chars
 *   description  — recommended; ≤256 chars
 *   version      — recommended; soft semver-ish validation
 *   voice_id     — optional; length 5-32 if present
 *   voice_name   — optional; ≤64 chars if present
 *   color        — optional; #rrggbb hex OR free-form palette token
 *   model        — optional; free-form
 *   unknown fields — preserved verbatim; read-only in edit mode
 *
 * Critical invariant: unknown fields (e.g. `tools: [Bash, Read]`) MUST be
 * preserved through any edit/save cycle without modification.
 *
 * Story: 6.4 — Skill Detail + Skill Editor (FR-003, FR-004, FR-005)
 */

import * as React from "react";
import {
  FormField,
  FormLabel,
  FormControl,
  FormHelperText,
  FormErrorText,
} from "../FormField/FormField";
import { Input } from "../Input/Input";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Known fields that this form renders as interactive controls. */
export interface SkillFrontMatter {
  name?: string;
  description?: string;
  version?: string;
  voice_id?: string;
  voice_name?: string;
  color?: string;
  model?: string;
  /** Any fields not in the known set — preserved verbatim. */
  [key: string]: unknown;
}

export interface FrontMatterErrors {
  name?: string;
  description?: string;
  version?: string;
  voice_id?: string;
  voice_name?: string;
  color?: string;
  model?: string;
}

export interface FrontMatterFormProps {
  /** Current front-matter values. Unknown fields are preserved. */
  value: SkillFrontMatter;
  /** Controlled mode: called on every field change in edit mode. */
  onChange?: (updated: SkillFrontMatter) => void;
  /** "read" renders a semantic <dl>; "edit" renders form inputs. */
  mode: "read" | "edit";
  /** Per-field validation errors for edit mode. */
  errors?: FrontMatterErrors;
  /** Whether to disable all inputs (e.g. during save). */
  disabled?: boolean;
  /**
   * id of the heading that labels this form section.
   * Used for aria-labelledby on the <form> element.
   */
  labelledById?: string;
  /** Refs map — populated by FrontMatterForm for focus management (AC4). */
  fieldRefs?: Partial<Record<keyof FrontMatterErrors, React.RefObject<HTMLInputElement | null>>>;
  className?: string;
}

// ---------------------------------------------------------------------------
// Known field keys (order-preserving for serialization)
// ---------------------------------------------------------------------------

const KNOWN_FIELDS: readonly (keyof FrontMatterErrors)[] = [
  "name",
  "description",
  "version",
  "voice_id",
  "voice_name",
  "color",
  "model",
];

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

// Claude Code skills ship with both kebab-case (`code-reviewer`) and
// CapitalCase (`CORE`, `Orchestration`) names — both are valid on disk and
// the editor must round-trip either without rejecting existing values.
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Validate all known fields and return a map of error messages.
 * Returns an empty object when all fields are valid.
 */
export function validateFrontMatter(data: SkillFrontMatter): FrontMatterErrors {
  const errors: FrontMatterErrors = {};

  // name — required
  const name = data.name?.trim() ?? "";
  if (!name) {
    errors.name = "Name is required.";
  } else if (!NAME_RE.test(name)) {
    errors.name = "Name may contain letters, digits, and hyphens (e.g. my-skill or CORE).";
  } else if (name.length > 64) {
    errors.name = "Name must be 64 characters or fewer.";
  }

  // description — ≤256 chars
  const description = data.description ?? "";
  if (typeof description === "string" && description.length > 256) {
    errors.description = "Description must be 256 characters or fewer.";
  }

  // version — soft semver warning
  const version = data.version ?? "";
  if (typeof version === "string" && version.length > 0 && !SEMVER_RE.test(version)) {
    errors.version = "Version should follow semver format (e.g. 1.0.0).";
  }

  // voice_id — optional; length 5–32 if present
  const voice_id = data.voice_id ?? "";
  if (typeof voice_id === "string" && voice_id.length > 0) {
    if (voice_id.length < 5 || voice_id.length > 32) {
      errors.voice_id = "Voice ID must be between 5 and 32 characters.";
    }
  }

  // voice_name — optional; ≤64 chars if present
  const voice_name = data.voice_name ?? "";
  if (typeof voice_name === "string" && voice_name.length > 64) {
    errors.voice_name = "Voice name must be 64 characters or fewer.";
  }

  // color — optional; hex or free-form token
  const color = data.color ?? "";
  if (typeof color === "string" && color.length > 0) {
    // Allow #rrggbb hex OR any non-empty string (free-form token)
    if (color.startsWith("#") && !HEX_COLOR_RE.test(color)) {
      errors.color = "Color must be a 6-digit hex value (e.g. #1a2b3c).";
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Read mode — semantic <dl>
// ---------------------------------------------------------------------------

interface ReadFieldProps {
  label: string;
  value: unknown;
  mono?: boolean;
}

function ReadField({ label, value, mono = false }: ReadFieldProps) {
  const isEmpty = value === undefined || value === null || value === "";
  const displayValue =
    typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <dt
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-foreground-muted)",
          fontWeight: "var(--weight-medium)",
          lineHeight: "var(--leading-snug)",
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          fontSize: "var(--text-base)",
          color: isEmpty ? "var(--color-foreground-subtle)" : "var(--color-foreground)",
          fontStyle: isEmpty ? "italic" : "normal",
          margin: 0,
          fontFamily: mono ? "var(--font-mono)" : undefined,
          whiteSpace: mono ? "pre-wrap" : undefined,
          wordBreak: mono ? "break-all" : undefined,
        }}
      >
        {isEmpty ? "Not set" : displayValue}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit mode — FormField + Input per known field
// ---------------------------------------------------------------------------

interface EditFieldProps {
  fieldKey: keyof FrontMatterErrors;
  label: string;
  helperText?: string;
  required?: boolean;
  error?: string;
  value: string;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (val: string) => void;
  onBlur?: () => void;
}

function EditField({
  fieldKey,
  label,
  helperText,
  required = false,
  error,
  value,
  disabled,
  inputRef,
  onChange,
  onBlur,
}: EditFieldProps) {
  return (
    <FormField required={required} error={error}>
      <FormLabel>{label}</FormLabel>
      <FormControl asChild>
        <Input
          ref={inputRef as React.Ref<HTMLInputElement>}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          onBlur={onBlur}
          className={cn(error ? "border-danger" : undefined)}
          data-field={fieldKey}
        />
      </FormControl>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
      {error && <FormErrorText>{error}</FormErrorText>}
    </FormField>
  );
}

// ---------------------------------------------------------------------------
// FrontMatterForm
// ---------------------------------------------------------------------------

/**
 * FrontMatterForm — renders skill front-matter as a labeled form or read list.
 *
 * Unknown fields (outside the known schema) are always preserved:
 *   - Read mode: displayed as read-only monospace key/value rows
 *   - Edit mode: displayed in a collapsed "Other fields" disclosure as read-only
 */
export function FrontMatterForm({
  value,
  onChange,
  mode,
  errors = {},
  disabled = false,
  labelledById,
  fieldRefs,
  className,
}: FrontMatterFormProps) {
  // Separate known from unknown fields
  const unknownFields = Object.entries(value).filter(
    ([k]) => !(KNOWN_FIELDS as readonly string[]).includes(k),
  );

  function handleChange(field: keyof FrontMatterErrors, val: string) {
    if (onChange) {
      onChange({ ...value, [field]: val });
    }
  }

  function handleBlur(_field: keyof FrontMatterErrors) {
    // Blur tracking is reserved for future per-field real-time validation;
    // currently validation runs only on save-attempt (parent sets errors prop).
  }

  // Show errors only for fields that have been blurred (or all fields when
  // errors are explicitly set by parent — save attempt).
  // Parent-supplied errors always show. Blur-gated errors are used for real-time feedback.
  function fieldError(field: keyof FrontMatterErrors): string | undefined {
    return errors[field];
  }

  const str = (v: unknown): string =>
    typeof v === "string" ? v : v === undefined || v === null ? "" : String(v);

  // ── Read mode ──────────────────────────────────────────────────────────────

  if (mode === "read") {
    return (
      <dl className={cn("flex flex-col", className)} style={{ gap: "var(--space-3)" }}>
        {/* Identity group */}
        <ReadField label="Name" value={value.name} />
        <ReadField label="Description" value={value.description} />

        {/* Version group */}
        <ReadField label="Version" value={value.version} />

        {/* Voice & model group */}
        {value.voice_id || value.voice_name || value.model || value.color ? (
          <>
            <ReadField label="Voice ID" value={value.voice_id} />
            <ReadField label="Voice Name" value={value.voice_name} />
            <ReadField label="Model" value={value.model} />
            <ReadField label="Color" value={value.color} />
          </>
        ) : null}

        {/* Unknown fields — read-only monospace */}
        {unknownFields.length > 0 && (
          <details>
            <summary
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-foreground-muted)",
                cursor: "pointer",
                userSelect: "none",
                padding: "var(--space-1) 0",
              }}
            >
              Other fields ({unknownFields.length})
            </summary>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                marginTop: "var(--space-2)",
              }}
            >
              {unknownFields.map(([k, v]) => (
                <ReadField key={k} label={k} value={v} mono />
              ))}
            </div>
          </details>
        )}
      </dl>
    );
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────

  return (
    <form
      aria-labelledby={labelledById}
      className={cn("flex flex-col", className)}
      style={{ gap: "var(--space-4)" }}
      onSubmit={(e) => {
        e.preventDefault();
      }}
      noValidate
    >
      {/* Identity group */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <EditField
          fieldKey="name"
          label="Name"
          helperText="Letters, digits, and hyphens. e.g. my-skill or CORE. Max 64 characters."
          required
          error={fieldError("name")}
          value={str(value.name)}
          disabled={disabled}
          inputRef={fieldRefs?.name}
          onChange={(v) => {
            handleChange("name", v);
          }}
          onBlur={() => {
            handleBlur("name");
          }}
        />
        <EditField
          fieldKey="description"
          label="Description"
          helperText="A short summary shown in the Skills library. Max 256 characters."
          error={fieldError("description")}
          value={str(value.description)}
          disabled={disabled}
          inputRef={fieldRefs?.description}
          onChange={(v) => {
            handleChange("description", v);
          }}
          onBlur={() => {
            handleBlur("description");
          }}
        />
      </div>

      {/* Version group */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <EditField
          fieldKey="version"
          label="Version"
          helperText="Semantic version, e.g. 1.0.0."
          error={fieldError("version")}
          value={str(value.version)}
          disabled={disabled}
          inputRef={fieldRefs?.version}
          onChange={(v) => {
            handleChange("version", v);
          }}
          onBlur={() => {
            handleBlur("version");
          }}
        />
      </div>

      {/* Voice & model group — collapsed disclosure */}
      <details>
        <summary
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-foreground-muted)",
            cursor: "pointer",
            userSelect: "none",
            padding: "var(--space-1) 0",
          }}
        >
          Voice &amp; model (optional)
        </summary>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            marginTop: "var(--space-3)",
          }}
        >
          <EditField
            fieldKey="voice_id"
            label="Voice ID"
            helperText="ElevenLabs voice ID. 5–32 characters."
            error={fieldError("voice_id")}
            value={str(value.voice_id)}
            disabled={disabled}
            inputRef={fieldRefs?.voice_id}
            onChange={(v) => {
              handleChange("voice_id", v);
            }}
            onBlur={() => {
              handleBlur("voice_id");
            }}
          />
          <EditField
            fieldKey="voice_name"
            label="Voice Name"
            helperText="Human-readable voice label. Max 64 characters."
            error={fieldError("voice_name")}
            value={str(value.voice_name)}
            disabled={disabled}
            inputRef={fieldRefs?.voice_name}
            onChange={(v) => {
              handleChange("voice_name", v);
            }}
            onBlur={() => {
              handleBlur("voice_name");
            }}
          />
          <EditField
            fieldKey="model"
            label="Model"
            helperText="Model override for this skill."
            error={fieldError("model")}
            value={str(value.model)}
            disabled={disabled}
            inputRef={fieldRefs?.model}
            onChange={(v) => {
              handleChange("model", v);
            }}
            onBlur={() => {
              handleBlur("model");
            }}
          />
          <EditField
            fieldKey="color"
            label="Color"
            helperText="6-digit hex (#1a2b3c) or palette token name."
            error={fieldError("color")}
            value={str(value.color)}
            disabled={disabled}
            inputRef={fieldRefs?.color}
            onChange={(v) => {
              handleChange("color", v);
            }}
            onBlur={() => {
              handleBlur("color");
            }}
          />
        </div>
      </details>

      {/* Unknown fields — always read-only even in edit mode */}
      {unknownFields.length > 0 && (
        <details>
          <summary
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-foreground-muted)",
              cursor: "pointer",
              userSelect: "none",
              padding: "var(--space-1) 0",
            }}
          >
            Other fields ({unknownFields.length}) — read-only
          </summary>
          <dl
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
              marginTop: "var(--space-2)",
            }}
          >
            {unknownFields.map(([k, v]) => (
              <ReadField key={k} label={k} value={v} mono />
            ))}
          </dl>
        </details>
      )}
    </form>
  );
}
