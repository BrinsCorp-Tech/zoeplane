/**
 * CommandCard — unit tests.
 *
 * Covers:
 *   - Renders display name from frontMatter.name
 *   - Name fallback to derived filename stem when frontMatter.name absent
 *   - Nested command path display: consider/first-principles (AC #5, Constraint 9)
 *   - Scope badge: "Global" for scope=global, "Project" for scope=project (AC #1)
 *   - Description (2-line clamp) OR "No description provided" italic fallback
 *   - AC #5: parse-error state (frontMatter === null) — warning indicator + "Cannot parse front-matter"
 *   - AC #5: parse-error state renders the card (not omitted) with filename as title
 *   - Warning footer shows "Front-matter incomplete" for valid + description missing
 *   - No warning footer when all fields valid + description present
 *   - Last-modified relative time renders
 *   - a11y: role="button", aria-label, axe-core scan
 *   - Constraint 9: Windows-style backslash paths are normalized to POSIX
 *
 * Story: 6.6
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AssetSummary } from "@zoeplane/shared-types";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { CommandCard, deriveCommandDisplayName } from "../CommandCard";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAsset(overrides: Partial<AssetSummary> = {}): AssetSummary {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    kind: "command",
    name: "my-command",
    scope: "global",
    projectId: null,
    sourcePath: "/Users/testuser/.claude/commands/my-command.md",
    validationStatus: "valid",
    lastModifiedAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
    lastModifiedBy: "external",
    frontMatter: {
      name: "My Command",
      description: "A helpful slash command.",
    },
    bodyExcerpt: "Command body here.",
    provenance: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// deriveCommandDisplayName — unit tests (Constraint 9: Windows path regression)
// ---------------------------------------------------------------------------

describe("deriveCommandDisplayName", () => {
  it("returns filename stem for a flat global command", () => {
    expect(deriveCommandDisplayName("/Users/zeke/.claude/commands/my-command.md")).toBe(
      "my-command",
    );
  });

  it("returns 'parent/stem' for a one-level-deep nested command", () => {
    expect(
      deriveCommandDisplayName("/Users/zeke/.claude/commands/consider/first-principles.md"),
    ).toBe("consider/first-principles");
  });

  it("strips .md extension from stem", () => {
    expect(deriveCommandDisplayName("/Users/zeke/.claude/commands/debug.md")).toBe("debug");
  });

  it("handles Windows-style backslash paths (Constraint 9)", () => {
    // Windows path — toPosix() normalizes at entry so the result is identical to POSIX
    expect(
      deriveCommandDisplayName("C:\\Users\\zeke\\.claude\\commands\\consider\\first-principles.md"),
    ).toBe("consider/first-principles");
  });

  it("handles Windows flat path (Constraint 9)", () => {
    expect(deriveCommandDisplayName("C:\\Users\\zeke\\.claude\\commands\\my-command.md")).toBe(
      "my-command",
    );
  });

  it("returns stem alone when parent is 'commands' (standard root dir)", () => {
    // 'commands' is a ROOT_DIR — parent should not be included
    expect(deriveCommandDisplayName("/Users/zeke/.claude/commands/inversion.md")).toBe("inversion");
  });
});

// ---------------------------------------------------------------------------
// CommandCard — rendering tests
// ---------------------------------------------------------------------------

describe("CommandCard", () => {
  // ── Display name ───────────────────────────────────────────────────────────

  it("renders display name from frontMatter.name", () => {
    render(<CommandCard asset={makeAsset()} />);
    expect(screen.getByText("My Command")).toBeDefined();
  });

  it("falls back to derived filename stem when frontMatter.name is absent", () => {
    const asset = makeAsset({
      frontMatter: { description: "No name." },
      sourcePath: "/Users/testuser/.claude/commands/list-todos.md",
    });
    render(<CommandCard asset={asset} />);
    expect(screen.getByText("list-todos")).toBeDefined();
  });

  it("renders nested command path as parent/stem when frontMatter.name absent", () => {
    const asset = makeAsset({
      frontMatter: {},
      sourcePath: "/Users/testuser/.claude/commands/consider/inversion.md",
    });
    render(<CommandCard asset={asset} />);
    expect(screen.getByText("consider/inversion")).toBeDefined();
  });

  // ── Scope badge (AC #1) ────────────────────────────────────────────────────

  it("renders 'Global' scope badge for scope=global assets", () => {
    render(<CommandCard asset={makeAsset({ scope: "global" })} />);
    expect(screen.getByText("Global")).toBeDefined();
  });

  it("renders 'Project' scope badge for scope=project assets", () => {
    render(<CommandCard asset={makeAsset({ scope: "project", projectId: "proj-001" })} />);
    expect(screen.getByText("Project")).toBeDefined();
  });

  // ── Description ────────────────────────────────────────────────────────────

  it("renders description from frontMatter.description", () => {
    render(<CommandCard asset={makeAsset()} />);
    expect(screen.getByText("A helpful slash command.")).toBeDefined();
  });

  it("renders 'No description provided' italic text when description is absent", () => {
    const asset = makeAsset({
      frontMatter: { name: "Unnamed" },
    });
    render(<CommandCard asset={asset} />);
    expect(screen.getByText("No description provided")).toBeDefined();
  });

  // ── Parse-error state (AC #5) ──────────────────────────────────────────────

  it("renders the card (not omitted) when frontMatter is null — AC #5", () => {
    const asset = makeAsset({
      validationStatus: "invalid",
      frontMatter: null,
      sourcePath: "/Users/testuser/.claude/commands/broken.md",
    });
    render(<CommandCard asset={asset} />);
    // Card must still be in the DOM (not omitted)
    expect(screen.getByRole("button")).toBeDefined();
  });

  it("renders filename as title when frontMatter is null — AC #5", () => {
    const asset = makeAsset({
      validationStatus: "invalid",
      frontMatter: null,
      sourcePath: "/Users/testuser/.claude/commands/broken.md",
    });
    render(<CommandCard asset={asset} />);
    expect(screen.getByText("broken")).toBeDefined();
  });

  it("renders 'Cannot parse front-matter' warning indicator when frontMatter is null — AC #5", () => {
    const asset = makeAsset({
      validationStatus: "invalid",
      frontMatter: null,
    });
    render(<CommandCard asset={asset} />);
    expect(screen.getByText("Cannot parse front-matter")).toBeDefined();
  });

  it("does NOT render 'Cannot parse front-matter' when frontMatter is valid", () => {
    render(<CommandCard asset={makeAsset()} />);
    expect(screen.queryByText("Cannot parse front-matter")).toBeNull();
  });

  // ── Warning footer ─────────────────────────────────────────────────────────

  it("renders 'Front-matter incomplete' warning when description is absent", () => {
    const asset = makeAsset({ frontMatter: { name: "No Desc" } });
    render(<CommandCard asset={asset} />);
    expect(screen.getByText("Front-matter incomplete")).toBeDefined();
  });

  it("does NOT render warning footer when all fields are valid with description", () => {
    render(<CommandCard asset={makeAsset()} />);
    expect(screen.queryByText("Front-matter incomplete")).toBeNull();
    expect(screen.queryByText("Cannot parse front-matter")).toBeNull();
  });

  // ── Last-modified ──────────────────────────────────────────────────────────

  it("renders last-modified relative time in footer", () => {
    render(<CommandCard asset={makeAsset()} />);
    expect(screen.getByText(/ago/)).toBeDefined();
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  it("has role='button' on the card root", () => {
    render(<CommandCard asset={makeAsset()} />);
    const card = screen.getByRole("button");
    expect(card).toBeDefined();
  });

  it("aria-label contains 'Command:' and display name", () => {
    render(<CommandCard asset={makeAsset()} />);
    const card = screen.getByRole("button");
    const ariaLabel = card.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toContain("Command:");
    expect(ariaLabel).toContain("My Command");
  });

  it("aria-label includes scope label (Global/Project)", () => {
    render(<CommandCard asset={makeAsset({ scope: "project", projectId: "proj-001" })} />);
    const card = screen.getByRole("button");
    const ariaLabel = card.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toContain("Project");
  });

  it("aria-label mentions 'Cannot parse front-matter' when frontMatter is null", () => {
    const asset = makeAsset({
      validationStatus: "invalid",
      frontMatter: null,
    });
    render(<CommandCard asset={asset} />);
    const card = screen.getByRole("button");
    const ariaLabel = card.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toContain("Cannot parse front-matter");
  });

  it("passes axe-core structural scan in idle state with no violations", async () => {
    const { container } = render(<CommandCard asset={makeAsset()} />);
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results)).toHaveLength(0);
  });

  it("passes axe-core scan in parse-error state", async () => {
    const { container } = render(
      <CommandCard
        asset={makeAsset({
          validationStatus: "invalid",
          frontMatter: null,
        })}
      />,
    );
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results)).toHaveLength(0);
  });

  it("passes axe-core scan for project-scoped command", async () => {
    const { container } = render(
      <CommandCard asset={makeAsset({ scope: "project", projectId: "proj-001" })} />,
    );
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results)).toHaveLength(0);
  });
});
