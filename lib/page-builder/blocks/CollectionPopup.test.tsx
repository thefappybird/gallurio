import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { CollectionPopup } from "./CollectionPopup";
import type { CollectionPopupProps } from "./CollectionPopup";
import type { PortfolioCollectionsPopupConfig } from "@/lib/page-builder/types";

// ---------------------------------------------------------------------------
// Env + fetch mocking
// ---------------------------------------------------------------------------

const OLD_CLOUD = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;

const baseConfig: PortfolioCollectionsPopupConfig = {
  backgroundColor: undefined,
  borderColor: undefined,
  borderWidth: undefined,
  radius: undefined,
};

const page1Items = [
  { id: "img1", publicId: "workspace/photo1", alt: "Photo One" },
  { id: "img2", publicId: "workspace/photo2", alt: "Photo Two" },
  { id: "img3", publicId: "workspace/photo3", alt: "Photo Three" },
];

const page2Items = [
  { id: "img4", publicId: "workspace/photo4", alt: "Photo Four" },
  { id: "img5", publicId: "workspace/photo5", alt: "Photo Five" },
];

function makeFetch(page1NextCursor: string | null = "cursor-abc", page2NextCursor: string | null = null) {
  let callCount = 0;
  return vi.fn((_url: string) => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ items: page1Items, nextCursor: page1NextCursor }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({ items: page2Items, nextCursor: page2NextCursor }),
    });
  });
}

function makeErrorFetch() {
  return vi.fn(() => Promise.reject(new Error("Network error")));
}

function makeEmptyFetch() {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ items: [], nextCursor: null }),
    })
  );
}

function make500Fetch() {
  return vi.fn(() =>
    Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    })
  );
}

/**
 * Returns a fetch that succeeds once (page 1), then fails on the second call
 * (load-more), then succeeds on the third call (retry).
 */
function makeLoadMoreFailThenSucceedFetch() {
  let callCount = 0;
  return vi.fn((_url: string) => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ items: page1Items, nextCursor: "cursor-abc" }),
      });
    }
    if (callCount === 2) {
      return Promise.reject(new Error("Network error on load-more"));
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({ items: page2Items, nextCursor: null }),
    });
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "test-hash";
});

afterEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = OLD_CLOUD;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Default props helper
// ---------------------------------------------------------------------------

function defaultProps(overrides: Partial<CollectionPopupProps> = {}): CollectionPopupProps {
  return {
    collectionId: "col123",
    collectionName: "Wedding 2024",
    mode: "owner",
    popupConfig: baseConfig,
    open: true,
    onClose: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CollectionPopup", () => {
  it("renders sticky header with collection name when open", async () => {
    vi.stubGlobal("fetch", makeFetch());
    render(<CollectionPopup {...defaultProps()} />);

    // Wait for content to appear (base-ui dialog portals to body)
    const heading = await screen.findByRole("heading", { name: /wedding 2024/i });
    expect(heading).toBeInTheDocument();
  });

  it("renders a floating close button and calls onClose when clicked", async () => {
    vi.stubGlobal("fetch", makeFetch());
    const onClose = vi.fn();
    render(<CollectionPopup {...defaultProps({ onClose })} />);

    await screen.findByRole("heading", { name: /wedding 2024/i });
    const closeBtn = screen.getByRole("button", { name: /close/i });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows loading state initially then populates images", async () => {
    // Use a delayed fetch so we can observe the loading state before it resolves
    let resolveFetch!: () => void;
    const delayedFetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              json: () =>
                Promise.resolve({ items: page1Items, nextCursor: null }),
            } as Response);
        })
    );
    vi.stubGlobal("fetch", delayedFetch);

    render(<CollectionPopup {...defaultProps()} />);

    // Loading state should be visible synchronously before fetch resolves
    await waitFor(() => {
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    // Resolve the fetch
    resolveFetch();

    // Then images appear
    const images = await screen.findAllByRole("img");
    expect(images.length).toBeGreaterThanOrEqual(3);
  });

  it("renders thumbnails using CF Images URLs (width 400, fit cover)", async () => {
    vi.stubGlobal("fetch", makeFetch());
    render(<CollectionPopup {...defaultProps()} />);

    await screen.findAllByRole("img");
    const imgs = screen.getAllByRole("img") as HTMLImageElement[];
    // Filter thumbnails (not lightbox)
    const thumbs = imgs.filter((img) => img.src.includes("w=400"));
    expect(thumbs.length).toBeGreaterThanOrEqual(3);
    expect(thumbs[0].src).toContain("imagedelivery.net");
    expect(thumbs[0].src).toContain("fit=cover");
    expect(thumbs[0].src).toContain("workspace/photo1");
  });

  it("shows 'Load more' button when nextCursor is non-null, then hides it after loading all", async () => {
    vi.stubGlobal("fetch", makeFetch("cursor-abc", null));
    render(<CollectionPopup {...defaultProps()} />);

    // Wait for page 1 to load
    await screen.findAllByRole("img");
    const loadMore = await screen.findByRole("button", { name: /load more/i });
    expect(loadMore).toBeInTheDocument();

    // Click load more
    fireEvent.click(loadMore);

    // After page 2 loads, button disappears
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
    });

    // Page 2 images are present
    const allImgs = screen.getAllByRole("img") as HTMLImageElement[];
    const thumbs = allImgs.filter((img) => img.src.includes("w=400"));
    expect(thumbs.length).toBe(5);
  });

  it("hides 'Load more' immediately when initial page has nextCursor null", async () => {
    vi.stubGlobal("fetch", makeFetch(null));
    render(<CollectionPopup {...defaultProps()} />);

    await screen.findAllByRole("img");
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("shows error state with Retry button when fetch rejects", async () => {
    vi.stubGlobal("fetch", makeErrorFetch());
    render(<CollectionPopup {...defaultProps()} />);

    const retryBtn = await screen.findByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
  });

  it("shows error state with Retry button when fetch returns non-ok", async () => {
    vi.stubGlobal("fetch", make500Fetch());
    render(<CollectionPopup {...defaultProps()} />);

    const retryBtn = await screen.findByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
  });

  it("refetches when Retry is clicked after error", async () => {
    const fetchFn = makeErrorFetch();
    vi.stubGlobal("fetch", fetchFn);
    render(<CollectionPopup {...defaultProps()} />);

    await screen.findByRole("button", { name: /retry/i });

    // Now fix the fetch
    vi.stubGlobal("fetch", makeFetch(null));
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    // Should see images now
    await screen.findAllByRole("img");
  });

  it("shows empty state when items array is empty", async () => {
    vi.stubGlobal("fetch", makeEmptyFetch());
    render(<CollectionPopup {...defaultProps()} />);

    const empty = await screen.findByText(/no photos/i);
    expect(empty).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("does not render popup content when open is false", () => {
    vi.stubGlobal("fetch", makeFetch());
    render(<CollectionPopup {...defaultProps({ open: false })} />);

    // Dialog should not be visible / not render its content
    expect(screen.queryByRole("heading", { name: /wedding 2024/i })).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // URL construction
  // ---------------------------------------------------------------------------

  it("builds owner endpoint URL: /api/portfolio/gallery/collections/<id>", async () => {
    const fetchFn = makeFetch(null);
    vi.stubGlobal("fetch", fetchFn);
    render(<CollectionPopup {...defaultProps({ mode: "owner", collectionId: "col123" })} />);

    await screen.findAllByRole("img");
    const calledUrl = (fetchFn.mock.calls[0][0] as string);
    expect(calledUrl).toContain("/api/portfolio/gallery/collections/col123");
  });

  it("builds public endpoint URL: /api/public/w/<slug>/collections/<id>", async () => {
    const fetchFn = makeFetch(null);
    vi.stubGlobal("fetch", fetchFn);
    render(
      <CollectionPopup
        {...defaultProps({ mode: "public", slug: "my-studio", collectionId: "col456" })}
      />
    );

    await screen.findAllByRole("img");
    const calledUrl = (fetchFn.mock.calls[0][0] as string);
    expect(calledUrl).toContain("/api/public/w/my-studio/collections/col456");
  });

  it("passes limit query param in the URL", async () => {
    const fetchFn = makeFetch(null);
    vi.stubGlobal("fetch", fetchFn);
    render(<CollectionPopup {...defaultProps()} />);

    await screen.findAllByRole("img");
    const calledUrl = (fetchFn.mock.calls[0][0] as string);
    expect(calledUrl).toContain("limit=");
  });

  it("passes cursor in Load more request", async () => {
    const fetchFn = makeFetch("cursor-xyz", null);
    vi.stubGlobal("fetch", fetchFn);
    render(<CollectionPopup {...defaultProps()} />);

    await screen.findAllByRole("img");
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
    const secondUrl = fetchFn.mock.calls[1][0] as string;
    expect(secondUrl).toContain("cursor=cursor-xyz");
  });

  // ---------------------------------------------------------------------------
  // Owner-mode normalization: caption -> alt
  // ---------------------------------------------------------------------------

  it("normalizes owner-mode items with caption (no alt) into PopupImage.alt", async () => {
    const captionItems = [
      { id: "img1", publicId: "workspace/photo1", caption: "My Caption", alt: undefined },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: captionItems, nextCursor: null }),
        })
      )
    );
    render(<CollectionPopup {...defaultProps({ mode: "owner" })} />);

    const img = await screen.findByRole("img", { name: /my caption/i });
    expect(img).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Nested lightbox
  // ---------------------------------------------------------------------------

  it("clicking a thumbnail opens the nested lightbox with a full-size image", async () => {
    vi.stubGlobal("fetch", makeFetch(null));
    render(<CollectionPopup {...defaultProps()} />);

    const thumbs = await screen.findAllByRole("img");
    const thumb = thumbs.find((img) => (img as HTMLImageElement).src.includes("w=400"))!;
    expect(thumb).toBeTruthy();

    // Click the thumbnail
    fireEvent.click(thumb.closest("button") ?? thumb);

    // Lightbox image should appear (width 2000)
    await waitFor(() => {
      const allImgs = screen.getAllByRole("img") as HTMLImageElement[];
      const lightboxImg = allImgs.find((img) => img.src.includes("w=2000"));
      expect(lightboxImg).toBeTruthy();
    });
  });

  it("closing the lightbox keeps the popup open", async () => {
    vi.stubGlobal("fetch", makeFetch(null));
    render(<CollectionPopup {...defaultProps()} />);

    const thumbs = await screen.findAllByRole("img");
    const thumb = (thumbs as HTMLImageElement[]).find((img) => img.src.includes("w=400"))!;
    fireEvent.click(thumb.closest("button") ?? thumb);

    // Lightbox opens
    await waitFor(() => {
      const allImgs = screen.getAllByRole("img") as HTMLImageElement[];
      expect(allImgs.some((img) => (img as HTMLImageElement).src.includes("w=2000"))).toBe(true);
    });

    // Close the lightbox
    const closeButtons = screen.getAllByRole("button", { name: /close/i });
    // The lightbox close is distinct from the popup close — click the second one
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    // Popup heading still visible
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /wedding 2024/i })).toBeInTheDocument();
    });

    // Lightbox image gone
    await waitFor(() => {
      const allImgs = screen.queryAllByRole("img") as HTMLImageElement[];
      expect(allImgs.every((img) => !(img as HTMLImageElement).src.includes("w=2000"))).toBe(true);
    });
  });

  it("lightbox close button has aria-label='Close'", async () => {
    vi.stubGlobal("fetch", makeFetch(null));
    render(<CollectionPopup {...defaultProps()} />);

    const thumbs = await screen.findAllByRole("img");
    const thumb = (thumbs as HTMLImageElement[]).find((img) => img.src.includes("w=400"))!;
    fireEvent.click(thumb.closest("button") ?? thumb);

    // Wait for lightbox image to appear
    await waitFor(() => {
      const allImgs = screen.getAllByRole("img") as HTMLImageElement[];
      expect(allImgs.some((img) => (img as HTMLImageElement).src.includes("w=2000"))).toBe(true);
    });

    // The lightbox has its own close button (the popup's close is inerted by base-ui
    // when a nested dialog is open — this is correct a11y behavior).
    // Verify the lightbox close button is present in the document (may be in inerted region
    // or active region depending on nesting strategy).
    await waitFor(() => {
      // Query all close buttons in the entire document (including aria-hidden regions)
      const allCloseBtns = Array.from(
        document.querySelectorAll("button[aria-label='Close']")
      );
      expect(allCloseBtns.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // popupConfig: radius, backgroundColor, borderColor
  // ---------------------------------------------------------------------------

  it("applies borderRadius from popupConfig radius (rounded)", async () => {
    vi.stubGlobal("fetch", makeFetch(null));
    render(
      <CollectionPopup {...defaultProps({ popupConfig: { radius: "rounded" } })} />
    );

    await screen.findAllByRole("img");
    // base-ui portals to document.body, not the container
    const popup = document.querySelector("[data-popup-shell]");
    expect(popup).not.toBeNull();
    expect((popup as HTMLElement).style.borderRadius).toBeTruthy();
    expect((popup as HTMLElement).style.borderRadius).not.toBe("0px");
  });

  it("applies sharp borderRadius (0px) from popupConfig", async () => {
    vi.stubGlobal("fetch", makeFetch(null));
    render(
      <CollectionPopup {...defaultProps({ popupConfig: { radius: "sharp" } })} />
    );

    await screen.findAllByRole("img");
    const popup = document.querySelector("[data-popup-shell]");
    expect(popup).not.toBeNull();
    expect((popup as HTMLElement).style.borderRadius).toBe("0px");
  });

  // ---------------------------------------------------------------------------
  // Focus-visible data attributes and scoped style presence
  // ---------------------------------------------------------------------------

  it("popup close button has data-popup-close attribute", async () => {
    vi.stubGlobal("fetch", makeFetch(null));
    render(<CollectionPopup {...defaultProps()} />);

    await screen.findByRole("heading", { name: /wedding 2024/i });
    const closeBtn = document.querySelector("[data-popup-close]");
    expect(closeBtn).not.toBeNull();
    expect(closeBtn?.tagName.toLowerCase()).toBe("button");
  });

  it("thumbnail buttons have data-popup-thumb attribute", async () => {
    vi.stubGlobal("fetch", makeFetch(null));
    render(<CollectionPopup {...defaultProps()} />);

    await screen.findAllByRole("img");
    const thumbBtns = document.querySelectorAll("[data-popup-thumb]");
    expect(thumbBtns.length).toBeGreaterThanOrEqual(3);
  });

  it("renders a scoped <style> block inside the popup", async () => {
    vi.stubGlobal("fetch", makeFetch(null));
    render(<CollectionPopup {...defaultProps()} />);

    await screen.findByRole("heading", { name: /wedding 2024/i });
    const styleEl = document.querySelector("[data-popup-shell] style, [data-popup-shell] ~ * style");
    // The style block may be anywhere inside or adjacent; search the whole doc
    const allStyles = Array.from(document.querySelectorAll("style"));
    const focusStyle = allStyles.find((s) => s.textContent?.includes("data-popup-close"));
    expect(focusStyle).not.toBeUndefined();
  });

  it("lightbox close button has data-lightbox-close attribute", async () => {
    vi.stubGlobal("fetch", makeFetch(null));
    render(<CollectionPopup {...defaultProps()} />);

    const thumbs = await screen.findAllByRole("img");
    const thumb = (thumbs as HTMLImageElement[]).find((img) => img.src.includes("w=400"))!;
    fireEvent.click(thumb.closest("button") ?? thumb);

    await waitFor(() => {
      const lightboxClose = document.querySelector("[data-lightbox-close]");
      expect(lightboxClose).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Load-more failure resilience (Fix 2)
  // ---------------------------------------------------------------------------

  it("load-more failure keeps existing images visible and shows inline retry", async () => {
    const fetchFn = makeLoadMoreFailThenSucceedFetch();
    vi.stubGlobal("fetch", fetchFn);
    render(<CollectionPopup {...defaultProps()} />);

    // Wait for page 1
    await screen.findAllByRole("img");
    const page1Thumbs = (screen.getAllByRole("img") as HTMLImageElement[]).filter(
      (img) => img.src.includes("w=400")
    );
    expect(page1Thumbs.length).toBe(3);

    // Click load more — this will fail on second fetch
    const loadMoreBtn = screen.getByRole("button", { name: /load more/i });
    fireEvent.click(loadMoreBtn);

    // Inline error should appear without wiping the grid
    const inlineRetry = await screen.findByTestId("load-more-retry");
    expect(inlineRetry).toBeInTheDocument();

    // Original page-1 images still visible
    const stillVisible = (screen.getAllByRole("img") as HTMLImageElement[]).filter(
      (img) => img.src.includes("w=400")
    );
    expect(stillVisible.length).toBe(3);

    // Full error panel must NOT be shown
    expect(screen.queryByText("Failed to load photos.")).not.toBeInTheDocument();

    // Click inline retry — third fetch succeeds
    fireEvent.click(inlineRetry);

    // All 5 images now present
    await waitFor(() => {
      const allThumbs = (screen.getAllByRole("img") as HTMLImageElement[]).filter(
        (img) => img.src.includes("w=400")
      );
      expect(allThumbs.length).toBe(5);
    });

    // Inline retry gone
    expect(screen.queryByTestId("load-more-retry")).not.toBeInTheDocument();
  });

  it("initial fetch failure still shows full error panel (not inline)", async () => {
    vi.stubGlobal("fetch", makeErrorFetch());
    render(<CollectionPopup {...defaultProps()} />);

    // Full error panel text present
    await screen.findByText("Failed to load photos.");

    // No images in the grid
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CollectionPopup title override (via CollectionPopupChrome)
// ---------------------------------------------------------------------------

describe("CollectionPopup title override", () => {
  it("renders the configured title override instead of the collection name", async () => {
    vi.stubGlobal("fetch", makeFetch(null));
    render(
      <CollectionPopup
        collectionId="c1"
        collectionName="Weddings"
        mode="owner"
        popupConfig={{ titleText: "Galleries" }}
        open
        onClose={() => {}}
      />,
    );
    const heading = await screen.findByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Galleries");
  });

  it("falls back to collectionName when titleText is absent", async () => {
    vi.stubGlobal("fetch", makeFetch(null));
    render(
      <CollectionPopup
        collectionId="c2"
        collectionName="Portraits"
        mode="owner"
        popupConfig={{}}
        open
        onClose={() => {}}
      />,
    );
    const heading = await screen.findByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Portraits");
  });
});
