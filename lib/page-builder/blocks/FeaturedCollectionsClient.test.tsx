import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  FeaturedCollectionsClient,
  type FeaturedTile,
  type FeaturedCollectionsClientProps,
} from "./FeaturedCollectionsClient";
import type { PortfolioCollectionsPopupConfig } from "@/lib/page-builder/types";

// ---------------------------------------------------------------------------
// Mock CollectionPopup to isolate grid/active-state logic
// ---------------------------------------------------------------------------

vi.mock("./CollectionPopup", () => ({
  CollectionPopup: ({
    collectionId,
    collectionName,
    open,
    onClose,
  }: {
    collectionId: string;
    collectionName: string;
    open: boolean;
    onClose: () => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="collection-popup" data-collection-id={collectionId}>
        <span>{collectionName}</span>
        <button type="button" onClick={onClose} data-testid="popup-close">
          Close
        </button>
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseConfig: PortfolioCollectionsPopupConfig = {
  backgroundColor: undefined,
  borderColor: undefined,
  borderWidth: undefined,
  radius: undefined,
};

const tiles: FeaturedTile[] = [
  { id: "col-1", name: "Weddings", count: 3, coverUrl: "https://example.com/cover1.jpg" },
  { id: "col-2", name: "Portraits", count: 1, coverUrl: "https://example.com/cover2.jpg" },
  { id: "col-3", name: "Events", count: 0, coverUrl: "" },
];

const baseProps: FeaturedCollectionsClientProps = {
  tiles,
  columns: 3,
  mode: "public",
  slug: "test-studio",
  popupConfig: baseConfig,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FeaturedCollectionsClient", () => {
  describe("tile rendering", () => {
    it("renders one button per tile", () => {
      render(<FeaturedCollectionsClient {...baseProps} />);
      const buttons = screen.getAllByRole("button");
      // 3 tile buttons (popup is closed, so no close button)
      expect(buttons).toHaveLength(3);
    });

    it("renders each tile name", () => {
      render(<FeaturedCollectionsClient {...baseProps} />);
      expect(screen.getByText("Weddings")).toBeInTheDocument();
      expect(screen.getByText("Portraits")).toBeInTheDocument();
      expect(screen.getByText("Events")).toBeInTheDocument();
    });

    it("formats count=3 as '3 photos'", () => {
      render(<FeaturedCollectionsClient {...baseProps} />);
      expect(screen.getByText("3 photos")).toBeInTheDocument();
    });

    it("formats count=1 as '1 photo'", () => {
      render(<FeaturedCollectionsClient {...baseProps} />);
      expect(screen.getByText("1 photo")).toBeInTheDocument();
    });

    it("formats count=0 as 'No photos'", () => {
      render(<FeaturedCollectionsClient {...baseProps} />);
      expect(screen.getByText("No photos")).toBeInTheDocument();
    });
  });

  describe("cover image rendering", () => {
    it("renders an <img> for tiles with a non-empty coverUrl", () => {
      const { container } = render(<FeaturedCollectionsClient {...baseProps} />);
      const imgs = container.querySelectorAll("img");
      // 2 tiles have a coverUrl
      expect(imgs).toHaveLength(2);
      expect(imgs[0].getAttribute("src")).toBe("https://example.com/cover1.jpg");
      expect(imgs[1].getAttribute("src")).toBe("https://example.com/cover2.jpg");
    });

    it("renders a placeholder (no <img>, aria-hidden element) for empty coverUrl", () => {
      const { container } = render(<FeaturedCollectionsClient {...baseProps} />);
      const placeholder = container.querySelector("[aria-hidden='true'][data-cover-placeholder]");
      expect(placeholder).toBeInTheDocument();
      // No img for the empty-coverUrl tile
      const allImgs = container.querySelectorAll("img");
      const srcs = Array.from(allImgs).map((el) => el.getAttribute("src"));
      expect(srcs).not.toContain("");
    });

    it("cover images have lazy loading and decoding=async", () => {
      const { container } = render(<FeaturedCollectionsClient {...baseProps} />);
      const imgs = container.querySelectorAll("img");
      for (const img of Array.from(imgs)) {
        expect(img.getAttribute("loading")).toBe("lazy");
        expect(img.getAttribute("decoding")).toBe("async");
      }
    });
  });

  describe("grid layout", () => {
    it.each([2, 3, 4] as const)("columns=%i sets responsive gridColsVar on the grid", (cols) => {
      const { container } = render(
        <FeaturedCollectionsClient {...baseProps} columns={cols} />
      );
      const grid = container.querySelector(".pf-featured-grid") as HTMLElement;
      expect(grid).not.toBeNull();
      expect(grid.style.gridTemplateColumns).toBe(`var(--pf-grid-cols, repeat(${cols}, 1fr))`);
    });

    it("grid uses CSS grid display", () => {
      const { container } = render(<FeaturedCollectionsClient {...baseProps} />);
      const grid = container.querySelector(".pf-featured-grid") as HTMLElement;
      expect(grid.style.display).toBe("grid");
    });
  });

  describe("active-collection state and popup", () => {
    it("does not render the popup initially", () => {
      render(<FeaturedCollectionsClient {...baseProps} />);
      expect(screen.queryByTestId("collection-popup")).toBeNull();
    });

    it("clicking a tile opens the popup for that collection", () => {
      render(<FeaturedCollectionsClient {...baseProps} />);
      const btn = screen.getByRole("button", { name: /Weddings/i });
      fireEvent.click(btn);
      const popup = screen.getByTestId("collection-popup");
      expect(popup).toBeInTheDocument();
      expect(popup.getAttribute("data-collection-id")).toBe("col-1");
      // Popup mock renders the name in a <span>; at least one element with the name exists
      expect(screen.getAllByText("Weddings").length).toBeGreaterThanOrEqual(1);
    });

    it("clicking a different tile shows popup for that collection", () => {
      render(<FeaturedCollectionsClient {...baseProps} />);
      fireEvent.click(screen.getByRole("button", { name: /Portraits/i }));
      const popup = screen.getByTestId("collection-popup");
      expect(popup.getAttribute("data-collection-id")).toBe("col-2");
    });

    it("popup onClose closes the popup", () => {
      render(<FeaturedCollectionsClient {...baseProps} />);
      fireEvent.click(screen.getByRole("button", { name: /Weddings/i }));
      expect(screen.getByTestId("collection-popup")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("popup-close"));
      expect(screen.queryByTestId("collection-popup")).toBeNull();
    });

    it("only one popup is shown at a time", () => {
      render(<FeaturedCollectionsClient {...baseProps} />);
      fireEvent.click(screen.getByRole("button", { name: /Weddings/i }));
      // Click a second tile — popup should switch, not add a second
      fireEvent.click(screen.getByRole("button", { name: /Portraits/i }));
      const popups = screen.getAllByTestId("collection-popup");
      expect(popups).toHaveLength(1);
      expect(popups[0].getAttribute("data-collection-id")).toBe("col-2");
    });

    it("passes mode, slug, and popupConfig to CollectionPopup", () => {
      render(
        <FeaturedCollectionsClient
          {...baseProps}
          mode="owner"
          slug={undefined}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /Weddings/i }));
      // popup is rendered (the mock doesn't check mode/slug/popupConfig internally,
      // but the component must not crash when passing them through)
      expect(screen.getByTestId("collection-popup")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("tile buttons have accessible names that include the collection name", () => {
      render(<FeaturedCollectionsClient {...baseProps} />);
      expect(screen.getByRole("button", { name: /Weddings/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Portraits/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Events/i })).toBeInTheDocument();
    });

    it("tile buttons have data-featured-tile attribute for focus-visible scoped style", () => {
      const { container } = render(<FeaturedCollectionsClient {...baseProps} />);
      const tileBtns = container.querySelectorAll("[data-featured-tile]");
      expect(tileBtns).toHaveLength(3);
    });
  });
});
