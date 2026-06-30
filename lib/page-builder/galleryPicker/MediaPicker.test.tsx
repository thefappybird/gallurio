import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MediaPicker } from "./MediaPicker";
import type { MediaPickerCollectionSelection } from "./MediaPicker";
import { __clearPickerDataCache } from "./usePickerData";

vi.mock("@/lib/storage/uploadImage.client", () => ({
  uploadImage: vi.fn(),
}));
import { uploadImage } from "@/lib/storage/uploadImage.client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const collections = [
  { id: "col1", name: "Weddings", coverUrl: "https://x/c1.jpg", coverPublicId: "pid-col1", itemCount: 3 },
  { id: "col2", name: "Portraits", coverUrl: "https://x/c2.jpg", coverPublicId: "pid-col2", itemCount: 5 },
  { id: "col3", name: "Events", coverUrl: "https://x/c3.jpg", coverPublicId: "pid-col3", itemCount: 2 },
];
const colItems = [
  { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: "A" },
  { id: "b", publicId: "pid-b", thumbUrl: "https://x/b.jpg", caption: "B" },
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
    render(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /all photos/i })).toBeTruthy());
    expect(screen.getByRole("button", { name: /weddings/i })).toBeTruthy();
  });

  it("single mode: picking a photo calls onChange(publicId) and closes", async () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<MediaPicker mode="single" value="" onChange={onChange} open onOpenChange={onOpenChange} />);
    fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^A/ }));
    expect(onChange).toHaveBeenCalledWith("pid-a");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("multi mode: toggling appends {id,publicId} and respects max", async () => {
    const onChange = vi.fn();
    render(<MediaPicker mode="multi" max={1} value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^A/ }));
    expect(onChange).toHaveBeenCalledWith([{ id: "a", publicId: "pid-a" }]);
  });

  it("multi mode: 'select all on page' respects max (newest/page order, capped)", async () => {
    const onChange = vi.fn();
    render(<MediaPicker mode="multi" max={1} value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
    fireEvent.click(await screen.findByRole("button", { name: /select all on page/i }));
    expect(onChange).toHaveBeenCalledWith([{ id: "a", publicId: "pid-a" }]);
  });

  it("multi mode: 'select all in collection' fetches newest-N and sets selection (capped)", async () => {
    const onChange = vi.fn();
    render(<MediaPicker mode="multi" max={2} value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
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

  it("hides 'select all in collection' on the All photos feed", async () => {
    render(<MediaPicker mode="multi" value={[]} onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /all photos/i }));
    await waitFor(() => screen.getByRole("button", { name: /select all on page/i }));
    expect(screen.queryByRole("button", { name: /select all in collection/i })).toBeNull();
  });

  it("renders the empty-workspace state with an upload affordance", async () => {
    mockFetch.mockImplementation((u: string) =>
      u === "/api/portfolio/gallery"
        ? Promise.resolve({ ok: true, json: async () => ({ collections: [], items: [] }) } as Response)
        : Promise.resolve({ ok: true, json: async () => ({ items: [], nextCursor: null }) } as Response)
    );
    render(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/no photos yet/i)).toBeTruthy());
  });

  it("shows error + retry when picker data fails", async () => {
    mockFetch.mockImplementation((u: string) =>
      u === "/api/portfolio/gallery" ? Promise.reject(new Error("net")) : routeFetch(u)
    );
    render(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/could not load/i)).toBeTruthy());
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("does not render its dialog content when closed", () => {
    render(<MediaPicker mode="single" value="" onChange={vi.fn()} open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /all photos/i })).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // collections mode
  // ---------------------------------------------------------------------------

  describe("collections mode", () => {
    it("renders collection tiles as options with aria-selected reflecting selection state", async () => {
      render(
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
      render(
        <MediaPicker
          mode="collections"
          value={[]}
          onChange={onChange}
          open
          onOpenChange={vi.fn()}
        />
      );
      fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
      expect(onChange).toHaveBeenCalledWith([
        { id: "col1", name: "Weddings", coverPublicId: "pid-col1", itemCount: 3 },
      ] satisfies MediaPickerCollectionSelection[]);
    });

    it("clicking a second tile appends it in order (order 2)", async () => {
      const onChange = vi.fn();
      const firstSelection: MediaPickerCollectionSelection[] = [
        { id: "col1", name: "Weddings", coverPublicId: "pid-col1", itemCount: 3 },
      ];
      render(
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
      render(
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
      render(
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
      render(
        <MediaPicker
          mode="collections"
          value={[]}
          onChange={vi.fn()}
          open
          onOpenChange={vi.fn()}
        />
      );
      fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
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
      render(
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
      render(
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
      render(
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
      { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: "A", width: 800, height: 600 },
      { id: "b", publicId: "pid-b", thumbUrl: "https://x/b.jpg", caption: "B" },
    ];
    mockFetch.mockImplementation((u: string) => {
      if (u === "/api/portfolio/gallery") {
        return Promise.resolve({ ok: true, json: async () => ({ collections, items: richItems }) } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: richItems, nextCursor: null }) } as Response);
    });
    const onChange = vi.fn();
    render(<MediaPicker mode="multi" value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
    fireEvent.click(await screen.findByRole("button", { name: /select all on page/i }));
    expect(onChange).toHaveBeenCalledWith([
      { id: "a", publicId: "pid-a", width: 800, height: 600 },
      { id: "b", publicId: "pid-b" },
    ]);
  });

  it("multi mode: selecting an item that carries width/height includes dims in the selection", async () => {
    const richItems = [
      { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: "A", width: 1200, height: 800 },
    ];
    mockFetch.mockImplementation((u: string) => {
      if (u === "/api/portfolio/gallery") {
        return Promise.resolve({ ok: true, json: async () => ({ collections, items: richItems }) } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: richItems, nextCursor: null }) } as Response);
    });
    const onChange = vi.fn();
    render(<MediaPicker mode="multi" value={[]} onChange={onChange} open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^A/ }));
    expect(onChange).toHaveBeenCalledWith([{ id: "a", publicId: "pid-a", width: 1200, height: 800 }]);
  });

  it("switching collections ignores a stale slow response and shows the new collection", async () => {
    const twoCollections = [
      { id: "slow", name: "SlowCol", coverUrl: "https://x/s.jpg", itemCount: 1 },
      { id: "fast", name: "FastCol", coverUrl: "https://x/f.jpg", itemCount: 1 },
    ];
    const slowItems = [{ id: "s1", publicId: "pid-s1", thumbUrl: "https://x/s1.jpg", caption: "SlowPhoto" }];
    const fastItems = [{ id: "f1", publicId: "pid-f1", thumbUrl: "https://x/f1.jpg", caption: "FastPhoto" }];

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

    render(<MediaPicker mode="single" value="" onChange={vi.fn()} open onOpenChange={vi.fn()} />);

    // Open the slow collection (its feed is still pending).
    fireEvent.click(await screen.findByRole("button", { name: /slowcol/i }));
    // Go back, then open the fast collection.
    fireEvent.click(await screen.findByRole("button", { name: /back to collections/i }));
    fireEvent.click(await screen.findByRole("button", { name: /fastcol/i }));

    // Fast collection's photo should render.
    await screen.findByRole("button", { name: /FastPhoto/ });

    // Now let the stale slow response resolve — it must not overwrite the view.
    resolveSlow({ ok: true, json: async () => ({ items: slowItems, nextCursor: null }) } as Response);

    await waitFor(() => expect(screen.queryByRole("button", { name: /SlowPhoto/ })).toBeNull());
    expect(screen.getByRole("button", { name: /FastPhoto/ })).toBeTruthy();
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
      render(
        <MediaPicker mode="single" value="" onChange={onChange} open onOpenChange={onOpenChange} />
      );

      // Navigate into a collection so the photo grid + upload zone are visible.
      fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
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
      render(
        <MediaPicker mode="multi" value={existing} onChange={onChange} open onOpenChange={onOpenChange} />
      );

      fireEvent.click(await screen.findByRole("button", { name: /weddings/i }));
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
  });
});
