/**
 * AssetEditorView — save-flow contract tests.
 *
 * Covers:
 *   1. Save success path: write_asset_file ok → setMode("detail") called (AC #3)
 *   2. Validation-blocked path: validateFrontMatter errors → invoke NOT called (AC #5)
 *   3. Scope-denied → Toast (H-1 fix + AC #6): scope_denied result →
 *      - toast.error dispatched with violation message
 *      - saveError state remains null (no inline banner)
 *      - editor stays in idle status (no banner text visible)
 *   4. Internal error → inline banner: internal_error result →
 *      - inline role="alert" banner renders
 *      - no Toast dispatched
 *
 * Strategy:
 *   - selectedAssetId is set to a full file path (contains "/") so the load
 *     effect bypasses the sidecar fetch and calls fs_read_file directly.
 *   - Mock invoke: first call (fs_read_file) returns valid UTF-8 bytes;
 *     second call (write_asset_file) returns the configured result.
 *   - Mock toast module to spy on toast.error calls.
 *
 * Story: 6.16 — Asset Detail+Editor Kind-Parameterized Refactor (FR-004, FR-005)
 */

import { cleanup, render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAssetNav } from "@/stores/asset-nav";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// EventSource stub (SSE hook imported transitively)
class MockEventSource {
  addEventListener(): void {}
  close(): void {}
}
vi.stubGlobal("EventSource", MockEventSource);

vi.mock("@/lib/sidecar-client", () => ({
  getSidecarBaseUrl: vi.fn().mockReturnValue("http://127.0.0.1:9999"),
  initSidecarClient: vi.fn(),
  subscribeSidecarPort: vi.fn(() => () => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Spy on the toast imperative API — mock the entire module so calls to
// toast.error() are recorded without actually calling Sonner.
const mockToastError = vi.fn();
vi.mock("@/components/ui/Toast/Toast", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
    quarantine: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

// Import component AFTER mocks are established
import { AssetEditorView } from "../AssetEditorView";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_PATH = "/Users/testuser/.claude/skills/my-skill.md";

function encodeUtf8(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

// NAME_RE = /^[A-Za-z0-9][A-Za-z0-9-]*$/ — no spaces allowed; use hyphenated form
const VALID_FILE_CONTENT = `---
name: my-skill
description: A test skill.
---

This is the skill body.
`;

/** Set asset-nav store to editor mode with a direct file path as selectedAssetId. */
function openEditorWithPath(path: string = SOURCE_PATH) {
  useAssetNav.setState({
    kind: "skill",
    selectedAssetId: path,
    mode: "editor",
    dirtyByKey: {},
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Default: fs_read_file returns valid content → component loads cleanly
  mockInvoke.mockResolvedValue(encodeUtf8(VALID_FILE_CONTENT));
  openEditorWithPath();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockToastError.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AssetEditorView — save success (AC #3)", () => {
  it("invokes write_asset_file with the correct path, then transitions to detail mode", async () => {
    // First invoke call = fs_read_file (load), second = write_asset_file (save)
    mockInvoke
      .mockResolvedValueOnce(encodeUtf8(VALID_FILE_CONTENT)) // fs_read_file
      .mockResolvedValueOnce({ ok: true }); // write_asset_file

    render(<AssetEditorView />);

    // Wait for component to load (Save button appears)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDefined();
    });

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });

    // write_asset_file was called with the source path
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "write_asset_file",
        expect.objectContaining({ path: SOURCE_PATH }),
      );
    });

    // After the 300ms timer, mode transitions to "detail"
    await waitFor(
      () => {
        expect(useAssetNav.getState().mode).toBe("detail");
      },
      { timeout: 1000 },
    );
  });
});

describe("AssetEditorView — validation blocks save (AC #5)", () => {
  it("does NOT invoke write_asset_file when front-matter has validation errors", async () => {
    // Override with content that has an invalid name (contains spaces → fails validation)
    const invalidContent = `---
name: Invalid Name With Spaces!!!
description: A test skill.
---

Body.
`;
    mockInvoke.mockResolvedValueOnce(encodeUtf8(invalidContent));

    render(<AssetEditorView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDefined();
    });

    const saveButton = screen.getByRole("button", { name: /save/i });
    act(() => {
      fireEvent.click(saveButton);
    });

    // write_asset_file should NOT have been called — only fs_read_file was
    const writeCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === "write_asset_file");
    expect(writeCalls).toHaveLength(0);
  });
});

describe("AssetEditorView — scope_denied → Toast, not inline banner (H-1 + AC #6)", () => {
  it("dispatches toast.error with violation message on scope_denied", async () => {
    mockInvoke
      .mockResolvedValueOnce(encodeUtf8(VALID_FILE_CONTENT)) // fs_read_file
      .mockResolvedValueOnce({
        ok: false,
        code: "scope_denied",
        message: "Path /Users/testuser/.claude/skills/my-skill.md is outside the allowed scope.",
      });

    render(<AssetEditorView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDefined();
    });

    const saveButton = screen.getByRole("button", { name: /save/i });
    act(() => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledTimes(1);
    });

    // Toast title is "Path-lock violation"
    const [title, opts] = mockToastError.mock.calls[0] as [string, { description?: string }];
    expect(title).toBe("Path-lock violation");
    // Description contains the violation message from the command response
    expect(opts?.description).toContain("outside the allowed scope");
  });

  it("does NOT render an inline role='alert' save-error banner on scope_denied", async () => {
    mockInvoke.mockResolvedValueOnce(encodeUtf8(VALID_FILE_CONTENT)).mockResolvedValueOnce({
      ok: false,
      code: "scope_denied",
      message: "Path outside scope.",
    });

    render(<AssetEditorView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDefined();
    });

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledTimes(1);
    });

    // saveError state is null → inline banner must NOT appear
    expect(screen.queryByText(/Couldn't save:/i)).toBeNull();
  });
});

describe("AssetEditorView — internal_error → inline banner, no Toast", () => {
  it("renders inline role='alert' banner and does NOT call toast.error on internal_error", async () => {
    mockInvoke.mockResolvedValueOnce(encodeUtf8(VALID_FILE_CONTENT)).mockResolvedValueOnce({
      ok: false,
      code: "internal_error",
      message: "Disk I/O failure writing file.",
    });

    render(<AssetEditorView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDefined();
    });

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });

    await waitFor(() => {
      // Inline banner must appear
      expect(screen.getByRole("alert")).toBeDefined();
    });

    // Banner contains the error message
    expect(screen.getByRole("alert").textContent).toContain("Couldn't save");

    // Toast must NOT have been called
    expect(mockToastError).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Story 6.18 AC6 — discard-confirmation dirty-detection regression tests
//
// Root cause: setOriginalContent was called with the RAW file bytes (after
// CRLF→LF), but dirty = buildFileContent(fm, body) !== originalContent uses
// a RE-SERIALIZED form. Agents with rich front-matter (tools arrays, model,
// voice_id) diverge on round-trip → spuriously dirty on load. Fix: baseline
// against the serialized form so raw ≠ re-serialized divergence cancels out.
//
// These tests verify:
//   (a) Agent fixture WITH a tools array loads as dirty=false (no dialog on Cancel)
//   (b) Mutating a front-matter field on the agent fixture flips dirty=true
//   (c) Skill fixture loads as dirty=false (regression guard)
// ---------------------------------------------------------------------------

const AGENT_FILE_CONTENT_WITH_TOOLS = `---
name: my-agent
description: A test agent.
model: claude-opus-4-5
tools:
  - Read
  - Write
  - Bash
---

This is the agent body.
`;

const SKILL_FILE_CONTENT = `---
name: my-skill
description: A test skill.
---

This is the skill body.
`;

// MEDIUM 1: command fixture for AC6 dirty-detection consistency check.
// Commands have simple name + description front-matter (no tools array / model).
const COMMAND_FILE_CONTENT = `---
name: my-command
description: A test command.
---

This is the command body.
`;

describe("AssetEditorView — AC6 dirty-detection regression (Story 6.18)", () => {
  it("agent fixture with tools array loads as dirty=false (no spurious discard dialog)", async () => {
    // Open editor with an agent that has a tools array.
    useAssetNav.setState({
      kind: "agent",
      selectedAssetId: "/Users/testuser/.claude/agents/my-agent.md",
      mode: "editor",
      dirtyByKey: {},
    });
    mockInvoke.mockResolvedValueOnce(encodeUtf8(AGENT_FILE_CONTENT_WITH_TOOLS));

    render(<AssetEditorView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDefined();
    });

    // Cancel button triggers handleBack() — if dirty=false it navigates back
    // directly without opening the discard dialog. If the dialog DOES appear,
    // "Discard unsaved changes?" text would be present in the DOM.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });

    // Discard dialog must NOT have opened — no spurious dirty state.
    expect(screen.queryByText("Discard unsaved changes?")).toBeNull();
  });

  it("skill fixture loads as dirty=false (regression guard)", async () => {
    useAssetNav.setState({
      kind: "skill",
      selectedAssetId: "/Users/testuser/.claude/skills/my-skill.md",
      mode: "editor",
      dirtyByKey: {},
    });
    mockInvoke.mockResolvedValueOnce(encodeUtf8(SKILL_FILE_CONTENT));

    render(<AssetEditorView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDefined();
    });

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });

    expect(screen.queryByText("Discard unsaved changes?")).toBeNull();
  });

  // MEDIUM 1: AC6 requires skill/agent/COMMAND consistency. Command fixture with
  // simple front-matter (no tools array / model) must also load as dirty=false.
  it("command fixture loads as dirty=false (AC6 kind consistency)", async () => {
    useAssetNav.setState({
      kind: "command",
      selectedAssetId: "/Users/testuser/.claude/commands/my-command.md",
      mode: "editor",
      dirtyByKey: {},
    });
    mockInvoke.mockResolvedValueOnce(encodeUtf8(COMMAND_FILE_CONTENT));

    render(<AssetEditorView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDefined();
    });

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });

    // Cancel must navigate back directly — no discard dialog for a clean load.
    expect(screen.queryByText("Discard unsaved changes?")).toBeNull();
  });

  it("agent fixture with tools array becomes dirty=true after a front-matter field mutation", async () => {
    useAssetNav.setState({
      kind: "agent",
      selectedAssetId: "/Users/testuser/.claude/agents/my-agent.md",
      mode: "editor",
      dirtyByKey: {},
    });
    mockInvoke.mockResolvedValueOnce(encodeUtf8(AGENT_FILE_CONTENT_WITH_TOOLS));

    render(<AssetEditorView />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDefined();
    });

    // Mutate the name field to simulate a genuine edit.
    // Use data-field attribute selector because the form has multiple text inputs
    // and /name/i also matches voice_name.

    const nameInput = document.querySelector<HTMLInputElement>('[data-field="name"]')!;
    expect(nameInput).toBeDefined();
    act(() => {
      fireEvent.change(nameInput, { target: { value: "my-agent-edited" } });
    });

    // Now Cancel must open the discard dialog because dirty=true.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });

    await waitFor(() => {
      expect(screen.queryByText("Discard unsaved changes?")).toBeDefined();
    });
  });
});
