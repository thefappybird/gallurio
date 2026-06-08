import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MediaPicker } from "./MediaPicker";
import { __clearPickerDataCache } from "./usePickerData";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const collections = [
  { id: "col1", name: "Weddings", coverUrl: "https://x/c1.jpg", itemCount: 3 },
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
});
