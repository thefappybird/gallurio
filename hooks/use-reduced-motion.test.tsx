import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

describe("usePrefersReducedMotion", () => {
  it("reports true when the user asked for reduced motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(true);
    vi.unstubAllGlobals();
  });
});
