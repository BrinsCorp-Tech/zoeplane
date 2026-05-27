/**
 * asset-nav store — unit tests.
 *
 * Covers all state transitions:
 *   - Initial state
 *   - open(kind, id) → detail mode
 *   - edit() → editor mode
 *   - back() from editor → detail
 *   - back() from detail → library
 *   - back() from library → no-op
 *   - close() → library, clears selection
 *   - edit() with no selection → no-op
 *   - setSelected / setMode direct setters
 *   - setDirty / clearDirty per-kind per-path isolation (AC #4)
 *   - Switching between a skill and an agent does NOT collide dirty-state flags
 *
 * Story: 6.16 — Asset Detail+Editor Kind-Parameterized Refactor (FR-003, FR-004)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useAssetNav } from "../asset-nav";

// Reset Zustand store state between tests
beforeEach(() => {
  useAssetNav.setState({
    kind: "skill",
    selectedAssetId: null,
    mode: "library",
    dirtyByKey: {},
  });
});

describe("useAssetNav store — basic navigation", () => {
  // ── Initial state ──────────────────────────────────────────────────────────

  it("starts with mode=library, kind=skill, and no selection", () => {
    const { mode, kind, selectedAssetId } = useAssetNav.getState();
    expect(mode).toBe("library");
    expect(kind).toBe("skill");
    expect(selectedAssetId).toBeNull();
  });

  // ── open() ─────────────────────────────────────────────────────────────────

  it("open(skill, id) sets mode=detail, kind=skill, and selectedAssetId", () => {
    useAssetNav.getState().open("skill", "skill-123");
    const { mode, kind, selectedAssetId } = useAssetNav.getState();
    expect(mode).toBe("detail");
    expect(kind).toBe("skill");
    expect(selectedAssetId).toBe("skill-123");
  });

  it("open(agent, id) sets mode=detail, kind=agent, and selectedAssetId", () => {
    useAssetNav.getState().open("agent", "agent-abc");
    const { mode, kind, selectedAssetId } = useAssetNav.getState();
    expect(mode).toBe("detail");
    expect(kind).toBe("agent");
    expect(selectedAssetId).toBe("agent-abc");
  });

  // ── edit() ─────────────────────────────────────────────────────────────────

  it("edit() transitions to editor when an asset is selected", () => {
    useAssetNav.getState().open("skill", "skill-abc");
    useAssetNav.getState().edit();
    expect(useAssetNav.getState().mode).toBe("editor");
    expect(useAssetNav.getState().selectedAssetId).toBe("skill-abc");
  });

  it("edit() is a no-op when no asset is selected", () => {
    useAssetNav.getState().edit();
    expect(useAssetNav.getState().mode).toBe("library");
  });

  // ── back() ─────────────────────────────────────────────────────────────────

  it("back() from editor returns to detail, keeps selection", () => {
    useAssetNav.getState().open("skill", "skill-xyz");
    useAssetNav.getState().edit();
    useAssetNav.getState().back();
    const { mode, selectedAssetId } = useAssetNav.getState();
    expect(mode).toBe("detail");
    expect(selectedAssetId).toBe("skill-xyz");
  });

  it("back() from detail returns to library and clears selection", () => {
    useAssetNav.getState().open("skill", "skill-xyz");
    useAssetNav.getState().back();
    const { mode, selectedAssetId } = useAssetNav.getState();
    expect(mode).toBe("library");
    expect(selectedAssetId).toBeNull();
  });

  it("back() from library is a no-op", () => {
    useAssetNav.getState().back();
    const { mode, selectedAssetId } = useAssetNav.getState();
    expect(mode).toBe("library");
    expect(selectedAssetId).toBeNull();
  });

  // ── close() ────────────────────────────────────────────────────────────────

  it("close() always returns to library and clears selection", () => {
    useAssetNav.getState().open("agent", "agent-999");
    useAssetNav.getState().edit();
    useAssetNav.getState().close();
    const { mode, selectedAssetId } = useAssetNav.getState();
    expect(mode).toBe("library");
    expect(selectedAssetId).toBeNull();
  });

  // ── setSelected / setMode ──────────────────────────────────────────────────

  it("setSelected updates selectedAssetId", () => {
    useAssetNav.getState().setSelected("direct-set-id");
    expect(useAssetNav.getState().selectedAssetId).toBe("direct-set-id");
  });

  it("setSelected(null) clears selection", () => {
    useAssetNav.getState().open("skill", "skill-abc");
    useAssetNav.getState().setSelected(null);
    expect(useAssetNav.getState().selectedAssetId).toBeNull();
  });

  it("setMode directly sets the mode", () => {
    useAssetNav.getState().setMode("editor");
    expect(useAssetNav.getState().mode).toBe("editor");
  });

  // ── Full navigation flow ───────────────────────────────────────────────────

  it("full flow: library → detail → editor → detail → library", () => {
    // Start: library
    expect(useAssetNav.getState().mode).toBe("library");

    // Open detail
    useAssetNav.getState().open("skill", "skill-flow-test");
    expect(useAssetNav.getState().mode).toBe("detail");
    expect(useAssetNav.getState().selectedAssetId).toBe("skill-flow-test");

    // Edit
    useAssetNav.getState().edit();
    expect(useAssetNav.getState().mode).toBe("editor");

    // Back to detail
    useAssetNav.getState().back();
    expect(useAssetNav.getState().mode).toBe("detail");
    expect(useAssetNav.getState().selectedAssetId).toBe("skill-flow-test");

    // Back to library
    useAssetNav.getState().back();
    expect(useAssetNav.getState().mode).toBe("library");
    expect(useAssetNav.getState().selectedAssetId).toBeNull();
  });
});

describe("useAssetNav store — per-kind dirty-state isolation (AC #4)", () => {
  it("setDirty sets a flag under the given key", () => {
    const key = "skill:/Users/test/.claude/skills/my-skill/SKILL.md" as const;
    useAssetNav.getState().setDirty(key, true);
    expect(useAssetNav.getState().dirtyByKey[key]).toBe(true);
  });

  it("clearDirty removes the flag for the given key", () => {
    const key = "skill:/Users/test/.claude/skills/my-skill/SKILL.md" as const;
    useAssetNav.getState().setDirty(key, true);
    useAssetNav.getState().clearDirty(key);
    expect(useAssetNav.getState().dirtyByKey[key]).toBeUndefined();
  });

  it("skill dirty state does NOT affect agent dirty state (AC #4 — key isolation)", () => {
    const skillKey = "skill:/Users/test/.claude/skills/my-skill/SKILL.md" as const;
    const agentKey = "agent:/Users/test/.claude/agents/my-agent.md" as const;

    useAssetNav.getState().setDirty(skillKey, true);
    // Agent key should not be dirty
    expect(useAssetNav.getState().dirtyByKey[agentKey]).toBeUndefined();
  });

  it("agent dirty state does NOT affect skill dirty state (AC #4 — key isolation)", () => {
    const skillKey = "skill:/Users/test/.claude/skills/my-skill/SKILL.md" as const;
    const agentKey = "agent:/Users/test/.claude/agents/my-agent.md" as const;

    useAssetNav.getState().setDirty(agentKey, true);
    expect(useAssetNav.getState().dirtyByKey[skillKey]).toBeUndefined();
  });

  it("both skill and agent can be dirty simultaneously without collision", () => {
    const skillKey = "skill:/Users/test/.claude/skills/my-skill/SKILL.md" as const;
    const agentKey = "agent:/Users/test/.claude/agents/my-agent.md" as const;

    useAssetNav.getState().setDirty(skillKey, true);
    useAssetNav.getState().setDirty(agentKey, true);

    expect(useAssetNav.getState().dirtyByKey[skillKey]).toBe(true);
    expect(useAssetNav.getState().dirtyByKey[agentKey]).toBe(true);
  });

  it("clearing skill dirty does not clear agent dirty", () => {
    const skillKey = "skill:/Users/test/.claude/skills/my-skill/SKILL.md" as const;
    const agentKey = "agent:/Users/test/.claude/agents/my-agent.md" as const;

    useAssetNav.getState().setDirty(skillKey, true);
    useAssetNav.getState().setDirty(agentKey, true);
    useAssetNav.getState().clearDirty(skillKey);

    expect(useAssetNav.getState().dirtyByKey[skillKey]).toBeUndefined();
    expect(useAssetNav.getState().dirtyByKey[agentKey]).toBe(true);
  });

  it("same path under different kinds are stored as separate keys", () => {
    // Adversarial: same path used for both skill and agent (shouldn't happen in practice
    // but the key shape guarantees isolation regardless)
    const path = "/Users/test/.claude/test.md";
    const skillKey = `skill:${path}` as const;
    const agentKey = `agent:${path}` as const;

    useAssetNav.getState().setDirty(skillKey, true);
    useAssetNav.getState().setDirty(agentKey, false);

    expect(useAssetNav.getState().dirtyByKey[skillKey]).toBe(true);
    expect(useAssetNav.getState().dirtyByKey[agentKey]).toBe(false);
  });
});
