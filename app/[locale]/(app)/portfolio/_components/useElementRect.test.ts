import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useElementRect } from "./useElementRect";

// ---------------------------------------------------------------------------
// rAF strategy
//
// useElementRect runs a requestAnimationFrame loop that schedules itself
// forever. Using vi.runAllTimers() hits vitest's infinite-loop guard.
// Instead we:
//   1. Manually track rAF callbacks with a simple queue.
//   2. Call flushRaf() to drain one cycle (run all pending callbacks once).
// ---------------------------------------------------------------------------

type RafCallback = (time: number) => void;
const rafQueue: RafCallback[] = [];
let rafId = 0;

function mockRequestAnimationFrame(cb: RafCallback): number {
  rafQueue.push(cb);
  return ++rafId;
}

function mockCancelAnimationFrame(id: number) {
  // Remove by marking; simplest approach is to just drain on flush.
  // We don't track ids precisely — cancelAnimationFrame in the hook is called
  // on cleanup, which stops the loop from being rescheduled after unmount.
  void id;
}

/** Run all currently-queued rAF callbacks once (does NOT re-run new ones). */
function flushRaf() {
  const callbacks = rafQueue.splice(0, rafQueue.length);
  act(() => {
    callbacks.forEach((cb) => cb(performance.now()));
  });
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", mockRequestAnimationFrame);
  vi.stubGlobal("cancelAnimationFrame", mockCancelAnimationFrame);
});

afterEach(() => {
  vi.unstubAllGlobals();
  rafQueue.length = 0;
  rafId = 0;
  document.querySelectorAll("[data-tour-id]").forEach((el) => el.remove());
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Insert a div with `data-tour-id` into the body and override
 * `getBoundingClientRect` with the supplied values.
 */
function insertAnchor(
  id: string,
  rectFactory: () => { top: number; left: number; width: number; height: number }
): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("data-tour-id", id);
  el.getBoundingClientRect = () => {
    const r = rectFactory();
    return {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      bottom: r.top + r.height,
      right: r.left + r.width,
      toJSON() { return this; },
    } as DOMRect;
  };
  document.body.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useElementRect", () => {
  it("returns null when id is undefined", () => {
    const { result } = renderHook(() => useElementRect(undefined));
    flushRaf();
    expect(result.current).toBeNull();
  });

  it("returns null when the anchor element is absent from the DOM", () => {
    const { result } = renderHook(() => useElementRect("missing-anchor"));
    flushRaf();
    expect(result.current).toBeNull();
  });

  it("returns the rect when the anchor element is present with a non-zero size", () => {
    const el = insertAnchor("present-anchor", () => ({
      top: 100, left: 200, width: 300, height: 50,
    }));

    const { result } = renderHook(() => useElementRect("present-anchor"));
    flushRaf();

    expect(result.current).not.toBeNull();
    expect(result.current?.top).toBe(100);
    expect(result.current?.left).toBe(200);
    expect(result.current?.width).toBe(300);
    expect(result.current?.height).toBe(50);

    el.remove();
  });

  // ── 1d: transient-zero retention ─────────────────────────────────────────────

  it("retains the last valid rect when getBoundingClientRect transiently returns zeros (does NOT null out)", () => {
    // Phase 1: element reports a real size.
    let currentRect = { top: 50, left: 80, width: 120, height: 30 };
    const el = insertAnchor("flicker-anchor", () => ({ ...currentRect }));

    const { result } = renderHook(() => useElementRect("flicker-anchor"));
    flushRaf(); // first rAF — picks up the valid rect

    expect(result.current?.width).toBe(120);
    expect(result.current?.height).toBe(30);

    // Phase 2: simulate transient zero (re-layout frame — element still in DOM)
    currentRect = { top: 0, left: 0, width: 0, height: 0 };
    flushRaf(); // next rAF — should SKIP the zero reading

    // Must retain the previous valid rect, not null out
    expect(result.current).not.toBeNull();
    expect(result.current?.width).toBe(120);
    expect(result.current?.height).toBe(30);

    el.remove();
  });

  it("updates to a new valid rect after a transient zero clears", () => {
    let currentRect = { top: 50, left: 80, width: 120, height: 30 };
    const el = insertAnchor("recover-anchor", () => ({ ...currentRect }));

    const { result } = renderHook(() => useElementRect("recover-anchor"));
    flushRaf(); // initial valid reading

    expect(result.current?.width).toBe(120);

    // Transient zero
    currentRect = { top: 0, left: 0, width: 0, height: 0 };
    flushRaf();
    expect(result.current?.width).toBe(120); // retained

    // Element recovers with new position
    currentRect = { top: 60, left: 90, width: 150, height: 35 };
    flushRaf();
    expect(result.current?.width).toBe(150);
    expect(result.current?.top).toBe(60);

    el.remove();
  });

  it("clears to null when id switches to undefined (true DOM absence via id change)", () => {
    const el = insertAnchor("switch-anchor", () => ({
      top: 5, left: 5, width: 60, height: 20,
    }));

    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useElementRect(id),
      { initialProps: { id: "switch-anchor" as string | undefined } }
    );
    flushRaf();
    expect(result.current?.width).toBe(60);

    act(() => {
      rerender({ id: undefined });
    });
    flushRaf();
    expect(result.current).toBeNull();

    el.remove();
  });

  // ── detached-node hardening ───────────────────────────────────────────────

  it("clears to null and stops looping when element is detached mid-loop (isConnected → false)", () => {
    const el = insertAnchor("detach-anchor", () => ({
      top: 10, left: 20, width: 80, height: 30,
    }));

    const { result } = renderHook(() => useElementRect("detach-anchor"));
    flushRaf(); // picks up valid rect
    expect(result.current?.width).toBe(80);

    // Remove from DOM — simulates Puck re-rendering and unmounting the sidebar.
    el.remove();
    // el.isConnected is now false; the next rAF loop iteration should clear.
    flushRaf();
    expect(result.current).toBeNull();
  });

  it("re-acquires a replacement node with the same tour id when the original is detached mid-loop (Puck override remount)", () => {
    // Puck re-renders an inline override → the old anchor node is removed and a
    // NEW node with the same data-tour-id is inserted in the same commit. The
    // hook must keep tracking the live node, not clear to null permanently.
    const first = insertAnchor("remount-anchor", () => ({
      top: 10, left: 20, width: 80, height: 30,
    }));

    const { result } = renderHook(() => useElementRect("remount-anchor"));
    flushRaf();
    expect(result.current?.width).toBe(80);

    // Simulate Puck remount: remove the old node, insert a fresh one at a new
    // position with the same tour id.
    first.remove();
    const second = insertAnchor("remount-anchor", () => ({
      top: 40, left: 50, width: 120, height: 60,
    }));
    flushRaf();

    // Must re-acquire the replacement node, not stay null.
    expect(result.current).not.toBeNull();
    expect(result.current?.width).toBe(120);
    expect(result.current?.top).toBe(40);

    second.remove();
  });

  it("does NOT clear to null when element has zero size but is still connected (transient zero)", () => {
    let currentRect = { top: 10, left: 20, width: 80, height: 30 };
    const el = insertAnchor("connected-zero-anchor", () => ({ ...currentRect }));

    const { result } = renderHook(() => useElementRect("connected-zero-anchor"));
    flushRaf();
    expect(result.current?.width).toBe(80);

    // Zero-size but still connected (mid-layout, not detached).
    currentRect = { top: 0, left: 0, width: 0, height: 0 };
    flushRaf();
    // Must retain the last valid rect, NOT clear to null.
    expect(result.current).not.toBeNull();
    expect(result.current?.width).toBe(80);

    el.remove();
  });

  it("does NOT skip a zero-size rect on the very first measurement if no prior valid rect exists", () => {
    // If the element starts at zero size and never had a valid measurement,
    // the hook should stay at null (no stale positive-size rect to retain).
    const el = insertAnchor("zero-from-start", () => ({
      top: 0, left: 0, width: 0, height: 0,
    }));

    const { result } = renderHook(() => useElementRect("zero-from-start"));
    flushRaf();
    flushRaf();

    // Either null or a zero rect is acceptable — no positive-size rect should appear.
    if (result.current !== null) {
      expect(result.current.width).toBe(0);
      expect(result.current.height).toBe(0);
    }

    el.remove();
  });
});
