/**
 * skill-nav store — unit tests.
 *
 * Covers all state transitions:
 *   - Initial state
 *   - open() → detail mode
 *   - edit() → editor mode
 *   - back() from editor → detail
 *   - back() from detail → library
 *   - back() from library → no-op
 *   - close() → library, clears selection
 *   - edit() with no selection → no-op
 *   - setSelected / setMode direct setters
 *
 * Story: 6.4 (FR-003, FR-004)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useSkillNav } from "../skill-nav";

// Reset Zustand store state between tests
beforeEach(() => {
  useSkillNav.setState({
    selectedSkillId: null,
    mode: "library",
  });
});

describe("useSkillNav store", () => {
  // ── Initial state ──────────────────────────────────────────────────────────

  it("starts with mode=library and no selection", () => {
    const { mode, selectedSkillId } = useSkillNav.getState();
    expect(mode).toBe("library");
    expect(selectedSkillId).toBeNull();
  });

  // ── open() ─────────────────────────────────────────────────────────────────

  it("open(id) sets mode=detail and selectedSkillId", () => {
    useSkillNav.getState().open("skill-123");
    const { mode, selectedSkillId } = useSkillNav.getState();
    expect(mode).toBe("detail");
    expect(selectedSkillId).toBe("skill-123");
  });

  // ── edit() ─────────────────────────────────────────────────────────────────

  it("edit() transitions to editor when a skill is selected", () => {
    useSkillNav.getState().open("skill-abc");
    useSkillNav.getState().edit();
    expect(useSkillNav.getState().mode).toBe("editor");
    expect(useSkillNav.getState().selectedSkillId).toBe("skill-abc");
  });

  it("edit() is a no-op when no skill is selected", () => {
    useSkillNav.getState().edit();
    expect(useSkillNav.getState().mode).toBe("library");
  });

  // ── back() ─────────────────────────────────────────────────────────────────

  it("back() from editor returns to detail, keeps selection", () => {
    useSkillNav.getState().open("skill-xyz");
    useSkillNav.getState().edit();
    useSkillNav.getState().back();
    const { mode, selectedSkillId } = useSkillNav.getState();
    expect(mode).toBe("detail");
    expect(selectedSkillId).toBe("skill-xyz");
  });

  it("back() from detail returns to library and clears selection", () => {
    useSkillNav.getState().open("skill-xyz");
    useSkillNav.getState().back();
    const { mode, selectedSkillId } = useSkillNav.getState();
    expect(mode).toBe("library");
    expect(selectedSkillId).toBeNull();
  });

  it("back() from library is a no-op", () => {
    useSkillNav.getState().back();
    const { mode, selectedSkillId } = useSkillNav.getState();
    expect(mode).toBe("library");
    expect(selectedSkillId).toBeNull();
  });

  // ── close() ────────────────────────────────────────────────────────────────

  it("close() always returns to library and clears selection", () => {
    useSkillNav.getState().open("skill-999");
    useSkillNav.getState().edit();
    useSkillNav.getState().close();
    const { mode, selectedSkillId } = useSkillNav.getState();
    expect(mode).toBe("library");
    expect(selectedSkillId).toBeNull();
  });

  // ── setSelected / setMode ──────────────────────────────────────────────────

  it("setSelected updates selectedSkillId", () => {
    useSkillNav.getState().setSelected("direct-set-id");
    expect(useSkillNav.getState().selectedSkillId).toBe("direct-set-id");
  });

  it("setSelected(null) clears selection", () => {
    useSkillNav.getState().open("skill-abc");
    useSkillNav.getState().setSelected(null);
    expect(useSkillNav.getState().selectedSkillId).toBeNull();
  });

  it("setMode directly sets the mode", () => {
    useSkillNav.getState().setMode("editor");
    expect(useSkillNav.getState().mode).toBe("editor");
  });

  // ── Full navigation flow ───────────────────────────────────────────────────

  it("full flow: library → detail → editor → detail → library", () => {
    const store = useSkillNav.getState();

    // Start: library
    expect(useSkillNav.getState().mode).toBe("library");

    // Open detail
    store.open("skill-flow-test");
    expect(useSkillNav.getState().mode).toBe("detail");
    expect(useSkillNav.getState().selectedSkillId).toBe("skill-flow-test");

    // Edit
    useSkillNav.getState().edit();
    expect(useSkillNav.getState().mode).toBe("editor");

    // Back to detail
    useSkillNav.getState().back();
    expect(useSkillNav.getState().mode).toBe("detail");
    expect(useSkillNav.getState().selectedSkillId).toBe("skill-flow-test");

    // Back to library
    useSkillNav.getState().back();
    expect(useSkillNav.getState().mode).toBe("library");
    expect(useSkillNav.getState().selectedSkillId).toBeNull();
  });
});
