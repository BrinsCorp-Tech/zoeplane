/**
 * useLibrarySSE — unit tests.
 *
 * Covers:
 *   (a) hook returns early when enabled === false (no EventSource opened)
 *   (b) hook returns early when getSidecarBaseUrl() returns null
 *   (c) hook invalidates the correct cache key on a matching event
 *   (d) hook ignores events with mismatched kind
 *   (e) hook ignores events with mismatched type
 *   (f) hook closes the EventSource on unmount
 *
 * Tests are parameterized over at least two kinds ("agent", "skill") to verify
 * the predicate is truly parametric.
 *
 * Story: 6.12 — Library SSE Invalidation Hook Extraction
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useLibrarySSE } from "../useLibrarySSE";

// ---------------------------------------------------------------------------
// MockEventSource shim
// ---------------------------------------------------------------------------
// Matches the shape used in AgentLibraryView.test.tsx and SkillLibraryView.test.tsx.
// Captures the "message" listener so tests can fire synthetic events.

let capturedMessageHandler: ((e: MessageEvent) => void) | null = null;
let mockCloseCallCount = 0;
let mockConstructorCallCount = 0;

class MockEventSource {
  constructor(public readonly url: string) {
    mockConstructorCallCount++;
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void): void {
    if (type === "message") capturedMessageHandler = handler;
  }

  close(): void {
    mockCloseCallCount++;
  }
}

vi.stubGlobal("EventSource", MockEventSource);

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/sidecar-client", () => ({
  getSidecarBaseUrl: vi.fn().mockReturnValue("http://127.0.0.1:9999"),
  subscribeSidecarPort: vi.fn((_cb: () => void) => {
    return () => {};
  }),
}));

import { getSidecarBaseUrl } from "@/lib/sidecar-client";
const mockGetSidecarBaseUrl = vi.mocked(getSidecarBaseUrl);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap the hook under test in a fresh QueryClient provider. */
function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { Wrapper, client };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  capturedMessageHandler = null;
  mockCloseCallCount = 0;
  mockConstructorCallCount = 0;
  mockGetSidecarBaseUrl.mockReturnValue("http://127.0.0.1:9999");
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useLibrarySSE", () => {
  // ── (a) enabled === false ──────────────────────────────────────────────────

  it("does not open an EventSource when enabled is false (kind=agent)", () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useLibrarySSE("agent", false), { wrapper: Wrapper });
    expect(capturedMessageHandler).toBeNull();
  });

  it("does not open an EventSource when enabled is false (kind=skill)", () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useLibrarySSE("skill", false), { wrapper: Wrapper });
    expect(capturedMessageHandler).toBeNull();
  });

  // ── (b) getSidecarBaseUrl() returns null ───────────────────────────────────

  it("does not open an EventSource when getSidecarBaseUrl returns null", () => {
    mockGetSidecarBaseUrl.mockReturnValue(null);
    const { Wrapper } = makeWrapper();
    renderHook(() => useLibrarySSE("agent", true), { wrapper: Wrapper });
    expect(capturedMessageHandler).toBeNull();
  });

  // ── (c) invalidates correct cache key on matching event ───────────────────

  it("invalidates ['assets', 'agent'] cache when a matching library:refresh event arrives", async () => {
    const { Wrapper, client } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    renderHook(() => useLibrarySSE("agent", true), { wrapper: Wrapper });

    expect(capturedMessageHandler).not.toBeNull();

    capturedMessageHandler!({
      data: JSON.stringify({ type: "library:refresh", kind: "agent" }),
    } as MessageEvent);

    // invalidateQueries is called with void (returns a promise); wait for microtasks
    await Promise.resolve();

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["assets", "agent"] });
  });

  it("invalidates ['assets', 'skill'] cache when a matching library:refresh event arrives", async () => {
    const { Wrapper, client } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    renderHook(() => useLibrarySSE("skill", true), { wrapper: Wrapper });

    expect(capturedMessageHandler).not.toBeNull();

    capturedMessageHandler!({
      data: JSON.stringify({ type: "library:refresh", kind: "skill" }),
    } as MessageEvent);

    await Promise.resolve();

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["assets", "skill"] });
  });

  // ── (d) ignores events with mismatched kind ────────────────────────────────

  it("does not invalidate when event kind does not match (agent hook, skill event)", async () => {
    const { Wrapper, client } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    renderHook(() => useLibrarySSE("agent", true), { wrapper: Wrapper });

    capturedMessageHandler!({
      data: JSON.stringify({ type: "library:refresh", kind: "skill" }),
    } as MessageEvent);

    await Promise.resolve();

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("does not invalidate when event kind does not match (skill hook, agent event)", async () => {
    const { Wrapper, client } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    renderHook(() => useLibrarySSE("skill", true), { wrapper: Wrapper });

    capturedMessageHandler!({
      data: JSON.stringify({ type: "library:refresh", kind: "agent" }),
    } as MessageEvent);

    await Promise.resolve();

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  // ── (e) ignores events with mismatched type ────────────────────────────────

  it("does not invalidate when event type is not library:refresh", async () => {
    const { Wrapper, client } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    renderHook(() => useLibrarySSE("agent", true), { wrapper: Wrapper });

    capturedMessageHandler!({
      data: JSON.stringify({ type: "some:other:event", kind: "agent" }),
    } as MessageEvent);

    await Promise.resolve();

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  // ── (e) malformed JSON — silent swallow ────────────────────────────────────

  it("silently swallows malformed JSON without throwing", () => {
    const { Wrapper } = makeWrapper();

    renderHook(() => useLibrarySSE("agent", true), { wrapper: Wrapper });

    expect(() => {
      capturedMessageHandler!({ data: "not-valid-json{{{{" } as MessageEvent);
    }).not.toThrow();
  });

  // ── (f) closes EventSource on unmount ─────────────────────────────────────

  it("closes the EventSource when the hook unmounts", () => {
    const { Wrapper } = makeWrapper();

    const { unmount } = renderHook(() => useLibrarySSE("agent", true), { wrapper: Wrapper });

    expect(capturedMessageHandler).not.toBeNull();
    expect(mockCloseCallCount).toBe(0);

    unmount();

    expect(mockCloseCallCount).toBe(1);
  });

  it("closes the EventSource when enabled toggles from true to false", () => {
    const { Wrapper } = makeWrapper();

    let enabled = true;
    const { rerender } = renderHook(() => useLibrarySSE("skill", enabled), { wrapper: Wrapper });

    expect(mockCloseCallCount).toBe(0);

    enabled = false;
    rerender();

    // The cleanup from the previous effect fires — EventSource is closed
    expect(mockCloseCallCount).toBe(1);
  });

  // ── (g) baseUrl-change invariant ──────────────────────────────────────────

  // Invariant: the hook does NOT track getSidecarBaseUrl() changes — port-change
  // reconnection is the caller's responsibility via `enabled`. Adding the baseUrl
  // to the effect dep array would create a double-open race with the caller.
  it("does not open a second EventSource when getSidecarBaseUrl() changes while enabled stays true", () => {
    const { Wrapper } = makeWrapper();

    const { rerender } = renderHook(() => useLibrarySSE("agent", true), { wrapper: Wrapper });

    // Confirm exactly 1 EventSource opened after initial render
    expect(mockConstructorCallCount).toBe(1);
    expect(mockCloseCallCount).toBe(0);

    // Simulate a port change — caller would toggle `enabled` to reconnect,
    // but here we change only the mock return value without touching `enabled`
    mockGetSidecarBaseUrl.mockReturnValue("http://127.0.0.1:11111");

    // Re-render the same hook instance (same enabled=true, same kind="agent")
    // The effect dep array [enabled, kind, queryClient] has not changed,
    // so React must NOT re-run the effect regardless of the baseUrl change.
    rerender();

    // Still exactly 1 constructor call — no spurious second open
    expect(mockConstructorCallCount).toBe(1);
    // Still exactly 0 close calls — no spurious cleanup
    expect(mockCloseCallCount).toBe(0);
  });
});
