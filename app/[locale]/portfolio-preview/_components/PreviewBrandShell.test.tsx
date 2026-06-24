import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import { PreviewBrandShell } from "./PreviewBrandShell";

const SLUG = "studio-test";
const KEY = `gallurio:portfolio-draft:${SLUG}`;

describe("PreviewBrandShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("applies draft brandKit cssVars when draft has a valid brandKit with different backgroundColor", () => {
    const draftBrandKit = {
      ...DEFAULT_BRAND_KIT,
      backgroundColor: "#123456",
    };

    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        brandKit: draftBrandKit,
      }),
    );

    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{ "--pf-color-bg": "#ffffff" }}
        fallbackClassName="pf-theme-minimal pf-button-solid"
      >
        <span data-testid="child">content</span>
      </PreviewBrandShell>,
    );

    const wrapper = screen.getByTestId("preview-brand-shell");
    const style = wrapper.getAttribute("style") ?? "";
    // Draft backgroundColor is #123456, so --pf-color-bg should be the draft value
    expect(style).toContain("--pf-color-bg: #123456");
  });

  it("className includes draft themePreset and buttonStyle when draft is valid", () => {
    const draftBrandKit = {
      ...DEFAULT_BRAND_KIT,
      themePreset: "editorial" as const,
      buttonStyle: "outline" as const,
      backgroundColor: "#123456",
    };

    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        brandKit: draftBrandKit,
      }),
    );

    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{}}
        fallbackClassName="pf-theme-minimal pf-button-solid"
      >
        <span>content</span>
      </PreviewBrandShell>,
    );

    const wrapper = screen.getByTestId("preview-brand-shell");
    expect(wrapper.className).toContain("pf-theme-editorial");
    expect(wrapper.className).toContain("pf-button-outline");
  });

  it("falls back to fallbackCssVars when no draft is present", () => {
    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{ "--pf-color-bg": "#aabbcc" }}
        fallbackClassName="pf-theme-minimal pf-button-solid"
      >
        <span data-testid="child">content</span>
      </PreviewBrandShell>,
    );

    const wrapper = screen.getByTestId("preview-brand-shell");
    const style = wrapper.getAttribute("style") ?? "";
    expect(style).toContain("--pf-color-bg: #aabbcc");
    expect(wrapper.className).toContain("pf-theme-minimal");
  });

  it("falls back to fallbackCssVars when draft is malformed", () => {
    window.localStorage.setItem(KEY, "not-valid-json{{{");

    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{ "--pf-color-bg": "#ffeecc" }}
        fallbackClassName="pf-theme-bold pf-button-soft"
      >
        <span>content</span>
      </PreviewBrandShell>,
    );

    const wrapper = screen.getByTestId("preview-brand-shell");
    const style = wrapper.getAttribute("style") ?? "";
    expect(style).toContain("--pf-color-bg: #ffeecc");
    expect(wrapper.className).toContain("pf-theme-bold");
  });

  it("falls back when draft version is not 2", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        brandKit: { ...DEFAULT_BRAND_KIT, backgroundColor: "#999999" },
      }),
    );

    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{ "--pf-color-bg": "#ffffff" }}
        fallbackClassName="pf-theme-minimal pf-button-solid"
      >
        <span>content</span>
      </PreviewBrandShell>,
    );

    const wrapper = screen.getByTestId("preview-brand-shell");
    const style = wrapper.getAttribute("style") ?? "";
    expect(style).toContain("--pf-color-bg: #ffffff");
  });

  it("falls back when draft has no brandKit field", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        data: { home: { content: [], root: {} } },
      }),
    );

    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{ "--pf-color-bg": "#ffffff" }}
        fallbackClassName="pf-theme-minimal pf-button-solid"
      >
        <span>content</span>
      </PreviewBrandShell>,
    );

    const wrapper = screen.getByTestId("preview-brand-shell");
    const style = wrapper.getAttribute("style") ?? "";
    expect(style).toContain("--pf-color-bg: #ffffff");
  });

  it("renders children inside the shell", () => {
    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{}}
        fallbackClassName=""
      >
        <span data-testid="inner">hello</span>
      </PreviewBrandShell>,
    );

    expect(screen.getByTestId("inner")).toBeInTheDocument();
  });
});
