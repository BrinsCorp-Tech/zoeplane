/**
 * AgentCard — unit tests.
 *
 * Covers:
 *   - Renders required fields (name, voice, archetype, traits, last-modified)
 *   - Warning indicator when archetype derive returns 'missing'
 *   - Invalid voice ID format triggers strike-through + tooltip button
 *   - EvaluatorStatusBadge mapping (valid→approved, warnings→needs re-evaluation, invalid→declined)
 *   - a11y: role="button", aria-label, no axe violations
 *
 * Story: 6.2
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AssetSummary } from "@zoeplane/shared-types";
import { runAxe, formatViolations } from "@/test/helpers/runAxe";
import { AgentCard } from "../AgentCard";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeAsset(overrides: Partial<AssetSummary> = {}): AssetSummary {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    kind: "agent",
    name: "sprint-programmer",
    scope: "global",
    projectId: null,
    sourcePath: "/Users/zeke/.claude/agents/sprint-programmer.md",
    validationStatus: "valid",
    lastModifiedAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
    lastModifiedBy: "external",
    frontMatter: {
      name: "Sprint Programmer",
      voice_id: "8fcyCHOzlKDlxh1InJSf",
      voice_name: "Joseph",
      traits: {
        expertise: ["implementation"],
        personality: ["efficiency"],
        approach: ["rapid"],
      },
      description: "Efficient craftsman who ships working code.",
    },
    bodyExcerpt: "Ship working code.",
    provenance: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentCard", () => {
  // ── Renders required fields ────────────────────────────────────────────────

  it("renders agent name from frontMatter.name", () => {
    render(<AgentCard asset={makeAsset()} />);
    expect(screen.getByText("Sprint Programmer")).toBeDefined();
  });

  it("falls back to filename stem when frontMatter.name is absent", () => {
    const asset = makeAsset({
      frontMatter: { voice_id: "8fcyCHOzlKDlxh1InJSf" },
      sourcePath: "/Users/zeke/.claude/agents/my-custom-agent.md",
    });
    render(<AgentCard asset={asset} />);
    expect(screen.getByText("my-custom-agent")).toBeDefined();
  });

  it("renders voice ID with voice name", () => {
    render(<AgentCard asset={makeAsset()} />);
    // Voice name and voice ID should both appear
    expect(screen.getByText("Joseph")).toBeDefined();
    expect(screen.getByText("8fcyCHOzlKDlxh1InJSf")).toBeDefined();
  });

  it("renders archetype line with derived value", () => {
    render(<AgentCard asset={makeAsset()} />);
    // Derives from traits.personality[0] → "Efficiency"
    expect(screen.getByText("Efficiency")).toBeDefined();
  });

  it("renders trait chips from frontMatter.traits", () => {
    render(<AgentCard asset={makeAsset()} />);
    expect(screen.getByText("implementation")).toBeDefined();
    expect(screen.getByText("efficiency")).toBeDefined();
    expect(screen.getByText("rapid")).toBeDefined();
  });

  it("renders last-modified relative time", () => {
    render(<AgentCard asset={makeAsset()} />);
    // Should render something like "3d ago"
    expect(screen.getByText(/ago/)).toBeDefined();
  });

  // ── Warning indicator ──────────────────────────────────────────────────────

  it("renders warning indicator when archetype source is 'missing'", () => {
    const asset = makeAsset({
      validationStatus: "warnings",
      frontMatter: {
        name: "Incomplete Agent",
        voice_id: "8fcyCHOzlKDlxh1InJSf",
        // No archetype, no traits, no description → source='missing'
      },
    });
    render(<AgentCard asset={asset} />);
    expect(screen.getByText(/Front-matter/)).toBeDefined();
  });

  it("does NOT render warning indicator when all fields are valid", () => {
    const asset = makeAsset(); // valid + all fields present
    render(<AgentCard asset={asset} />);
    // For a fully valid card with no missing fields, no warning footer
    const warnings = screen.queryAllByText(/Front-matter/);
    expect(warnings).toHaveLength(0);
  });

  it("renders warning footer when voice_id is absent", () => {
    const asset = makeAsset({
      frontMatter: {
        name: "No Voice Agent",
        traits: { expertise: ["research"], personality: [], approach: [] },
      },
    });
    render(<AgentCard asset={asset} />);
    expect(screen.getByText(/Front-matter/)).toBeDefined();
  });

  it("renders warning footer when no traits declared", () => {
    const asset = makeAsset({
      frontMatter: {
        name: "No Traits Agent",
        voice_id: "8fcyCHOzlKDlxh1InJSf",
        traits: { expertise: [], personality: [], approach: [] },
      },
    });
    render(<AgentCard asset={asset} />);
    // "No traits declared" italic text
    expect(screen.getByText("No traits declared")).toBeDefined();
    // Warning footer too
    expect(screen.getByText(/Front-matter/)).toBeDefined();
  });

  // ── Invalid voice ID format ────────────────────────────────────────────────

  it("renders strike-through for invalid voice ID format", () => {
    const asset = makeAsset({
      frontMatter: {
        name: "Bad Voice",
        voice_id: "short!",
        traits: { expertise: ["research"], personality: ["curiosity"], approach: [] },
      },
    });
    const { container } = render(<AgentCard asset={asset} />);
    const strikeThrough = container.querySelector(".line-through");
    expect(strikeThrough).not.toBeNull();
    expect(strikeThrough?.textContent).toContain("short!");
  });

  it("renders ? icon button for invalid voice ID", () => {
    const asset = makeAsset({
      frontMatter: {
        name: "Bad Voice",
        voice_id: "short!",
        traits: { expertise: ["research"], personality: ["curiosity"], approach: [] },
      },
    });
    render(<AgentCard asset={asset} />);
    const button = screen.getByRole("button", { name: /Invalid voice ID format/i });
    expect(button).toBeDefined();
  });

  // ── EvaluatorStatusBadge mapping ──────────────────────────────────────────

  it("renders 'approved' state badge when validationStatus=valid", () => {
    render(<AgentCard asset={makeAsset({ validationStatus: "valid" })} />);
    // Badge aria-label includes state
    const badge = screen.getByRole("status", { name: "Agent: Approved" });
    expect(badge).toBeDefined();
  });

  it("renders 'needs re-evaluation' badge when validationStatus=warnings", () => {
    render(<AgentCard asset={makeAsset({ validationStatus: "warnings" })} />);
    const badge = screen.getByRole("status", { name: "Agent: Needs re-evaluation" });
    expect(badge).toBeDefined();
  });

  it("renders 'declined' badge when validationStatus=invalid", () => {
    render(<AgentCard asset={makeAsset({ validationStatus: "invalid" })} />);
    const badge = screen.getByRole("status", { name: "Agent: Declined" });
    expect(badge).toBeDefined();
  });

  // ── Trait chip overflow ────────────────────────────────────────────────────

  it("shows +N more chip when traits exceed 3", () => {
    const asset = makeAsset({
      frontMatter: {
        name: "Many Traits",
        voice_id: "8fcyCHOzlKDlxh1InJSf",
        voice_name: "Joseph",
        traits: {
          expertise: ["impl", "debug", "arch"],
          personality: ["efficiency", "directness"],
          approach: ["systematic"],
        },
      },
    });
    render(<AgentCard asset={asset} />);
    expect(screen.getByText(/\+\d+ more/)).toBeDefined();
  });

  it("shows exactly 3 trait chips when 3+ traits exist", () => {
    const asset = makeAsset({
      frontMatter: {
        name: "Three Plus",
        voice_id: "8fcyCHOzlKDlxh1InJSf",
        traits: {
          expertise: ["alpha", "beta", "gamma", "delta"],
          personality: [],
          approach: [],
        },
      },
    });
    const { container } = render(<AgentCard asset={asset} />);
    // First 3 visible + overflow chip; find all chips by accent color class
    const chips = container.querySelectorAll("[class*='accent-muted']");
    // Should have 3 visible + 1 overflow = 4
    expect(chips.length).toBe(4);
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  it("has role='button' on the card root", () => {
    render(<AgentCard asset={makeAsset()} />);
    const card = screen.getByRole("button");
    expect(card).toBeDefined();
  });

  it("carries aria-label summarizing the agent", () => {
    render(<AgentCard asset={makeAsset()} />);
    const card = screen.getByRole("button");
    const ariaLabel = card.getAttribute("aria-label");
    expect(ariaLabel).toContain("Agent:");
    expect(ariaLabel).toContain("Sprint Programmer");
  });

  it("passes axe-core structural scan with no violations", async () => {
    const { container } = render(<AgentCard asset={makeAsset()} />);
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results)).toHaveLength(0);
  });

  it("passes axe-core scan in warning state", async () => {
    const { container } = render(
      <AgentCard
        asset={makeAsset({
          validationStatus: "warnings",
          frontMatter: {
            name: "Warn Agent",
            voice_id: "8fcyCHOzlKDlxh1InJSf",
            traits: { expertise: [], personality: [], approach: [] },
          },
        })}
      />,
    );
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results)).toHaveLength(0);
  });
});
