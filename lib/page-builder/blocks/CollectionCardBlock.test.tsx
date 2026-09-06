import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  CollectionCardBlock,
  collectionCardDefaultProps,
} from "./CollectionCardBlock";
import type { FeaturedCollectionRef } from "./FeaturedWorkBlock";

const COLLECTION: FeaturedCollectionRef = {
  id: "c1",
  name: "Isabel & Marco",
  coverPublicId: "cover-1",
  itemCount: 42,
};

describe("CollectionCardBlock", () => {
  it("renders the cover at the chosen crop, not FeaturedWork's hardcoded 7/9", () => {
    const { container } = render(
      <CollectionCardBlock collection={COLLECTION} aspectRatio="3 / 2" />
    );
    // The cover is an <img> once a real delivery URL resolves, and a
    // placeholder div until then; both carry the crop.
    const cover = container.querySelector("[data-featured-tile] img, [data-cover-placeholder]");
    expect(cover).toHaveStyle({ aspectRatio: "3 / 2" });
  });

  it("renders a visible media shape and caption line in a preset hover preview", () => {
    const { container } = render(
      <CollectionCardBlock
        {...collectionCardDefaultProps}
        puck={{ metadata: { presetPreview: true } }}
      />
    );

    expect(screen.queryByText(/no featured photos selected yet/i)).not.toBeInTheDocument();
    expect(container.querySelector("[data-preset-collection-placeholder='true']")).toBeInTheDocument();
    expect(container.querySelector("[data-preset-collection-caption='true']")).toBeInTheDocument();
  });

  it("applies radius to the clickable tile and clips its cover without a border", () => {
    const { container } = render(
      <CollectionCardBlock collection={COLLECTION} _style={{ radius: 16, bgColorToken: "primary" }} />,
    );

    const tile = container.querySelector("[data-featured-tile]") as HTMLElement;
    expect(tile.style.borderRadius).toBe("16px");
    expect(tile.style.overflow).toBe("hidden");
    expect(tile.style.backgroundColor).toBe("var(--pf-color-primary)");
  });

  it("uses the collection-title typography and color for its empty state", () => {
    const { container } = render(
      <CollectionCardBlock
        _style={{
          collectionTitleColorToken: "accent",
          collectionTitleFontSize: 24,
          collectionTitleBold: true,
        }}
      />,
    );

    const empty = container.querySelector("[data-cover-placeholder]") as HTMLElement;
    expect(empty.style.color).toBe("var(--pf-color-accent)");
    expect(empty.style.fontSize).toBe("24px");
    expect(empty.style.fontWeight).toBe("700");
  });

  it("threads puck.metadata.workspace.dir='rtl' onto the opened popup's portaled shell", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], nextCursor: null }),
        })
      )
    );

    render(
      <CollectionCardBlock
        collection={COLLECTION}
        puck={{
          metadata: {
            workspace: {
              _id: "ws1",
              name: "Studio",
              slug: "studio",
              publicPage: { collectionsPopup: {} },
              dir: "rtl",
            },
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Isabel & Marco/i }));

    const shell = await screen.findByRole("heading", { level: 2 }).then((h) => h.closest("[data-popup-shell]"));
    expect(shell).not.toBeNull();
    expect(shell).toHaveAttribute("dir", "rtl");

    vi.unstubAllGlobals();
  });
});
