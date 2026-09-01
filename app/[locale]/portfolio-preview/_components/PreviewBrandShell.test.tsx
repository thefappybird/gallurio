import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

vi.mock("@/lib/page-builder/MotionObserver.client", () => ({
  MotionObserver: () => <div data-testid="motion-observer-mounted" />,
}));

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

    const { container } = render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{ "--pf-color-bg": "#ffffff" }}
        fallbackClassName="pf-theme-minimal pf-button-solid"
        allowBrowserRecovery
      >
        <span data-testid="child">content</span>
      </PreviewBrandShell>,
    );

    const wrapper = container.firstChild as HTMLElement;
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

    const { container } = render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{}}
        fallbackClassName="pf-theme-minimal pf-button-solid"
        allowBrowserRecovery
      >
        <span>content</span>
      </PreviewBrandShell>,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("pf-theme-editorial");
    expect(wrapper.className).toContain("pf-button-outline");
  });

  it("falls back to fallbackCssVars when no draft is present", () => {
    const { container } = render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{ "--pf-color-bg": "#aabbcc" }}
        fallbackClassName="pf-theme-minimal pf-button-solid"
      >
        <span data-testid="child">content</span>
      </PreviewBrandShell>,
    );

    const wrapper = container.firstChild as HTMLElement;
    const style = wrapper.getAttribute("style") ?? "";
    expect(style).toContain("--pf-color-bg: #aabbcc");
    expect(wrapper.className).toContain("pf-theme-minimal");
  });

  it("falls back to fallbackCssVars when draft is malformed", () => {
    window.localStorage.setItem(KEY, "not-valid-json{{{");

    const { container } = render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{ "--pf-color-bg": "#ffeecc" }}
        fallbackClassName="pf-theme-bold pf-button-soft"
      >
        <span>content</span>
      </PreviewBrandShell>,
    );

    const wrapper = container.firstChild as HTMLElement;
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

    const { container } = render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{ "--pf-color-bg": "#ffffff" }}
        fallbackClassName="pf-theme-minimal pf-button-solid"
      >
        <span>content</span>
      </PreviewBrandShell>,
    );

    const wrapper = container.firstChild as HTMLElement;
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

    const { container } = render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{ "--pf-color-bg": "#ffffff" }}
        fallbackClassName="pf-theme-minimal pf-button-solid"
      >
        <span>content</span>
      </PreviewBrandShell>,
    );

    const wrapper = container.firstChild as HTMLElement;
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

  it("does not server-render fallback children before the local draft is read", () => {
    const html = renderToStaticMarkup(
      <PreviewBrandShell slug={SLUG} fallbackCssVars={{}} fallbackClassName="" allowBrowserRecovery>
        <span>Published fallback</span>
      </PreviewBrandShell>,
    );

    expect(html).toContain("Loading preview");
    expect(html).not.toContain("Published fallback");
  });

  it("falls back when draft brandKit is structurally present but malformed (missing required fields)", () => {
    // A draft with version 2 and a brandKit object that lacks required color/radius/themePreset fields
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        brandKit: {},
      }),
    );

    const { container } = render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{ "--pf-color-bg": "#fallback" }}
        fallbackClassName="pf-theme-minimal pf-button-solid"
      >
        <span>content</span>
      </PreviewBrandShell>,
    );

    const wrapper = container.firstChild as HTMLElement;
    const style = wrapper.getAttribute("style") ?? "";
    // Must use fallback — no pf-theme-undefined
    expect(style).not.toContain("pf-theme-undefined");
    expect(wrapper.className).not.toContain("pf-theme-undefined");
    expect(wrapper.className).toContain("pf-theme-minimal");
    expect(style).toContain("--pf-color-bg: #fallback");
  });

  it("paints the brand background color, not just defining the custom property", () => {
    const { container } = render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{ "--pf-color-bg": "#fcfcfb" }}
        fallbackClassName="pf-theme-minimal pf-button-solid"
      >
        <span>content</span>
      </PreviewBrandShell>,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.backgroundColor).toBe("var(--pf-color-bg)");
  });

  it("mounts MotionObserver so entrance-animated blocks reveal on scroll in preview", () => {
    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{}}
        fallbackClassName=""
      >
        <span>content</span>
      </PreviewBrandShell>,
    );

    expect(screen.getByTestId("motion-observer-mounted")).toBeInTheDocument();
  });
});
