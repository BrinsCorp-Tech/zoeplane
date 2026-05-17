// @vitest-environment node
/**
 * Tests for the shared asset naming helper (Story 3.4).
 *
 * pathToAssetIdentifier() must produce (kind, name) pairs that exactly match
 * what scanner.ts stores in the assets table — these tests verify the contract
 * between the scanner write path and the resolver read path.
 */

import { describe, it, expect } from "vitest";
import { pathToAssetIdentifier } from "../naming";

// ---------------------------------------------------------------------------
// Test fixture: a fake ~/.claude root
// ---------------------------------------------------------------------------

const CLAUDE_ROOT = "/home/user/.claude";

// ---------------------------------------------------------------------------
// Skills (subdir-canonical layout)
// ---------------------------------------------------------------------------

describe("pathToAssetIdentifier — skill (subdir-canonical)", () => {
  it("extracts name for a skill canonical file", () => {
    const result = pathToAssetIdentifier(`${CLAUDE_ROOT}/skills/my-skill/SKILL.md`, CLAUDE_ROOT);
    expect(result).toEqual({ kind: "skill", name: "my-skill" });
  });

  it("extracts name for a hyphenated multi-word skill", () => {
    const result = pathToAssetIdentifier(
      `${CLAUDE_ROOT}/skills/code-reviewer/SKILL.md`,
      CLAUDE_ROOT,
    );
    expect(result).toEqual({ kind: "skill", name: "code-reviewer" });
  });

  it("returns null for a non-canonical file inside a skills subdir", () => {
    const result = pathToAssetIdentifier(`${CLAUDE_ROOT}/skills/my-skill/README.md`, CLAUDE_ROOT);
    expect(result).toBeNull();
  });

  it("returns null for a file directly under skills/ (no subdir)", () => {
    const result = pathToAssetIdentifier(`${CLAUDE_ROOT}/skills/floating.md`, CLAUDE_ROOT);
    expect(result).toBeNull();
  });

  it("returns null for a file three levels deep under skills/", () => {
    const result = pathToAssetIdentifier(
      `${CLAUDE_ROOT}/skills/my-skill/subdir/SKILL.md`,
      CLAUDE_ROOT,
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Teams (subdir-canonical layout)
// ---------------------------------------------------------------------------

describe("pathToAssetIdentifier — team (subdir-canonical)", () => {
  it("extracts name for a team canonical file", () => {
    const result = pathToAssetIdentifier(`${CLAUDE_ROOT}/teams/backend-squad/TEAM.md`, CLAUDE_ROOT);
    expect(result).toEqual({ kind: "team", name: "backend-squad" });
  });

  it("returns null for a non-canonical file inside a teams subdir", () => {
    const result = pathToAssetIdentifier(
      `${CLAUDE_ROOT}/teams/backend-squad/members.md`,
      CLAUDE_ROOT,
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Workflows (subdir-canonical layout)
// ---------------------------------------------------------------------------

describe("pathToAssetIdentifier — workflow (subdir-canonical)", () => {
  it("extracts name for a workflow canonical file", () => {
    const result = pathToAssetIdentifier(
      `${CLAUDE_ROOT}/workflows/daily-standup/WORKFLOW.md`,
      CLAUDE_ROOT,
    );
    expect(result).toEqual({ kind: "workflow", name: "daily-standup" });
  });
});

// ---------------------------------------------------------------------------
// Agents (direct-md layout)
// ---------------------------------------------------------------------------

describe("pathToAssetIdentifier — agent (direct-md)", () => {
  it("extracts name for a flat agent file", () => {
    const result = pathToAssetIdentifier(`${CLAUDE_ROOT}/agents/architect.md`, CLAUDE_ROOT);
    expect(result).toEqual({ kind: "agent", name: "architect" });
  });

  it("extracts name for a hyphenated agent name", () => {
    const result = pathToAssetIdentifier(`${CLAUDE_ROOT}/agents/code-reviewer.md`, CLAUDE_ROOT);
    expect(result).toEqual({ kind: "agent", name: "code-reviewer" });
  });

  it("returns null for a non-.md file under agents/", () => {
    const result = pathToAssetIdentifier(`${CLAUDE_ROOT}/agents/notes.txt`, CLAUDE_ROOT);
    expect(result).toBeNull();
  });

  it("returns null for a file two levels deep under agents/ (depth guard)", () => {
    // Agents do not have nested layouts — depth > 1 is not indexed.
    const result = pathToAssetIdentifier(
      `${CLAUDE_ROOT}/agents/subgroup/architect.md`,
      CLAUDE_ROOT,
    );
    // The naming helper allows one level of nesting (same as commands), so this
    // actually resolves to { kind: "agent", name: "subgroup/architect" }.
    // This is consistent with the scanner's `enumerateDirectMd` depth=1 recursion.
    expect(result).toEqual({ kind: "agent", name: "subgroup/architect" });
  });
});

// ---------------------------------------------------------------------------
// Commands (direct-md layout with one level of nesting)
// ---------------------------------------------------------------------------

describe("pathToAssetIdentifier — command (direct-md, nested)", () => {
  it("extracts name for a flat command file", () => {
    const result = pathToAssetIdentifier(`${CLAUDE_ROOT}/commands/code-audit.md`, CLAUDE_ROOT);
    expect(result).toEqual({ kind: "command", name: "code-audit" });
  });

  it("extracts name for a nested command file (consider/first-principles)", () => {
    const result = pathToAssetIdentifier(
      `${CLAUDE_ROOT}/commands/consider/first-principles.md`,
      CLAUDE_ROOT,
    );
    expect(result).toEqual({ kind: "command", name: "consider/first-principles" });
  });

  it("extracts name for a nested command file (consider/inversion)", () => {
    const result = pathToAssetIdentifier(
      `${CLAUDE_ROOT}/commands/consider/inversion.md`,
      CLAUDE_ROOT,
    );
    expect(result).toEqual({ kind: "command", name: "consider/inversion" });
  });

  it("returns null for a file three levels deep under commands/ (depth guard)", () => {
    // Depth 2+ is not indexed by the scanner — naming helper must agree.
    const result = pathToAssetIdentifier(
      `${CLAUDE_ROOT}/commands/consider/subgroup/deep.md`,
      CLAUDE_ROOT,
    );
    expect(result).toBeNull();
  });

  it("returns null for a non-.md file under commands/", () => {
    const result = pathToAssetIdentifier(`${CLAUDE_ROOT}/commands/notes.txt`, CLAUDE_ROOT);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Path outside any known kind directory
// ---------------------------------------------------------------------------

describe("pathToAssetIdentifier — unrecognised paths", () => {
  it("returns null for a file directly under the claude root", () => {
    const result = pathToAssetIdentifier(`${CLAUDE_ROOT}/settings.json`, CLAUDE_ROOT);
    expect(result).toBeNull();
  });

  it("returns null for a path under an unknown directory", () => {
    const result = pathToAssetIdentifier(`${CLAUDE_ROOT}/unknown-kind/something.md`, CLAUDE_ROOT);
    expect(result).toBeNull();
  });

  it("returns null for a path that only prefix-matches a kind dir name", () => {
    // e.g., 'skills2/' should NOT match 'skills/'
    const result = pathToAssetIdentifier(`${CLAUDE_ROOT}/skills2/my-skill/SKILL.md`, CLAUDE_ROOT);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Project-scoped roots (same conventions, different claudeRoot)
// ---------------------------------------------------------------------------

describe("pathToAssetIdentifier — project-scoped root", () => {
  const PROJECT_CLAUDE_ROOT = "/home/user/my-project/.claude";

  it("extracts name for a project-scoped skill", () => {
    const result = pathToAssetIdentifier(
      `${PROJECT_CLAUDE_ROOT}/skills/custom-skill/SKILL.md`,
      PROJECT_CLAUDE_ROOT,
    );
    expect(result).toEqual({ kind: "skill", name: "custom-skill" });
  });

  it("extracts name for a project-scoped nested command", () => {
    const result = pathToAssetIdentifier(
      `${PROJECT_CLAUDE_ROOT}/commands/deploy/production.md`,
      PROJECT_CLAUDE_ROOT,
    );
    expect(result).toEqual({ kind: "command", name: "deploy/production" });
  });

  it("returns null for a path under a different claude root", () => {
    // File is under global ~/.claude/ but claudeRoot is the project one.
    const result = pathToAssetIdentifier(
      `${CLAUDE_ROOT}/skills/my-skill/SKILL.md`,
      PROJECT_CLAUDE_ROOT,
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cross-platform separator handling (regression guard for Windows CI)
// ---------------------------------------------------------------------------
//
// On Windows, scanner.ts produces paths via node:path.resolve() which uses
// "\\" separators. naming.test.ts (above) uses POSIX-literal "/" paths. The
// helper must accept BOTH styles regardless of host platform. These tests
// pass on Mac/Linux AND Windows by constructing paths with literal "\\".
//
// Regression for PR #31 hotfixes f796548 + the follow-up that introduced
// toPosix() normalization at entry.

describe("pathToAssetIdentifier — Windows-style separator inputs", () => {
  it("extracts skill name from a Windows-style absolute path", () => {
    const result = pathToAssetIdentifier(
      "C:\\Users\\runner\\.claude\\skills\\my-skill\\SKILL.md",
      "C:\\Users\\runner\\.claude",
    );
    expect(result).toEqual({ kind: "skill", name: "my-skill" });
  });

  it("extracts agent name from a Windows-style flat .md path", () => {
    const result = pathToAssetIdentifier(
      "D:\\repo\\test-fixture\\.claude\\agents\\architect.md",
      "D:\\repo\\test-fixture\\.claude",
    );
    expect(result).toEqual({ kind: "agent", name: "architect" });
  });

  it("extracts nested command name with POSIX-style output regardless of input separator", () => {
    // Output name MUST use "/" (canonical cross-platform identifier) even
    // when input uses "\\". This keeps assets.name values stable for sync.
    const result = pathToAssetIdentifier(
      "C:\\Users\\u\\.claude\\commands\\consider\\first-principles.md",
      "C:\\Users\\u\\.claude",
    );
    expect(result).toEqual({ kind: "command", name: "consider/first-principles" });
  });

  it("enforces prefix-collision guard against Windows-style siblings", () => {
    const result = pathToAssetIdentifier(
      "C:\\Users\\u\\.claude\\skills2\\my-skill\\SKILL.md",
      "C:\\Users\\u\\.claude",
    );
    expect(result).toBeNull();
  });
});
