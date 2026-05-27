import { describe, it, expect, vi } from "vitest";
import { render, screen, renderHook } from "@testing-library/react";
import React from "react";
import { BrandKitProvider, useBrandKit, resolveBrandKit } from "./brandKitContext";
import { DEFAULT_BRAND_KIT } from "./types";
import type { PortfolioBrandKit } from "./types";

// ---------------------------------------------------------------------------
// Provider + hook integration
// ---------------------------------------------------------------------------

describe("BrandKitProvider + useBrandKit", () => {
  it("hook reads the kit injected by the provider", () => {
    const custom: PortfolioBrandKit = {
      ...DEFAULT_BRAND_KIT,
      themePreset: "luxury",
      primaryColor: "#ccaa88",
    };

    const { result } = renderHook(() => useBrandKit(), {
      wrapper: ({ children }) => (
        <BrandKitProvider brandKit={custom}>{children}</BrandKitProvider>
      ),
    });

    expect(result.current.themePreset).toBe("luxury");
    expect(result.current.primaryColor).toBe("#ccaa88");
  });

  it("falls back to DEFAULT_BRAND_KIT when no brandKit prop is passed", () => {
    const { result } = renderHook(() => useBrandKit(), {
      wrapper: ({ children }) => (
        <BrandKitProvider>{children}</BrandKitProvider>
      ),
    });

    expect(result.current).toEqual(DEFAULT_BRAND_KIT);
  });

  it("useBrandKit without provider throws with 'BrandKitProvider' in message", () => {
    // Suppress React's error boundary console noise during this intentional throw.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() =>
        renderHook(() => useBrandKit())
      ).toThrow(/BrandKitProvider/);
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// Provider renders children
// ---------------------------------------------------------------------------

describe("BrandKitProvider — rendering", () => {
  it("renders children correctly", () => {
    render(
      <BrandKitProvider brandKit={DEFAULT_BRAND_KIT}>
        <span data-testid="child">hello</span>
      </BrandKitProvider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("applies resolved CSS vars from DEFAULT_BRAND_KIT to a wrapper element", () => {
    const { cssVars, className } = resolveBrandKit(DEFAULT_BRAND_KIT);

    const { container } = render(
      <BrandKitProvider brandKit={DEFAULT_BRAND_KIT}>
        <div
          data-testid="page-wrapper"
          className={className}
          style={cssVars as React.CSSProperties}
        >
          content
        </div>
      </BrandKitProvider>
    );

    const wrapper = container.querySelector("[data-testid='page-wrapper']");
    expect(wrapper).not.toBeNull();
    // className should be applied
    expect(wrapper?.className).toBe("pf-theme-minimal pf-button-solid");
    // Inline CSS vars should be present
    const style = (wrapper as HTMLElement).style;
    expect(style.getPropertyValue("--pf-color-primary")).toBe("#111111");
    expect(style.getPropertyValue("--pf-color-bg")).toBe("#ffffff");
    expect(style.getPropertyValue("--pf-radius")).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// Provider nesting — innermost wins
// ---------------------------------------------------------------------------

describe("BrandKitProvider — nesting", () => {
  it("innermost provider value wins", () => {
    const outer: PortfolioBrandKit = { ...DEFAULT_BRAND_KIT, themePreset: "bold" };
    const inner: PortfolioBrandKit = { ...DEFAULT_BRAND_KIT, themePreset: "romantic" };

    const { result } = renderHook(() => useBrandKit(), {
      wrapper: ({ children }) => (
        <BrandKitProvider brandKit={outer}>
          <BrandKitProvider brandKit={inner}>{children}</BrandKitProvider>
        </BrandKitProvider>
      ),
    });

    expect(result.current.themePreset).toBe("romantic");
  });
});
