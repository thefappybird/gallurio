import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

// Mock PortfolioHeader to expose which config it received
vi.mock("@/app/(public)/w/[orgSlug]/_components/PortfolioHeader", () => ({
  PortfolioHeader: ({
    config,
    labels,
  }: {
    config: { brandText?: string } | null;
    labels: { home: string };
  }) => (
    <div>
      <div data-testid="header-brand">{config?.brandText ?? "no-brand"}</div>
      <div data-testid="header-home">{labels.home}</div>
    </div>
  ),
}));

import { PreviewBrandShell } from "./PreviewBrandShell";
import { PreviewHeaderShell } from "./PreviewHeaderShell";

const SLUG = "studio-header";
const KEY = `gallurio:portfolio-draft:${SLUG}`;

const LABELS = {
  brand: "Studio",
  navLandmark: "Nav",
  home: "Home",
  gallery: "Gallery",
  contact: "Contact",
  openMenu: "Open",
  closeMenu: "Close",
};

describe("PreviewHeaderShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("uses draft headerConfig when a valid draft is present", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        brandKit: { ...DEFAULT_BRAND_KIT },
        headerConfig: { brandText: "Draft Brand" },
      }),
    );

    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{}}
        fallbackClassName=""
      >
        <PreviewHeaderShell
          slug={SLUG}
          fallbackConfig={{ brandText: "DB Brand" }}
          activePath="/w/studio-header"
          homeHref="/en/portfolio-preview"
          labels={LABELS}
        />
      </PreviewBrandShell>,
    );

    expect(screen.getByTestId("header-brand")).toHaveTextContent("Draft Brand");
  });

  it("falls back to DB config when no draft is present", () => {
    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{}}
        fallbackClassName=""
      >
        <PreviewHeaderShell
          slug={SLUG}
          fallbackConfig={{ brandText: "DB Brand" }}
          activePath="/w/studio-header"
          homeHref="/en/portfolio-preview"
          labels={LABELS}
        />
      </PreviewBrandShell>,
    );

    expect(screen.getByTestId("header-brand")).toHaveTextContent("DB Brand");
  });

  it("falls back to DB config when draft has wrong version", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        headerConfig: { brandText: "Draft Brand" },
      }),
    );

    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{}}
        fallbackClassName=""
      >
        <PreviewHeaderShell
          slug={SLUG}
          fallbackConfig={{ brandText: "DB Brand" }}
          activePath="/w/studio-header"
          homeHref="/en/portfolio-preview"
          labels={LABELS}
        />
      </PreviewBrandShell>,
    );

    expect(screen.getByTestId("header-brand")).toHaveTextContent("DB Brand");
  });

  it("falls back to DB config when draft is malformed JSON", () => {
    window.localStorage.setItem(KEY, "{{bad json}}");

    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{}}
        fallbackClassName=""
      >
        <PreviewHeaderShell
          slug={SLUG}
          fallbackConfig={{ brandText: "DB Brand" }}
          activePath="/w/studio-header"
          homeHref="/en/portfolio-preview"
          labels={LABELS}
        />
      </PreviewBrandShell>,
    );

    expect(screen.getByTestId("header-brand")).toHaveTextContent("DB Brand");
  });
});
