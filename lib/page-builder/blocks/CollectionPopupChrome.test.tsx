import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CollectionPopupChrome } from "./CollectionPopupChrome";

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
});
