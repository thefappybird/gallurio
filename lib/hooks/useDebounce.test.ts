import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "./useDebounce";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebounce", () => {
  it("coalesces rapid calls into one trailing invocation with the last value", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, 120));

    act(() => {
      result.current.debounced("a");
      result.current.debounced("b");
      result.current.debounced("c");
    });

    // Not called yet — still within the debounce window
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("c");
  });

  it("clears the pending timer on unmount so callback is never called after", () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebounce(callback, 120));

    act(() => {
      result.current.debounced("x");
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("flush delivers the pending value immediately and cancels the timer", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, 120));

    act(() => {
      result.current.debounced("pending");
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      result.current.flush();
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("pending");

    // Timer should be cancelled — advancing should not trigger another call.
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
