/**
 * LibraryStatePanel — unit tests for LibraryEmptyPanel and LibraryErrorPanel.
 *
 * Covers (per AC #8):
 *   (a) Renders with required props
 *   (b) Shows inline role="alert" aria-live error when reveal action fails
 *   (c) Clears inline alert on retry
 *   (d) Renders learn-more anchor when prop is provided (LibraryEmptyPanel only)
 *   (e) Does not render alert when reveal succeeds
 *   (f) Calls homeDir() + join() with the provided directory segments
 *   + onRetry callback fires correctly (LibraryErrorPanel)
 *   + DEV console.error fires on reveal failure
 *
 * Mock strategy: mock @tauri-apps/api/core and @tauri-apps/api/path directly.
 * No real Tauri runtime available in JSDOM.
 *
 * Story: 6.13 — Library empty/error state extraction
 */

import { cleanup, render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryEmptyPanel, LibraryErrorPanel } from "../LibraryStatePanel";
import type { LibraryEmptyPanelProps, LibraryErrorPanelProps } from "../LibraryStatePanel";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/path", () => ({
  homeDir: vi.fn().mockResolvedValue("/Users/testuser"),
  join: vi.fn((...parts: string[]) => Promise.resolve(parts.join("/"))),
}));

import { invoke } from "@tauri-apps/api/core";
import { homeDir, join } from "@tauri-apps/api/path";
const mockInvoke = vi.mocked(invoke);
const mockHomeDir = vi.mocked(homeDir);
const mockJoin = vi.mocked(join);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPTY_DEFAULTS: LibraryEmptyPanelProps = {
  icon: "folder-open",
  iconColor: "[color:var(--color-foreground-subtle)]",
  heading: "No agents found",
  body: "Drop an agent definition file to see it here.",
  ariaLabel: "No agents found",
  primaryActionLabel: "Open ~/.claude/agents/ in Finder",
  revealDirSegments: [".claude", "agents"],
  revealErrorMessage: "Couldn't open ~/.claude/agents/ — directory may not exist yet.",
  learnMoreUrl: "https://docs.claude.com/en/docs/claude-code/sub-agents",
  learnMoreLabel: "Learn how to author an agent →",
};

const ERROR_DEFAULTS: LibraryErrorPanelProps = {
  icon: "alert-circle",
  iconColor: "[color:var(--color-danger)]",
  heading: "Couldn't load agents",
  body: "The sidecar didn't return a response.",
  ariaLabel: "Error loading agents",
  onRetry: vi.fn(),
  revealDirSegments: [".claude", "agents"],
  revealErrorMessage: "Couldn't open ~/.claude/agents/ — directory may not exist yet.",
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// LibraryEmptyPanel
// ---------------------------------------------------------------------------

describe("LibraryEmptyPanel", () => {
  it("renders heading, body, primary button, and learn-more link", () => {
    render(<LibraryEmptyPanel {...EMPTY_DEFAULTS} />);

    expect(screen.getByText("No agents found")).toBeDefined();
    expect(screen.getByText("Drop an agent definition file to see it here.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Open ~/.claude/agents/ in Finder" })).toBeDefined();
    const link = screen.getByRole("link", { name: /Learn how to author an agent/i });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe(
      "https://docs.claude.com/en/docs/claude-code/sub-agents",
    );
  });

  it("calls homeDir() and join() with the provided dir segments on primary click", async () => {
    render(<LibraryEmptyPanel {...EMPTY_DEFAULTS} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*agents.*Finder/i }));
    });

    await waitFor(() => {
      expect(mockHomeDir).toHaveBeenCalledTimes(1);
      expect(mockJoin).toHaveBeenCalledWith("/Users/testuser", ".claude", "agents");
      expect(mockInvoke).toHaveBeenCalledWith("reveal_in_finder", {
        path: "/Users/testuser/.claude/agents",
      });
    });
  });

  it("shows inline role='alert' aria-live='polite' when reveal_in_finder fails", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));

    render(<LibraryEmptyPanel {...EMPTY_DEFAULTS} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*agents.*Finder/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't open ~/.claude/agents/ — directory may not exist yet."),
      ).toBeDefined();
    });

    const alert = screen.getByRole("alert");
    expect(alert.getAttribute("aria-live")).toBe("polite");
  });

  it("does NOT show inline alert when reveal_in_finder succeeds", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    render(<LibraryEmptyPanel {...EMPTY_DEFAULTS} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*agents.*Finder/i }));
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Couldn't open ~/.claude/agents/ — directory may not exist yet."),
      ).toBeNull();
    });
  });

  it("clears prior inline alert on a subsequent click attempt", async () => {
    // First click: fails → alert appears
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));

    render(<LibraryEmptyPanel {...EMPTY_DEFAULTS} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*agents.*Finder/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't open ~/.claude/agents/ — directory may not exist yet."),
      ).toBeDefined();
    });

    // Second click: succeeds → alert is cleared
    mockInvoke.mockResolvedValueOnce(undefined);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*agents.*Finder/i }));
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Couldn't open ~/.claude/agents/ — directory may not exist yet."),
      ).toBeNull();
    });
  });

  it("fires DEV console.error on reveal failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));

    // Temporarily set DEV mode for this test by spying on import.meta.env
    const originalDev = import.meta.env.DEV;
    import.meta.env.DEV = true;

    render(<LibraryEmptyPanel {...EMPTY_DEFAULTS} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*agents.*Finder/i }));
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[LibraryEmptyPanel]"),
        expect.anything(),
      );
    });

    import.meta.env.DEV = originalDev;
    consoleSpy.mockRestore();
  });

  it("learn-more link is still present after a reveal failure", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));

    render(<LibraryEmptyPanel {...EMPTY_DEFAULTS} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open.*agents.*Finder/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't open ~/.claude/agents/ — directory may not exist yet."),
      ).toBeDefined();
    });

    const link = screen.getByRole("link", { name: /Learn how to author an agent/i });
    expect(link).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// LibraryErrorPanel
// ---------------------------------------------------------------------------

describe("LibraryErrorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading, body, Retry button, and Reveal in Finder button", () => {
    const onRetry = vi.fn();
    render(<LibraryErrorPanel {...ERROR_DEFAULTS} onRetry={onRetry} />);

    expect(screen.getByText("Couldn't load agents")).toBeDefined();
    expect(screen.getByText("The sidecar didn't return a response.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Reveal in Finder" })).toBeDefined();
  });

  it("calls onRetry when Retry button is clicked", async () => {
    const onRetry = vi.fn();
    render(<LibraryErrorPanel {...ERROR_DEFAULTS} onRetry={onRetry} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("calls homeDir() and join() with the provided dir segments on reveal click", async () => {
    const onRetry = vi.fn();
    render(<LibraryErrorPanel {...ERROR_DEFAULTS} onRetry={onRetry} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    });

    await waitFor(() => {
      expect(mockHomeDir).toHaveBeenCalledTimes(1);
      expect(mockJoin).toHaveBeenCalledWith("/Users/testuser", ".claude", "agents");
      expect(mockInvoke).toHaveBeenCalledWith("reveal_in_finder", {
        path: "/Users/testuser/.claude/agents",
      });
    });
  });

  it("shows inline role='alert' aria-live='polite' when reveal_in_finder fails", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));
    const onRetry = vi.fn();

    render(<LibraryErrorPanel {...ERROR_DEFAULTS} onRetry={onRetry} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't open ~/.claude/agents/ — directory may not exist yet."),
      ).toBeDefined();
    });

    const alert = screen.getByRole("alert");
    expect(alert.getAttribute("aria-live")).toBe("polite");
  });

  it("does NOT show inline alert when reveal_in_finder succeeds", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    const onRetry = vi.fn();

    render(<LibraryErrorPanel {...ERROR_DEFAULTS} onRetry={onRetry} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Couldn't open ~/.claude/agents/ — directory may not exist yet."),
      ).toBeNull();
    });
  });

  it("clears prior inline alert on a subsequent reveal attempt", async () => {
    const onRetry = vi.fn();

    // First click: fails → alert appears
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));

    render(<LibraryErrorPanel {...ERROR_DEFAULTS} onRetry={onRetry} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't open ~/.claude/agents/ — directory may not exist yet."),
      ).toBeDefined();
    });

    // Second click: succeeds → alert is cleared
    mockInvoke.mockResolvedValueOnce(undefined);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Couldn't open ~/.claude/agents/ — directory may not exist yet."),
      ).toBeNull();
    });
  });

  it("fires DEV console.error on reveal failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInvoke.mockRejectedValueOnce(new Error("file_not_found"));
    const onRetry = vi.fn();

    const originalDev = import.meta.env.DEV;
    import.meta.env.DEV = true;

    render(<LibraryErrorPanel {...ERROR_DEFAULTS} onRetry={onRetry} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[LibraryErrorPanel]"),
        expect.anything(),
      );
    });

    import.meta.env.DEV = originalDev;
    consoleSpy.mockRestore();
  });
});
