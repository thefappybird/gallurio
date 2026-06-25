import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

// Mock CollectionPopupChrome to expose which config it received
vi.mock("@/lib/page-builder/blocks/CollectionPopupChrome", () => ({
  CollectionPopupChrome: ({
    config,
    collectionName,
  }: {
    config: { backgroundColor?: string };
    collectionName: string;
  }) => (
    <div data-testid="popup-chrome">
      <span data-testid="popup-bg">{config?.backgroundColor ?? "no-bg"}</span>
      <span data-testid="popup-name">{collectionName}</span>
    </div>
  ),
}));

import { PreviewBrandShell } from "./PreviewBrandShell";
import { PreviewPopupShell } from "./PreviewPopupShell";

const SLUG = "studio-popup";
const KEY = `gallurio:portfolio-draft:${SLUG}`;

describe("PreviewPopupShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the dedicated popup-preview surface with draft collectionsPopup config when present", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        brandKit: { ...DEFAULT_BRAND_KIT },
        collectionsPopup: { backgroundColor: "primary" },
      }),
    );

    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{}}
        fallbackClassName=""
      >
        <PreviewPopupShell
          fallbackConfig={{ backgroundColor: "secondary" }}
        />
      </PreviewBrandShell>,
    );

    // The dedicated surface wrapper is always present
    expect(screen.getByTestId("popup-preview-surface")).toBeInTheDocument();
    // Chrome is rendered inside the dedicated surface
    expect(screen.getByTestId("popup-chrome")).toBeInTheDocument();
    // Draft config wins over fallback
    expect(screen.getByTestId("popup-bg")).toHaveTextContent("primary");
  });

  it("falls back to DB config when no draft is present", () => {
    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{}}
        fallbackClassName=""
      >
        <PreviewPopupShell
          fallbackConfig={{ backgroundColor: "secondary" }}
        />
      </PreviewBrandShell>,
    );

    expect(screen.getByTestId("popup-preview-surface")).toBeInTheDocument();
    expect(screen.getByTestId("popup-chrome")).toBeInTheDocument();
    expect(screen.getByTestId("popup-bg")).toHaveTextContent("secondary");
  });

  it("renders the popup surface even when both draft and fallback configs are absent", () => {
    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{}}
        fallbackClassName=""
      >
        <PreviewPopupShell
          fallbackConfig={null}
        />
      </PreviewBrandShell>,
    );

    expect(screen.getByTestId("popup-preview-surface")).toBeInTheDocument();
    expect(screen.getByTestId("popup-chrome")).toBeInTheDocument();
  });
});
