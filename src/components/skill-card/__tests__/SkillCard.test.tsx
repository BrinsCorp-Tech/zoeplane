/**
 * SkillCard — unit tests.
 *
 * Covers:
 *   - Renders skill name + description from frontMatter
 *   - Name fallback to filename stem when frontMatter.name absent
 *   - Provenance label: null → "User-authored", URL → "From {hostname}", non-URL → "From {id}"
 *   - EvaluatorStatusBadge mapping: all 4 validationStatus states (diverges from AgentCard)
 *   - "No description provided" italic fallback + warning indicator
 *   - Degraded state (validationStatus="invalid"): basename, heading, canonical path, focusable
 *   - Degraded state aria-label is distinct from healthy card
 *   - Last-modified relative time renders
 *   - a11y: role="button", aria-label, axe-core scan
 *
 * Story: 6.3 — Skill Library + SkillCard
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AssetSummary } from "@zoeplane/shared-types";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { SkillCard } from "../SkillCard";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeAsset(overrides: Partial<AssetSummary> = {}): AssetSummary {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    kind: "skill",
    name: "code-reviewer",
    scope: "global",
    projectId: null,
    sourcePath: "/Users/zeke/.claude/skills/code-reviewer.md",
    validationStatus: "valid",
    lastModifiedAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
    lastModifiedBy: "external",
    frontMatter: {
      name: "Code Reviewer",
      description: "Reviews code for quality and architectural alignment.",
    },
    bodyExcerpt: "Review code for quality.",
    provenance: null,
    ...overrides,
  };
}

function makeProvenance(sourceUrl: string) {
  return {
    id: "prov-001",
    sourceUrl,
    sourceHash: "abc123",
    importedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    evaluatorReportId: null,
    lastEvaluatedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SkillCard", () => {
  // ── Renders required fields ────────────────────────────────────────────────

  it("renders skill name from frontMatter.name", () => {
    render(<SkillCard asset={makeAsset()} />);
    expect(screen.getByText("Code Reviewer")).toBeDefined();
  });

  it("renders description from frontMatter.description", () => {
    render(<SkillCard asset={makeAsset()} />);
    expect(screen.getByText("Reviews code for quality and architectural alignment.")).toBeDefined();
  });

  it("falls back to filename stem when frontMatter.name is absent", () => {
    const asset = makeAsset({
      frontMatter: { description: "A skill without a name." },
      sourcePath: "/Users/zeke/.claude/skills/my-custom-skill.md",
    });
    render(<SkillCard asset={asset} />);
    expect(screen.getByText("my-custom-skill")).toBeDefined();
  });

  it("renders last-modified relative time in footer", () => {
    render(<SkillCard asset={makeAsset()} />);
    expect(screen.getByText(/ago/)).toBeDefined();
  });

  // ── No description fallback ────────────────────────────────────────────────

  it("renders 'No description provided' italic text when description is absent", () => {
    const asset = makeAsset({
      frontMatter: { name: "Undocumented Skill" },
    });
    render(<SkillCard asset={asset} />);
    expect(screen.getByText("No description provided")).toBeDefined();
  });

  it("renders warning footer when description is absent", () => {
    const asset = makeAsset({
      frontMatter: { name: "Undocumented Skill" },
    });
    render(<SkillCard asset={asset} />);
    expect(screen.getByText("Front-matter incomplete")).toBeDefined();
  });

  it("does NOT render warning footer when all fields are valid", () => {
    const asset = makeAsset(); // valid + name + description
    render(<SkillCard asset={asset} />);
    const warnings = screen.queryAllByText("Front-matter incomplete");
    expect(warnings).toHaveLength(0);
  });

  // ── Provenance label ───────────────────────────────────────────────────────

  it("renders 'User-authored' label when provenance is null", () => {
    render(<SkillCard asset={makeAsset({ provenance: null })} />);
    expect(screen.getByText("User-authored")).toBeDefined();
  });

  it("renders 'From github.com' chip when sourceUrl is a GitHub URL", () => {
    const asset = makeAsset({
      provenance: makeProvenance(
        "https://github.com/anthropic/claude-skills/blob/main/code-reviewer/SKILL.md",
      ),
    });
    render(<SkillCard asset={asset} />);
    expect(screen.getByText("From github.com")).toBeDefined();
  });

  it("renders 'From {identifier}' chip when sourceUrl is a non-URL opaque string", () => {
    const asset = makeAsset({
      provenance: makeProvenance("claude-code-marketplace"),
    });
    render(<SkillCard asset={asset} />);
    expect(screen.getByText("From claude-code-marketplace")).toBeDefined();
  });

  // ── EvaluatorStatusBadge mapping (intentional divergence from AgentCard) ───

  it("renders 'Pending review' badge when validationStatus=valid (v1 default)", () => {
    render(<SkillCard asset={makeAsset({ validationStatus: "valid" })} />);
    // Badge aria-label: "Skill: Pending review"
    const badge = screen.getByRole("status", { name: "Skill: Pending review" });
    expect(badge).toBeDefined();
  });

  it("renders 'Needs re-evaluation' badge when validationStatus=warnings", () => {
    render(
      <SkillCard
        asset={makeAsset({
          validationStatus: "warnings",
          frontMatter: { name: "Warn Skill", description: "Has warnings." },
        })}
      />,
    );
    const badge = screen.getByRole("status", { name: "Skill: Needs re-evaluation" });
    expect(badge).toBeDefined();
  });

  it("renders 'Declined' badge when validationStatus=invalid", () => {
    render(
      <SkillCard
        asset={makeAsset({
          validationStatus: "invalid",
          frontMatter: null,
        })}
      />,
    );
    const badge = screen.getByRole("status", { name: "Skill: Declined" });
    expect(badge).toBeDefined();
  });

  it("renders 'Approved' badge when validationStatus=valid and evaluatorReportId is set (Epic 05 future path)", () => {
    render(
      <SkillCard
        asset={makeAsset({
          validationStatus: "valid",
          provenance: {
            id: "prov-001",
            sourceUrl: "https://github.com/anthropic/skills/SKILL.md",
            sourceHash: "abc",
            importedAt: Date.now(),
            evaluatorReportId: "report-abc-123", // non-null — future Epic 05 path
            lastEvaluatedAt: Date.now(),
          },
        })}
      />,
    );
    const badge = screen.getByRole("status", { name: "Skill: Approved" });
    expect(badge).toBeDefined();
  });

  // ── Degraded state (validationStatus="invalid") ────────────────────────────

  it("renders file basename WITH .md extension in degraded state header", () => {
    const asset = makeAsset({
      validationStatus: "invalid",
      frontMatter: null,
      sourcePath: "/Users/zeke/.claude/skills/broken-skill/SKILL.md",
    });
    render(<SkillCard asset={asset} />);
    // Basename with extension preserved (not stripped)
    expect(screen.getByText("SKILL.md")).toBeDefined();
  });

  it("renders exact heading 'Cannot parse front-matter' in degraded state", () => {
    const asset = makeAsset({
      validationStatus: "invalid",
      frontMatter: null,
    });
    render(<SkillCard asset={asset} />);
    expect(screen.getByText("Cannot parse front-matter")).toBeDefined();
  });

  it("renders full canonical sourcePath in monospace in degraded state", () => {
    const sourcePath = "/Users/zeke/.claude/skills/broken-skill/SKILL.md";
    const asset = makeAsset({
      validationStatus: "invalid",
      frontMatter: null,
      sourcePath,
    });
    render(<SkillCard asset={asset} />);
    expect(screen.getByText(sourcePath)).toBeDefined();
  });

  it("renders 'Front-matter could not be parsed' footer caption in degraded state", () => {
    const asset = makeAsset({
      validationStatus: "invalid",
      frontMatter: null,
    });
    render(<SkillCard asset={asset} />);
    expect(screen.getByText("Front-matter could not be parsed")).toBeDefined();
  });

  it("degraded card is keyboard-focusable (has role=button with tabIndex≥0)", () => {
    const asset = makeAsset({
      validationStatus: "invalid",
      frontMatter: null,
    });
    render(<SkillCard asset={asset} />);
    const card = screen.getByRole("button");
    expect(card).toBeDefined();
    // Card must not have tabIndex=-1 (must be reachable via Tab)
    const tabIndex = card.getAttribute("tabindex");
    expect(tabIndex).not.toBe("-1");
  });

  it("degraded card aria-label starts with 'Skill could not be parsed'", () => {
    const asset = makeAsset({
      validationStatus: "invalid",
      frontMatter: null,
      sourcePath: "/Users/zeke/.claude/skills/broken-skill/SKILL.md",
    });
    render(<SkillCard asset={asset} />);
    const card = screen.getByRole("button");
    const ariaLabel = card.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toContain("Skill could not be parsed");
    expect(ariaLabel).toContain("SKILL.md");
  });

  it("degraded state does NOT render 'Cannot parse front-matter' as description text in normal view", () => {
    // Verify the heading only appears in degraded state, not in a normal card
    const asset = makeAsset(); // valid card
    render(<SkillCard asset={asset} />);
    expect(screen.queryByText("Cannot parse front-matter")).toBeNull();
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  it("has role='button' on the card root", () => {
    render(<SkillCard asset={makeAsset()} />);
    const card = screen.getByRole("button");
    expect(card).toBeDefined();
  });

  it("carries aria-label summarizing the skill", () => {
    render(<SkillCard asset={makeAsset()} />);
    const card = screen.getByRole("button");
    const ariaLabel = card.getAttribute("aria-label");
    expect(ariaLabel).toContain("Skill:");
    expect(ariaLabel).toContain("Code Reviewer");
  });

  it("passes axe-core structural scan in idle state with no violations", async () => {
    const { container } = render(<SkillCard asset={makeAsset()} />);
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results)).toHaveLength(0);
  });

  it("passes axe-core scan in warning state", async () => {
    const { container } = render(
      <SkillCard
        asset={makeAsset({
          validationStatus: "warnings",
          frontMatter: { name: "Warn Skill", description: "Warning state." },
        })}
      />,
    );
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results)).toHaveLength(0);
  });

  it("passes axe-core scan in degraded state", async () => {
    const { container } = render(
      <SkillCard
        asset={makeAsset({
          validationStatus: "invalid",
          frontMatter: null,
        })}
      />,
    );
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results)).toHaveLength(0);
  });
});
