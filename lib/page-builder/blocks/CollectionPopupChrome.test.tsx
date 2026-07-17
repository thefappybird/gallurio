import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CollectionPopupChrome, resolvePopupBackground } from "./CollectionPopupChrome";

describe("CollectionPopupChrome", () => {
  it("shows the collection name when no title override", () => {
    render(
      <CollectionPopupChrome collectionName="Weddings" config={{}} onClose={() => {}}>
        <div>body</div>
      </CollectionPopupChrome>,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Weddings");
  });

  it("uses the global title override when set", () => {
    render(
      <CollectionPopupChrome
        collectionName="Weddings"
        config={{ titleText: "Galleries", titleAlign: "center" }}
        onClose={() => {}}
      >
        <div>body</div>
      </CollectionPopupChrome>,
    );
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2).toHaveTextContent("Galleries");
    expect(h2.style.textAlign).toBe("center");
  });

  it("applies close-button size + fires onClose", () => {
    const onClose = vi.fn();
    render(
      <CollectionPopupChrome collectionName="W" config={{ closeButtonSize: 48 }} onClose={onClose}>
        <div>body</div>
      </CollectionPopupChrome>,
    );
    const btn = screen.getByRole("button", { name: /close/i });
    expect(btn.style.width).toBe("48px");
    btn.click();
    expect(onClose).toHaveBeenCalled();
  });

  // ── Field (a): popup background color effective-default ────────────────────

  // Note: happy-dom's CSSStyleDeclaration does not support the two-argument
  // var(--x, fallback) syntax (it silently drops the whole declaration), so the
  // background resolution is tested as a pure function rather than via DOM style
  // introspection. See resolvePopupBackground in CollectionPopupChrome.tsx.
  it("resolves to the theme background with a literal fallback when backgroundColor is unset", () => {
    expect(resolvePopupBackground(undefined)).toBe("var(--pf-color-bg, #ffffff)");
  });

  it("resolves an explicit backgroundColor token over the primary fallback", () => {
    expect(resolvePopupBackground("accent")).toBe("var(--pf-color-accent)");
  });

  // ── Field (c): close button radius effective-default (rounded) ─────────────

  it("uses rounded (16px) as close button radius when closeButtonRadius is unset", () => {
    render(
      <CollectionPopupChrome collectionName="W" config={{}} onClose={() => {}}>
        <div>body</div>
      </CollectionPopupChrome>,
    );
    const btn = screen.getByRole("button", { name: /close/i });
    expect(btn.style.borderRadius).toBe("16px");
  });

  it("uses rounded (16px) as close button radius when closeButtonRadius is cleared (empty string)", () => {
    render(
      <CollectionPopupChrome collectionName="W" config={{ closeButtonRadius: "" }} onClose={() => {}}>
        <div>body</div>
      </CollectionPopupChrome>,
    );
    const btn = screen.getByRole("button", { name: /close/i });
    expect(btn.style.borderRadius).toBe("16px");
  });

  it("respects explicit sharp close button radius (0px)", () => {
    render(
      <CollectionPopupChrome collectionName="W" config={{ closeButtonRadius: "sharp" }} onClose={() => {}}>
        <div>body</div>
      </CollectionPopupChrome>,
    );
    const btn = screen.getByRole("button", { name: /close/i });
    expect(btn.style.borderRadius).toBe("0px");
  });
});
