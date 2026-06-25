import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/actions/slug", () => ({
  checkSlugAvailabilityAction: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { checkSlugAvailabilityAction } from "@/lib/actions/slug";
import { useSlugAvailability } from "./useSlugAvailability";
import type { SlugAvailability } from "@/lib/actions/slug";

const mockCheck = checkSlugAvailabilityAction as MockedFunction<typeof checkSlugAvailabilityAction>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveWith(result: SlugAvailability) {
  mockCheck.mockResolvedValue(result);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// useSlugAvailability
// ---------------------------------------------------------------------------

describe("useSlugAvailability", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() => useSlugAvailability(""));
    expect(result.current.status).toBe("idle");
  });

  it("transitions to available after debounce delay for a valid slug", async () => {
    resolveWith({ available: true });
    const { result } = renderHook(() => useSlugAvailability("my-slug"));

    // Before debounce fires the action should not have been called
    act(() => { vi.advanceTimersByTime(399); });
    expect(mockCheck).not.toHaveBeenCalled();

    // After debounce fires the action is called and result is available
    await act(async () => {
      vi.advanceTimersByTime(1); // total 400ms — fires the timeout
    });
    expect(mockCheck).toHaveBeenCalledWith("my-slug");
    expect(result.current.status).toBe("available");
  });

  it("returns taken status when the action returns taken", async () => {
    resolveWith({ available: false, reason: "taken" });
    const { result } = renderHook(() => useSlugAvailability("taken-slug"));
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(result.current.status).toBe("taken");
  });

  it("returns invalid status when the action returns invalid", async () => {
    resolveWith({ available: false, reason: "invalid" });
    const { result } = renderHook(() => useSlugAvailability("bad slug!"));
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(result.current.status).toBe("invalid");
  });

  it("stays idle and does not call action when slug is empty", () => {
    const { result } = renderHook(() => useSlugAvailability(""));
    act(() => { vi.advanceTimersByTime(400); });
    expect(mockCheck).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("stays idle when slug equals currentSlug (own workspace — settings path)", () => {
    const { result } = renderHook(() => useSlugAvailability("my-slug", "my-slug"));
    act(() => { vi.advanceTimersByTime(400); });
    expect(mockCheck).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("ignores stale response — updates only from the most recent call", async () => {
    let firstResolve!: (v: { available: boolean; reason?: "invalid" | "taken" }) => void;
    const firstPromise = new Promise<{ available: boolean; reason?: "invalid" | "taken" }>((res) => {
      firstResolve = res;
    });
    mockCheck
      .mockReturnValueOnce(firstPromise as ReturnType<typeof mockCheck>)
      .mockResolvedValueOnce({ available: true });

    const { result, rerender } = renderHook(
      ({ slug }: { slug: string }) => useSlugAvailability(slug),
      { initialProps: { slug: "first-slug" } },
    );

    // Fire debounce for "first-slug" — starts slow first call
    await act(async () => { vi.advanceTimersByTime(400); });

    // Change slug before first resolves
    rerender({ slug: "second-slug" });
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(result.current.status).toBe("available");

    // Late-arriving stale response
    await act(async () => { firstResolve({ available: false, reason: "taken" }); });
    // Should still be "available"
    expect(result.current.status).toBe("available");
  });
});
