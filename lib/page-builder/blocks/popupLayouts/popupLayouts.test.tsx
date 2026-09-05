import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContactSheet, Justified, SplitIndex, Immersive } from "./index";
import { applyCollectionPopupDefaults } from "@/lib/page-builder/blockContext";
import type { PopupImage, PopupLayoutBodyProps } from "./types";

const OLD_CLOUD = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
beforeEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "test-hash";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = OLD_CLOUD;
  vi.restoreAllMocks();
});

const L = applyCollectionPopupDefaults();

const images: PopupImage[] = [
  { id: "img1", publicId: "workspace/photo1", alt: "Photo One", width: 800, height: 600 },
  { id: "img2", publicId: "workspace/photo2", alt: "Photo Two", width: 600, height: 800 },
  { id: "img3", publicId: "workspace/photo3", alt: "Photo Three", width: 800, height: 800 },
];

function baseProps(overrides: Partial<PopupLayoutBodyProps> = {}): PopupLayoutBodyProps {
  return {
    images,
    collectionName: "Wedding 2024",
    collectionDescription: undefined,
    total: images.length,
    hasMore: false,
    isLoadingMore: false,
    loadMoreError: false,
    onLoadMore: vi.fn(),
    onOpen: vi.fn(),
    labels: L,
    ...overrides,
  };
}

describe("ContactSheet", () => {
  it("renders a real list of thumbnail buttons and calls onOpen with the clicked index", () => {
    const onOpen = vi.fn();
    render(<ContactSheet {...baseProps({ onOpen })} />);

    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);

    fireEvent.click(buttons[1]);
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  it("omits the description header when collectionDescription is absent", () => {
    render(<ContactSheet {...baseProps()} />);
    expect(screen.queryByText(/photos/i)).not.toBeInTheDocument();
  });

  it("shows the description header (name context + count) when collectionDescription is set", () => {
    render(<ContactSheet {...baseProps({ collectionDescription: "Full-day coverage." })} />);
    expect(screen.getByText("Full-day coverage.")).toBeInTheDocument();
    expect(screen.getByText("3 photos")).toBeInTheDocument();
  });

  it("shows a Load more button when hasMore is true", () => {
    const onLoadMore = vi.fn();
    render(<ContactSheet {...baseProps({ hasMore: true, onLoadMore })} />);
    const btn = screen.getByRole("button", { name: /load more/i });
    fireEvent.click(btn);
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("shows the inline retry control on load-more error", () => {
    render(<ContactSheet {...baseProps({ loadMoreError: true })} />);
    expect(screen.getByTestId("load-more-retry")).toBeInTheDocument();
  });
});

describe("Justified", () => {
  it("renders a list and defers image layout until the container is measured", () => {
    render(<Justified {...baseProps()} />);
    // ResizeObserver never fires in this environment, so width stays null and
    // the component renders its reserved-height skeleton, not thumbnails yet.
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("SplitIndex", () => {
  it("renders the sticky narrative column with name, description and a photo-count fact", () => {
    render(<SplitIndex {...baseProps({ collectionDescription: "A lovely day." })} />);
    expect(screen.getByRole("heading", { name: "Wedding 2024" })).toBeInTheDocument();
    expect(screen.getByText("A lovely day.")).toBeInTheDocument();
    expect(screen.getByText("3 photos")).toBeInTheDocument();
  });

  it("renders a thumbnail button per image and calls onOpen with its index", () => {
    const onOpen = vi.fn();
    render(<SplitIndex {...baseProps({ onOpen })} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    fireEvent.click(buttons[2]);
    expect(onOpen).toHaveBeenCalledWith(2);
  });
});

describe("Immersive", () => {
  it("shows the loading state", () => {
    render(
      <Immersive
        status="loading"
        images={[]}
        collectionName="Wedding 2024"
        hasMore={false}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        onClose={vi.fn()}
        labels={L}
      />
    );
    expect(screen.getByText(L.loading)).toBeInTheDocument();
  });

  it("shows the error state with a retry that calls onRetry", () => {
    const onRetry = vi.fn();
    render(
      <Immersive
        status="error"
        images={[]}
        collectionName="Wedding 2024"
        hasMore={false}
        onLoadMore={vi.fn()}
        onRetry={onRetry}
        onClose={vi.fn()}
        labels={L}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: L.retry }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows the empty state", () => {
    render(
      <Immersive
        status="empty"
        images={[]}
        collectionName="Wedding 2024"
        hasMore={false}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        onClose={vi.fn()}
        labels={L}
      />
    );
    expect(screen.getByText(L.empty)).toBeInTheDocument();
  });

  it("renders one main image plus a filmstrip listbox, and calling onClose fires from the close button", () => {
    const onClose = vi.fn();
    render(
      <Immersive
        status="populated"
        images={images}
        collectionName="Wedding 2024"
        hasMore={false}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        onClose={onClose}
        labels={L}
      />
    );
    expect(screen.getByRole("listbox", { name: L.filmstripLabel })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: L.close }));
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking a filmstrip frame changes the main image without opening a second modal", () => {
    render(
      <Immersive
        status="populated"
        images={images}
        collectionName="Wedding 2024"
        hasMore={false}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        onClose={vi.fn()}
        labels={L}
      />
    );
    const options = screen.getAllByRole("option");
    fireEvent.click(options[2]);
    expect(options[2]).toHaveAttribute("aria-selected", "true");
    // No nested lightbox rendered on click — still exactly one full-size (w=2000) image.
    const allImgs = screen.getAllByRole("img") as HTMLImageElement[];
    expect(allImgs.filter((img) => img.src.includes("w=2000"))).toHaveLength(1);
  });

  it("renders a dot row when hasMore is false and images.length <= 8, and clicking a dot selects it", () => {
    render(
      <Immersive
        status="populated"
        images={images}
        collectionName="Wedding 2024"
        hasMore={false}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        onClose={vi.fn()}
        labels={L}
      />
    );
    const dots = document.querySelectorAll(".pf-popup-immersive-dot");
    expect(dots).toHaveLength(3);
    fireEvent.click(dots[1]);
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("renders no dot row when hasMore is true", () => {
    render(
      <Immersive
        status="populated"
        images={images}
        collectionName="Wedding 2024"
        hasMore={true}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        onClose={vi.fn()}
        labels={L}
      />
    );
    expect(document.querySelectorAll(".pf-popup-immersive-dot")).toHaveLength(0);
  });

  it("renders no dot row when images.length > 8", () => {
    const manyImages: PopupImage[] = Array.from({ length: 9 }, (_, i) => ({
      id: `img${i}`,
      publicId: `workspace/photo${i}`,
      alt: `Photo ${i}`,
      width: 800,
      height: 600,
    }));
    render(
      <Immersive
        status="populated"
        images={manyImages}
        collectionName="Wedding 2024"
        hasMore={false}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        onClose={vi.fn()}
        labels={L}
      />
    );
    expect(document.querySelectorAll(".pf-popup-immersive-dot")).toHaveLength(0);
  });

  it("Escape calls onClose and ArrowRight/ArrowLeft move the selected frame", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Immersive
        status="populated"
        images={images}
        collectionName="Wedding 2024"
        hasMore={false}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        onClose={onClose}
        labels={L}
      />
    );
    const surface = container.querySelector("[data-popup-immersive]") as HTMLElement;
    fireEvent.keyDown(surface, { key: "ArrowRight" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(surface, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
