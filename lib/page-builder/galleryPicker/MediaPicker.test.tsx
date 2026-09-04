import type { ReactElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { MediaPicker } from "./MediaPicker";
import type { MediaPickerCollectionSelection } from "./MediaPicker";
import { __clearPickerDataCache } from "./usePickerData";
import { GalleryPickerCacheProvider } from "./GalleryPickerCacheContext";

vi.mock("@/lib/storage/uploadImage.client", () => ({
  uploadImage: vi.fn(),
}));
import { uploadImage } from "@/lib/storage/uploadImage.client";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const collections = [
  { id: "col1", name: "Weddings", coverUrl: "https://x/c1.jpg", coverPublicId: "pid-col1", itemCount: 3 },
  { id: "col2", name: "Portraits", coverUrl: "https://x/c2.jpg", coverPublicId: "pid-col2", itemCount: 5 },
  { id: "col3", name: "Events", coverUrl: "https://x/c3.jpg", coverPublicId: "pid-col3", itemCount: 2 },
];
const colItems = [
  { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: "A", altText: null },
  { id: "b", publicId: "pid-b", thumbUrl: "https://x/b.jpg", caption: "B", altText: null },
];

// Route fetch by URL: picker-data (/api/portfolio/gallery) vs paginated feed.
function routeFetch(url: string) {
  if (url === "/api/portfolio/gallery") {
    return Promise.resolve({ ok: true, json: async () => ({ collections, items: colItems }) } as Response);
  }
  // collection or "all" feed
  return Promise.resolve({ ok: true, json: async () => ({ items: colItems, nextCursor: null }) } as Response);
}

beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockFetch.mockImplementation((u: string) => routeFetch(u));
  vi.mocked(uploadImage).mockReset();
});

describe("MediaPicker", () => {
  it("renders the collection grid with the pinned 'All photos' entry", async () => {
    renderWithProviders(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /^all photos$/i })).toBeTruthy());
    expect(screen.getByRole("button", { name: /^weddings$/i })).toBeTruthy();
  });

  it("single mode: picking a photo calls onChange(publicId) and closes", async () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(<MediaPicker mode="single" value="" onChange={onChange} open onOpenChange={onOpenChange} />);
    fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
    fireEvent.click(await screen.findByRole("option", { name: /^A/ }));
    expect(onChange).toHaveBeenCalledWith("pid-a");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("multi mode: toggling appends {id,publicId} and respects max", async () => {
    const onChange = vi.fn();
    renderWithProviders(<MediaPicker mode="multi" max={1} value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
    fireEvent.click(await screen.findByRole("option", { name: /^A/ }));
    expect(onChange).toHaveBeenCalledWith([{ id: "a", publicId: "pid-a" }]);
  });

  it("multi mode: 'select all on page' respects max (newest/page order, capped)", async () => {
    const onChange = vi.fn();
    renderWithProviders(<MediaPicker mode="multi" max={1} value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /select all on page/i }));
    expect(onChange).toHaveBeenCalledWith([{ id: "a", publicId: "pid-a" }]);
  });

  it("multi mode: 'select all in collection' fetches newest-N and sets selection (capped)", async () => {
    const onChange = vi.fn();
    renderWithProviders(<MediaPicker mode="multi" max={2} value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /select all in collection/i }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        { id: "a", publicId: "pid-a" },
        { id: "b", publicId: "pid-b" },
      ])
    );
    // The bulk fetch hit the ?newest= endpoint.
    expect(mockFetch.mock.calls.some(([u]) => String(u).includes("newest="))).toBe(true);
  });

  it("multi mode: 'select all in collection' appends into an existing selection (dedup by id, cap on the combined total)", async () => {
    const onChange = vi.fn();
    // Pre-existing pick "z" is not in the collection's newest set; "a" is
    // already picked too, so the fetched "a" must not duplicate it. max=2
    // means only one more slot is free — "b" must NOT bump "z" or "a" out.
    renderWithProviders(
      <MediaPicker
        mode="multi"
        max={2}
        value={[
          { id: "z", publicId: "pid-z" },
          { id: "a", publicId: "pid-a" },
        ]}
        onChange={onChange}
        open
        onOpenChange={vi.fn()}
      />
    );
    fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /select all in collection/i }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        { id: "z", publicId: "pid-z" },
        { id: "a", publicId: "pid-a" },
      ])
    );
  });

  it("multi mode: collection tile checkmark bulk-selects that collection without navigating into it", async () => {
    const onChange = vi.fn();
    renderWithProviders(<MediaPicker mode="multi" value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    const checkmark = await screen.findByRole("checkbox", { name: /select all photos in weddings/i });
    fireEvent.click(checkmark);
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        { id: "a", publicId: "pid-a" },
        { id: "b", publicId: "pid-b" },
      ])
    );
    // Still browsing collections — the checkmark click did not trigger the
    // tile's own "open this collection" action.
    expect(screen.queryByRole("button", { name: /back to collections/i })).toBeNull();
    expect(mockFetch.mock.calls.some(([u]) => String(u).includes("newest="))).toBe(true);
  });

  it("single mode: collection tiles render no bulk-select checkmark", async () => {
    renderWithProviders(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    await screen.findByRole("button", { name: /^weddings$/i });
    expect(screen.queryByRole("checkbox", { name: /select all photos in/i })).toBeNull();
  });

  it("multi mode: surfaces an error (not a silent no-op) when the bulk collection fetch fails", async () => {
    const onChange = vi.fn();
    mockFetch.mockImplementation((u: string) => {
      const url = String(u);
      if (url === "/api/portfolio/gallery") {
        return Promise.resolve({ ok: true, json: async () => ({ collections, items: colItems }) } as Response);
      }
      if (url.includes("newest=")) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: colItems, nextCursor: null }) } as Response);
    });
    renderWithProviders(<MediaPicker mode="multi" value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /select all photos in weddings/i }));
    await screen.findByRole("alert");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows a skeleton grid (not a bare spinner) while picker data is loading, so the dialog body holds its shape", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    mockFetch.mockImplementation((u: string) => {
      if (u === "/api/portfolio/gallery") {
        return new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: [], nextCursor: null }) } as Response);
    });
    renderWithProviders(<MediaPicker mode="multi" value={[]} onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    const status = await screen.findByRole("status");
    expect(status.querySelectorAll("li").length).toBeGreaterThan(0);
    resolveFetch({ ok: true, json: async () => ({ collections, items: colItems }) } as Response);
    await screen.findByRole("button", { name: /^weddings$/i });
  });

  it("shows an actionable empty state (icon + upload affordance, not a bare sentence) inside an empty collection", async () => {
    mockFetch.mockImplementation((u: string) => {
      if (u === "/api/portfolio/gallery") {
        return Promise.resolve({ ok: true, json: async () => ({ collections, items: [] }) } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: [], nextCursor: null }) } as Response);
    });
    renderWithProviders(<MediaPicker mode="multi" value={[]} onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
    await screen.findByText(/this collection is empty/i);
    // The upload dropzone is present alongside the message — actionable, not a bare sentence.
    expect(screen.getByRole("button", { name: /upload photo/i })).toBeTruthy();
  });

  it("multi mode: reorder chip resolves thumbnail from workspace-wide picker data without opening a collection", async () => {
    renderWithProviders(
      <MediaPicker
        mode="multi"
        value={[{ id: "a", publicId: "pid-a" }]}
        onChange={vi.fn()}
        open
        onOpenChange={vi.fn()}
      />
    );
    // No collection was opened — the chip must resolve from usePickerData's workspace-wide items.
    const strip = await screen.findByRole("list", { name: /selected photos/i });
    // alt="" gives the <img> a "presentation" role, not "img" — query the DOM node directly.
    const img = strip.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://x/a.jpg");
    expect(within(strip).queryByText("?")).toBeNull();
  });

  it("hides 'select all in collection' on the All photos feed", async () => {
    renderWithProviders(<MediaPicker mode="multi" value={[]} onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /^all photos$/i }));
    await waitFor(() => screen.getByRole("button", { name: /select all on page/i }));
    expect(screen.queryByRole("button", { name: /select all in collection/i })).toBeNull();
  });

  it("renders the empty-workspace state with an upload affordance", async () => {
    mockFetch.mockImplementation((u: string) =>
      u === "/api/portfolio/gallery"
        ? Promise.resolve({ ok: true, json: async () => ({ collections: [], items: [] }) } as Response)
        : Promise.resolve({ ok: true, json: async () => ({ items: [], nextCursor: null }) } as Response)
    );
    renderWithProviders(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/no photos yet/i)).toBeTruthy());
  });

  it("shows error + retry when picker data fails", async () => {
    mockFetch.mockImplementation((u: string) =>
      u === "/api/portfolio/gallery" ? Promise.reject(new Error("net")) : routeFetch(u)
    );
    renderWithProviders(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/could not load/i)).toBeTruthy());
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("announces the picker-data fetch failure via role=alert", async () => {
    mockFetch.mockImplementation((u: string) =>
      u === "/api/portfolio/gallery" ? Promise.reject(new Error("net")) : routeFetch(u)
    );
    renderWithProviders(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not load/i);
  });

  it("does not render its dialog content when closed", () => {
    renderWithProviders(<MediaPicker mode="single" value="" onChange={vi.fn()} open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^all photos$/i })).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // collections mode
  // ---------------------------------------------------------------------------

  describe("collections mode", () => {
    it("renders collection tiles as options with aria-selected reflecting selection state", async () => {
      renderWithProviders(
        <MediaPicker
          mode="collections"
          value={[]}
          onChange={vi.fn()}
          open
          onOpenChange={vi.fn()}
        />
      );
      // Wait for data to load
      await waitFor(() => expect(screen.getByRole("option", { name: /weddings/i })).toBeTruthy());
      // All tiles start unselected
      const weddingsOpt = screen.getByRole("option", { name: /weddings/i });
      expect(weddingsOpt.getAttribute("aria-selected")).toBe("false");
      // Three real collections should be present
      expect(screen.getByRole("option", { name: /portraits/i })).toBeTruthy();
      expect(screen.getByRole("option", { name: /events/i })).toBeTruthy();
    });

    it("clicking a tile selects it: calls onChange with [{ id, name, coverPublicId, itemCount }]", async () => {
      const onChange = vi.fn();
      renderWithProviders(
        <MediaPicker
          mode="collections"
          value={[]}
          onChange={onChange}
          open
          onOpenChange={vi.fn()}
        />
      );
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      expect(onChange).toHaveBeenCalledWith([
        { id: "col1", name: "Weddings", coverPublicId: "pid-col1", itemCount: 3 },
      ] satisfies MediaPickerCollectionSelection[]);
    });

    it("clicking a second tile appends it in order (order 2)", async () => {
      const onChange = vi.fn();
      const firstSelection: MediaPickerCollectionSelection[] = [
        { id: "col1", name: "Weddings", coverPublicId: "pid-col1", itemCount: 3 },
      ];
      renderWithProviders(
        <MediaPicker
          mode="collections"
          value={firstSelection}
          onChange={onChange}
          open
          onOpenChange={vi.fn()}
        />
      );
      await waitFor(() => screen.getByRole("button", { name: /portraits/i }));
      fireEvent.click(screen.getByRole("button", { name: /portraits/i }));
      expect(onChange).toHaveBeenCalledWith([
        { id: "col1", name: "Weddings", coverPublicId: "pid-col1", itemCount: 3 },
        { id: "col2", name: "Portraits", coverPublicId: "pid-col2", itemCount: 5 },
      ] satisfies MediaPickerCollectionSelection[]);
    });

    it("re-clicking a selected tile removes it; remaining tiles reindex from 1", async () => {
      const onChange = vi.fn();
      // Start with col1 and col2 both selected
      const twoSelected: MediaPickerCollectionSelection[] = [
        { id: "col1", name: "Weddings", coverPublicId: "pid-col1", itemCount: 3 },
        { id: "col2", name: "Portraits", coverPublicId: "pid-col2", itemCount: 5 },
      ];
      renderWithProviders(
        <MediaPicker
          mode="collections"
          value={twoSelected}
          onChange={onChange}
          open
          onOpenChange={vi.fn()}
        />
      );
      // Wait for tiles; use the selected-tile aria-label to avoid ambiguity with the reorder strip remove button.
      await waitFor(() => screen.getByRole("button", { name: /weddings.*selected/i }));
      // Deselect col1 (first) by clicking its tile
      fireEvent.click(screen.getByRole("button", { name: /weddings.*selected/i }));
      expect(onChange).toHaveBeenCalledWith([
        { id: "col2", name: "Portraits", coverPublicId: "pid-col2", itemCount: 5 },
      ] satisfies MediaPickerCollectionSelection[]);
    });

    it("value round-trips the { id, name, coverPublicId, itemCount } shape", async () => {
      const selection: MediaPickerCollectionSelection[] = [
        { id: "col1", name: "Weddings", coverPublicId: "pid-col1", itemCount: 3 },
      ];
      const onChange = vi.fn();
      renderWithProviders(
        <MediaPicker
          mode="collections"
          value={selection}
          onChange={onChange}
          open
          onOpenChange={vi.fn()}
        />
      );
      // Wait for the collection grid to render (scoped to the "Collections" listbox, not the reorder strip)
      await waitFor(() => screen.getByRole("listbox", { name: /^collections$/i }));
      const { getByRole: getInGrid } = within(screen.getByRole("listbox", { name: /^collections$/i }));
      // The selected tile reflects aria-selected=true
      expect(getInGrid("option", { name: /weddings/i }).getAttribute("aria-selected")).toBe("true");
      // Unselected tile is still aria-selected=false
      expect(getInGrid("option", { name: /portraits/i }).getAttribute("aria-selected")).toBe("false");
    });

    it("clicking a collection tile in collections mode does NOT navigate to a photos view", async () => {
      renderWithProviders(
        <MediaPicker
          mode="collections"
          value={[]}
          onChange={vi.fn()}
          open
          onOpenChange={vi.fn()}
        />
      );
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      // Photo grid must not appear
      expect(screen.queryByRole("listbox", { name: /photos/i })).toBeNull();
      // Back button must not appear
      expect(screen.queryByRole("button", { name: /back to collections/i })).toBeNull();
      // Collection tiles must still be visible (still on collections view)
      expect(screen.getByRole("option", { name: /weddings/i })).toBeTruthy();
    });

    it("selected collection tiles show an order badge (not color alone)", async () => {
      const selection: MediaPickerCollectionSelection[] = [
        { id: "col1", name: "Weddings", coverPublicId: "pid-col1", itemCount: 3 },
        { id: "col2", name: "Portraits", coverPublicId: "pid-col2", itemCount: 5 },
      ];
      renderWithProviders(
        <MediaPicker
          mode="collections"
          value={selection}
          onChange={vi.fn()}
          open
          onOpenChange={vi.fn()}
        />
      );
      await waitFor(() => screen.getByRole("option", { name: /weddings/i }));
      // Order badges "1" and "2" must be rendered
      expect(screen.getByText("1")).toBeTruthy();
      expect(screen.getByText("2")).toBeTruthy();
    });

    it("renders a reorder strip for selected collections with remove buttons", async () => {
      const selection: MediaPickerCollectionSelection[] = [
        { id: "col1", name: "Weddings", coverPublicId: "pid-col1", itemCount: 3 },
        { id: "col2", name: "Portraits", coverPublicId: "pid-col2", itemCount: 5 },
      ];
      const onChange = vi.fn();
      renderWithProviders(
        <MediaPicker
          mode="collections"
          value={selection}
          onChange={onChange}
          open
          onOpenChange={vi.fn()}
        />
      );
      await waitFor(() => screen.getByRole("option", { name: /weddings/i }));
      // Remove buttons must exist (at least one)
      const removeButtons = screen.getAllByRole("button", { name: /remove/i });
      expect(removeButtons.length).toBeGreaterThanOrEqual(1);
      // a11y: reorder-strip listbox must be multi-selectable
      const listbox = screen.getByRole("listbox", { name: /selected collections/i });
      expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
      // a11y: each reorder chip's option accessible name must be the collection name (Fix 1)
      const chipOptions = Array.from(listbox.querySelectorAll('[role="option"]'));
      const chipNames = chipOptions.map((el) => el.getAttribute("aria-label"));
      expect(chipNames).toContain("Weddings");
      expect(chipNames).toContain("Portraits");
    });

    it("shows a Done button and no navigation back button in collections mode", async () => {
      renderWithProviders(
        <MediaPicker
          mode="collections"
          value={[]}
          onChange={vi.fn()}
          open
          onOpenChange={vi.fn()}
        />
      );
      await waitFor(() => screen.getByRole("option", { name: /weddings/i }));
      expect(screen.getByRole("button", { name: /done/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /back to collections/i })).toBeNull();
    });
  });

  it("multi mode: 'select all on page' forwards width/height from items that carry dims", async () => {
    const richItems = [
      { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: "A", altText: null, width: 800, height: 600 },
      { id: "b", publicId: "pid-b", thumbUrl: "https://x/b.jpg", caption: "B", altText: null },
    ];
    mockFetch.mockImplementation((u: string) => {
      if (u === "/api/portfolio/gallery") {
        return Promise.resolve({ ok: true, json: async () => ({ collections, items: richItems }) } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: richItems, nextCursor: null }) } as Response);
    });
    const onChange = vi.fn();
    renderWithProviders(<MediaPicker mode="multi" value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /select all on page/i }));
    expect(onChange).toHaveBeenCalledWith([
      { id: "a", publicId: "pid-a", width: 800, height: 600 },
      { id: "b", publicId: "pid-b" },
    ]);
  });

  it("multi mode: selecting an item that carries width/height includes dims in the selection", async () => {
    const richItems = [
      { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: "A", altText: null, width: 1200, height: 800 },
    ];
    mockFetch.mockImplementation((u: string) => {
      if (u === "/api/portfolio/gallery") {
        return Promise.resolve({ ok: true, json: async () => ({ collections, items: richItems }) } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: richItems, nextCursor: null }) } as Response);
    });
    const onChange = vi.fn();
    renderWithProviders(<MediaPicker mode="multi" value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
    fireEvent.click(await screen.findByRole("option", { name: /^A/ }));
    expect(onChange).toHaveBeenCalledWith([{ id: "a", publicId: "pid-a", width: 1200, height: 800 }]);
  });

  it("switching collections ignores a stale slow response and shows the new collection", async () => {
    const twoCollections = [
      { id: "slow", name: "SlowCol", coverUrl: "https://x/s.jpg", itemCount: 1 },
      { id: "fast", name: "FastCol", coverUrl: "https://x/f.jpg", itemCount: 1 },
    ];
    const slowItems = [{ id: "s1", publicId: "pid-s1", thumbUrl: "https://x/s1.jpg", caption: "SlowPhoto", altText: null }];
    const fastItems = [{ id: "f1", publicId: "pid-f1", thumbUrl: "https://x/f1.jpg", caption: "FastPhoto", altText: null }];

    // Deferred promise for the slow collection's feed; resolve it manually later.
    let resolveSlow: (r: Response) => void = () => {};
    const slowResponse = new Promise<Response>((resolve) => {
      resolveSlow = resolve;
    });

    mockFetch.mockImplementation((u: string) => {
      const url = String(u);
      if (url === "/api/portfolio/gallery") {
        return Promise.resolve({ ok: true, json: async () => ({ collections: twoCollections, items: [] }) } as Response);
      }
      if (url.startsWith("/api/portfolio/gallery/collections/slow")) {
        return slowResponse;
      }
      // fast collection feed resolves immediately
      return Promise.resolve({ ok: true, json: async () => ({ items: fastItems, nextCursor: null }) } as Response);
    });

    renderWithProviders(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);

    // Open the slow collection (its feed is still pending).
    fireEvent.click(await screen.findByRole("button", { name: /^slowcol$/i }));
    // Go back, then open the fast collection.
    fireEvent.click(await screen.findByRole("button", { name: /back to collections/i }));
    fireEvent.click(await screen.findByRole("button", { name: /fastcol/i }));

    // Fast collection's photo should render.
    await screen.findByRole("option", { name: "FastPhoto" });

    // Now let the stale slow response resolve — it must not overwrite the view.
    resolveSlow({ ok: true, json: async () => ({ items: slowItems, nextCursor: null }) } as Response);

    await waitFor(() => expect(screen.queryByRole("option", { name: /SlowPhoto/ })).toBeNull());
    expect(screen.getByRole("option", { name: "FastPhoto" })).toBeTruthy();
  });

  describe("upload auto-select", () => {
    /** Fetch router that also handles gallery-item creation POST. */
    function routeWithCreate(url: string, init?: RequestInit) {
      if (url === "/api/portfolio/gallery/items" && (init as RequestInit)?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "new-id", thumbUrl: "https://x/new-thumb.jpg", caption: null }),
        } as Response);
      }
      return routeFetch(url);
    }

    it("(a) single mode: uploading auto-selects the photo and closes the picker", async () => {
      vi.mocked(uploadImage).mockResolvedValue({
        assetId: "new-asset-id",
        url: "https://x/new.jpg",
        width: 800,
        height: 600,
        format: "jpeg",
        sizeBytes: 10000,
      });
      mockFetch.mockImplementation((u: string, init?: RequestInit) => routeWithCreate(u, init));

      const onChange = vi.fn();
      const onOpenChange = vi.fn();
      renderWithProviders(
        <MediaPicker mode="single" value="" onChange={onChange} open onOpenChange={onOpenChange} />
      );

      // Navigate into a collection so the photo grid + upload zone are visible.
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      await screen.findByRole("listbox", { name: /photos/i });

      // Trigger file upload via the hidden file input inside UploadZone.
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // After the upload pipeline completes: onChange(publicId) + onOpenChange(false).
      await waitFor(() => expect(onChange).toHaveBeenCalledWith("new-asset-id"));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("multi mode: uploading appends the photo to the current selection, picker stays open", async () => {
      vi.mocked(uploadImage).mockResolvedValue({
        assetId: "new-asset-id",
        url: "https://x/new.jpg",
        width: 800,
        height: 600,
        format: "jpeg",
        sizeBytes: 10000,
      });
      mockFetch.mockImplementation((u: string, init?: RequestInit) => routeWithCreate(u, init));

      const onChange = vi.fn();
      const onOpenChange = vi.fn();
      const existing = [{ id: "a", publicId: "pid-a" }];
      renderWithProviders(
        <MediaPicker mode="multi" value={existing} onChange={onChange} open onOpenChange={onOpenChange} />
      );

      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      await screen.findByRole("listbox", { name: /photos/i });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // onChange called with existing + new item; picker stays open.
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith([
          { id: "a", publicId: "pid-a" },
          { id: "new-id", publicId: "new-asset-id", width: 800, height: 600 },
        ])
      );
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it("multi mode: offers the metadata wizard after upload, and opens it on 'Add details'", async () => {
      vi.mocked(uploadImage).mockResolvedValue({
        assetId: "new-asset-id",
        url: "https://x/new.jpg",
        width: 800,
        height: 600,
        format: "jpeg",
        sizeBytes: 10000,
      });
      mockFetch.mockImplementation((u: string, init?: RequestInit) => routeWithCreate(u, init));

      renderWithProviders(
        <MediaPicker mode="multi" value={[]} onChange={vi.fn()} open onOpenChange={vi.fn()} />
      );
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      await screen.findByRole("listbox", { name: /photos/i });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(await screen.findByText("1 photo uploaded")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: /^add details$/i }));
      expect(await screen.findByText("Add photo details")).toBeTruthy();
      expect(screen.getByText("Photo 1 of 1")).toBeTruthy();
    });

    it("multi mode: 'Skip for now' dismisses the offer without opening the wizard", async () => {
      vi.mocked(uploadImage).mockResolvedValue({
        assetId: "new-asset-id",
        url: "https://x/new.jpg",
        width: 800,
        height: 600,
        format: "jpeg",
        sizeBytes: 10000,
      });
      mockFetch.mockImplementation((u: string, init?: RequestInit) => routeWithCreate(u, init));

      renderWithProviders(
        <MediaPicker mode="multi" value={[]} onChange={vi.fn()} open onOpenChange={vi.fn()} />
      );
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      await screen.findByRole("listbox", { name: /photos/i });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await screen.findByText("1 photo uploaded");
      fireEvent.click(screen.getByRole("button", { name: /^skip for now$/i }));
      expect(screen.queryByText("1 photo uploaded")).toBeNull();
      expect(screen.queryByText("Add photo details")).toBeNull();
    });
  });

  describe("upload errors (per-file)", () => {
    /** Fetch router that also handles gallery-item creation POST. */
    function routeWithCreate(url: string, init?: RequestInit) {
      if (url === "/api/portfolio/gallery/items" && (init as RequestInit)?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "new-id", thumbUrl: "https://x/new-thumb.jpg", caption: null }),
        } as Response);
      }
      return routeFetch(url);
    }

    it("mixed batch: reports the failing file by name/reason and still adds the succeeding one", async () => {
      const { UploadError } = await import("@/lib/uploads/uploadError");
      vi.mocked(uploadImage)
        .mockRejectedValueOnce(
          new UploadError({ code: "file_too_large", actualBytes: 20_000_000, maxBytes: 15_000_000 })
        )
        .mockResolvedValueOnce({
          assetId: "new-asset-id",
          url: "https://x/new.jpg",
          width: 800,
          height: 600,
          format: "jpeg",
          sizeBytes: 10000,
        });
      mockFetch.mockImplementation((u: string, init?: RequestInit) => routeWithCreate(u, init));

      const onChange = vi.fn();
      renderWithProviders(<MediaPicker mode="multi" value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      await screen.findByRole("listbox", { name: /photos/i });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const bigFile = new File(["a"], "toobig.jpg", { type: "image/jpeg" });
      const okFile = new File(["b"], "ok.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [bigFile, okFile] } });

      // Failing file surfaces by name with the real numbers, not a generic message.
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/toobig\.jpg/);
      expect(alert.textContent).toMatch(/19\.1 MB/); // 20,000,000 bytes
      expect(alert.textContent).toMatch(/14\.3 MB/); // 15,000,000 bytes
      // Succeeding file was still added to the selection.
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith([
          { id: "new-id", publicId: "new-asset-id", width: 800, height: 600 },
        ])
      );
    });

    it("client-side type rejection surfaces the specific mime type and accepted formats", async () => {
      const onChange = vi.fn();
      renderWithProviders(<MediaPicker mode="multi" value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      await screen.findByRole("listbox", { name: /photos/i });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const badFile = new File(["a"], "clip.gif", { type: "image/gif" });
      fireEvent.change(fileInput, { target: { files: [badFile] } });

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/clip\.gif/);
      expect(alert.textContent).toMatch(/GIF/);
      expect(uploadImage).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("create-POST failure reads .detail instead of showing a bare HTTP status", async () => {
      vi.mocked(uploadImage).mockResolvedValue({
        assetId: "new-asset-id",
        url: "https://x/new.jpg",
        width: 400,
        height: 400,
        format: "jpeg",
        sizeBytes: 5000,
      });
      mockFetch.mockImplementation((u: string, init?: RequestInit) => {
        if (u === "/api/portfolio/gallery/items" && (init as RequestInit)?.method === "POST") {
          return Promise.resolve({
            ok: false,
            status: 422,
            json: async () => ({
              error: "dimension_too_small",
              detail: { code: "dimension_too_small", actualWidth: 400, actualHeight: 400, minShortSide: 600 },
            }),
          } as Response);
        }
        return routeFetch(u);
      });

      const onChange = vi.fn();
      renderWithProviders(<MediaPicker mode="multi" value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      await screen.findByRole("listbox", { name: /photos/i });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const smallFile = new File(["a"], "small.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [smallFile] } });

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/small\.jpg/);
      expect(alert.textContent).toMatch(/400.*400/);
      expect(alert.textContent).toMatch(/600/);
      expect(alert.textContent).not.toMatch(/HTTP/);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("edit alt text trigger", () => {
    it("renders with an accessible name and opens the dialog without toggling selection", async () => {
      const onChange = vi.fn();
      renderWithProviders(<MediaPicker mode="single" value="" onChange={onChange} open onOpenChange={vi.fn()} />);
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      fireEvent.click(await screen.findByRole("button", { name: /edit alt text for A/i }));
      expect(onChange).not.toHaveBeenCalled();
      expect(await screen.findByLabelText("Alt text")).toBeTruthy();
    });

    it("meets the 24x24 minimum target size (WCAG 2.2 SC 2.5.8)", async () => {
      renderWithProviders(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      const editTrigger = await screen.findByRole("button", { name: /edit alt text for A/i });
      expect(editTrigger.className).toMatch(/\bsize-6\b/);
    });

    it("does not nest the edit trigger inside role=option (ARIA forbids interactive descendants of option)", async () => {
      renderWithProviders(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      const editTrigger = await screen.findByRole("button", { name: /edit alt text for A/i });
      expect(editTrigger.closest('[role="option"]')).toBeNull();
    });

    it("PATCHes on save and the tile reflects the new alt text when reopened", async () => {
      mockFetch.mockImplementation((u: string, init?: RequestInit) => {
        if (u === "/api/portfolio/gallery/items/a" && (init as RequestInit)?.method === "PATCH") {
          return Promise.resolve({ ok: true, json: async () => ({ ...colItems[0], altText: "Bride and groom" }) } as Response);
        }
        return routeFetch(u);
      });
      renderWithProviders(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      fireEvent.click(await screen.findByRole("button", { name: /edit alt text for A/i }));
      fireEvent.change(await screen.findByLabelText("Alt text"), { target: { value: "Bride and groom" } });
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() =>
        expect(mockFetch.mock.calls.some(([u, i]) => String(u) === "/api/portfolio/gallery/items/a" && (i as RequestInit)?.method === "PATCH")).toBe(true)
      );
      await waitFor(() => expect(screen.queryByLabelText("Alt text")).toBeNull());

      fireEvent.click(screen.getByRole("button", { name: /edit alt text for A/i }));
      expect(await screen.findByLabelText("Alt text")).toHaveValue("Bride and groom");
    });
  });

  describe("uncap selection (max=null)", () => {
    function makeSelection(n: number) {
      return Array.from({ length: n }, (_, i) => ({ id: `s${i}`, publicId: `pid-s${i}` }));
    }

    it("max={null}: selection can exceed the default 60 cap", async () => {
      const onChange = vi.fn();
      renderWithProviders(
        <MediaPicker mode="multi" max={null} value={makeSelection(60)} onChange={onChange} open onOpenChange={vi.fn()} />
      );
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      fireEvent.click(await screen.findByRole("option", { name: /^A/ }));
      expect(onChange).toHaveBeenCalledWith([...makeSelection(60), { id: "a", publicId: "pid-a" }]);
    });

    it("max={null}: counter shows 'N selected' with no denominator and no Infinity", async () => {
      renderWithProviders(
        <MediaPicker mode="multi" max={null} value={makeSelection(60)} onChange={vi.fn()} open onOpenChange={vi.fn()} />
      );
      const counter = await screen.findByText(/selected/);
      expect(counter.textContent).toContain("60 selected");
      expect(counter.textContent).not.toMatch(/\/60/);
      expect(counter.textContent).not.toMatch(/Infinity/);
    });

    it("max omitted: the default cap is still 60", async () => {
      const onChange = vi.fn();
      renderWithProviders(
        <MediaPicker mode="multi" value={makeSelection(60)} onChange={onChange} open onOpenChange={vi.fn()} />
      );
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      fireEvent.click(await screen.findByRole("option", { name: /^A/ }));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("max={12}: cap unchanged at 12", async () => {
      const onChange = vi.fn();
      renderWithProviders(
        <MediaPicker mode="multi" max={12} value={makeSelection(12)} onChange={onChange} open onOpenChange={vi.fn()} />
      );
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      fireEvent.click(await screen.findByRole("option", { name: /^A/ }));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("collection tile tri-state checkbox", () => {
    const twoItemCollections = [
      { id: "col1", name: "Weddings", coverUrl: "https://x/c1.jpg", coverPublicId: "pid-col1", itemCount: 2 },
    ];
    const twoItems = [
      { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: "A", altText: null },
      { id: "b", publicId: "pid-b", thumbUrl: "https://x/b.jpg", caption: "B", altText: null },
    ];
    function routeTwoItem(url: string) {
      if (url === "/api/portfolio/gallery") {
        return Promise.resolve({ ok: true, json: async () => ({ collections: twoItemCollections, items: twoItems }) } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: twoItems, nextCursor: null }) } as Response);
    }

    // Cache membership is required to derive "mixed"/"checked" — the real app
    // always wraps the editor in GalleryPickerCacheProvider (via EditorShell);
    // these tests wrap it explicitly since renderWithProviders does not.
    function renderWithCache(ui: ReactElement) {
      return renderWithProviders(<GalleryPickerCacheProvider>{ui}</GalleryPickerCacheProvider>);
    }

    it("renders unchecked for a collection whose ids are not cached", async () => {
      mockFetch.mockImplementation((u: string) => routeTwoItem(u));
      renderWithCache(<MediaPicker mode="multi" value={[]} onChange={vi.fn()} open onOpenChange={vi.fn()} />);
      const box = await screen.findByRole("checkbox", { name: /select all photos in weddings/i });
      expect(box.getAttribute("aria-checked")).toBe("false");
    });

    it("shows 'mixed' when some of the collection's photos are selected", async () => {
      mockFetch.mockImplementation((u: string) => routeTwoItem(u));
      renderWithCache(
        <MediaPicker mode="multi" value={[{ id: "a", publicId: "pid-a" }]} onChange={vi.fn()} open onOpenChange={vi.fn()} />
      );
      // Open the collection so its ids get cached, then go back to the tile grid.
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      await screen.findByRole("option", { name: /^A/ });
      fireEvent.click(screen.getByRole("button", { name: /back to collections/i }));
      const box = await screen.findByRole("checkbox", { name: /select all photos in weddings/i });
      expect(box.getAttribute("aria-checked")).toBe("mixed");
    });

    it("shows 'true' when all of the collection's photos are selected", async () => {
      mockFetch.mockImplementation((u: string) => routeTwoItem(u));
      renderWithCache(
        <MediaPicker
          mode="multi"
          value={[
            { id: "a", publicId: "pid-a" },
            { id: "b", publicId: "pid-b" },
          ]}
          onChange={vi.fn()}
          open
          onOpenChange={vi.fn()}
        />
      );
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      await screen.findByRole("option", { name: /^A/ });
      fireEvent.click(screen.getByRole("button", { name: /back to collections/i }));
      const box = await screen.findByRole("checkbox", { name: /deselect all photos in weddings/i });
      expect(box.getAttribute("aria-checked")).toBe("true");
    });

    it("clicking a checked box removes exactly that collection's ids, leaving other selections intact", async () => {
      mockFetch.mockImplementation((u: string) => routeTwoItem(u));
      const onChange = vi.fn();
      renderWithCache(
        <MediaPicker
          mode="multi"
          value={[
            { id: "a", publicId: "pid-a" },
            { id: "b", publicId: "pid-b" },
            { id: "z", publicId: "pid-z" },
          ]}
          onChange={onChange}
          open
          onOpenChange={vi.fn()}
        />
      );
      fireEvent.click(await screen.findByRole("button", { name: /^weddings$/i }));
      await screen.findByRole("option", { name: /^A/ });
      fireEvent.click(screen.getByRole("button", { name: /back to collections/i }));
      const box = await screen.findByRole("checkbox", { name: /deselect all photos in weddings/i });
      fireEvent.click(box);
      expect(onChange).toHaveBeenCalledWith([{ id: "z", publicId: "pid-z" }]);
    });
  });

  describe("unbounded bulk select-all network request", () => {
    it("max={null}: requests more than the old 60-item cap", async () => {
      const onChange = vi.fn();
      renderWithProviders(<MediaPicker mode="multi" max={null} value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
      const checkbox = await screen.findByRole("checkbox", { name: /select all photos in weddings/i });
      fireEvent.click(checkbox);
      await waitFor(() => expect(onChange).toHaveBeenCalled());
      const newestCall = mockFetch.mock.calls.find(([u]) => String(u).includes("newest="));
      expect(newestCall).toBeTruthy();
      const match = String(newestCall![0]).match(/newest=(\d+)/);
      expect(match).toBeTruthy();
      expect(Number(match![1])).toBeGreaterThan(60);
    });

    it("surfaces a message (not a silent drop) when the bulk response is truncated", async () => {
      mockFetch.mockImplementation((u: string) => {
        const url = String(u);
        if (url === "/api/portfolio/gallery") {
          return Promise.resolve({ ok: true, json: async () => ({ collections, items: colItems }) } as Response);
        }
        if (url.includes("newest=")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: colItems, nextCursor: null, truncated: true }),
          } as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({ items: colItems, nextCursor: null }) } as Response);
      });
      const onChange = vi.fn();
      renderWithProviders(<MediaPicker mode="multi" value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
      fireEvent.click(await screen.findByRole("checkbox", { name: /select all photos in weddings/i }));
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/2000/);
      // The (partial) result is still applied — truncation is surfaced, not swallowed.
      expect(onChange).toHaveBeenCalled();
    });
  });
});
