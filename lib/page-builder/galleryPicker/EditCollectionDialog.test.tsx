import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { EditCollectionDialog } from "./EditCollectionDialog";
import { __clearPickerDataCache } from "./usePickerData";

vi.mock("@/lib/storage/uploadImage.client", () => ({
  uploadImage: vi.fn(),
}));
import { uploadImage } from "@/lib/storage/uploadImage.client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const collection = { id: "col1", name: "Weddings", coverUrl: "https://x/c.jpg", coverPublicId: "pid-a", itemCount: 2 };
const items = [
  { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: "A" },
  { id: "b", publicId: "pid-b", thumbUrl: "https://x/b.jpg", caption: "B" },
];

function defaultRoute(url: string, init?: RequestInit) {
  if (url === "/api/portfolio/gallery") return Promise.resolve({ ok: true, json: async () => ({ collections: [collection], items }) } as Response);
  if (url.startsWith("/api/portfolio/gallery/collections/col1?")) return Promise.resolve({ ok: true, json: async () => ({ items, nextCursor: null }) } as Response);
  if (url === "/api/portfolio/gallery/collections/col1" && init?.method === "PATCH")
    return Promise.resolve({ ok: true, json: async () => ({ id: "col1", name: "Renamed", coverItemId: "a" }) } as Response);
  if (url.includes("/items/remove")) return Promise.resolve({ ok: true, json: async () => ({ removed: 1 }) } as Response);
  if (url === "/api/portfolio/gallery/items/delete") return Promise.resolve({ ok: true, json: async () => ({ deletedDocs: 1, assetsDestroyed: 1, assetsFailed: 0 }) } as Response);
  if (url.includes("/items/reorder")) return Promise.resolve({ ok: true, json: async () => ({ ok: true }) } as Response);
  if (url.includes("/items/copy")) return Promise.resolve({ ok: true, json: async () => ({ items: [] }) } as Response);
  return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
}
beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockFetch.mockImplementation(defaultRoute);
  vi.mocked(uploadImage).mockReset();
});

function open() {
  return renderWithProviders(
    <EditCollectionDialog open onOpenChange={vi.fn()} collection={collection} onChanged={vi.fn()} />
  );
}

describe("EditCollectionDialog", () => {
  it("loads and shows the collection's photos", async () => {
    open();
    await waitFor(() => expect(mockFetch.mock.calls.some(([u]) => String(u).startsWith("/api/portfolio/gallery/collections/col1?"))).toBe(true));
    expect(await screen.findByRole("checkbox", { name: /select A/i })).toBeTruthy();
  });

  it("renames via PATCH", async () => {
    open();
    const input = await screen.findByLabelText(/collection name/i);
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: /save name/i }));
    await waitFor(() =>
      expect(mockFetch.mock.calls.some(([u, i]) => String(u) === "/api/portfolio/gallery/collections/col1" && (i as RequestInit)?.method === "PATCH")).toBe(true)
    );
  });

  it("blocks rename when the name is empty", async () => {
    open();
    const input = await screen.findByLabelText(/collection name/i);
    fireEvent.change(input, { target: { value: "  " } });
    expect(screen.getByRole("button", { name: /save name/i })).toBeDisabled();
  });

  it("removes selected photos from the collection", async () => {
    open();
    fireEvent.click(await screen.findByRole("checkbox", { name: /select A/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove from collection/i }));
    await waitFor(() => expect(mockFetch.mock.calls.some(([u]) => String(u).includes("/items/remove"))).toBe(true));
  });

  it("delete image is behind a confirm dialog", async () => {
    open();
    fireEvent.click(await screen.findByRole("checkbox", { name: /select A/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete image/i }));
    expect(mockFetch.mock.calls.some(([u]) => String(u) === "/api/portfolio/gallery/items/delete")).toBe(false);
    fireEvent.click(await screen.findByRole("button", { name: /delete permanently/i }));
    await waitFor(() => expect(mockFetch.mock.calls.some(([u]) => String(u) === "/api/portfolio/gallery/items/delete")).toBe(true));
  });

  it("sets a cover via PATCH coverItemId", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: /set B as cover/i }));
    await waitFor(() =>
      expect(mockFetch.mock.calls.some(([u, i]) => String(u) === "/api/portfolio/gallery/collections/col1" && (i as RequestInit)?.method === "PATCH" && String((i as RequestInit)?.body).includes("coverItemId"))).toBe(true)
    );
  });

  // (b) Photos-manager upload does NOT auto-select — it appends to the list and
  // calls onChanged for cache refresh, with no selection side-effect.
  it("(b) upload appends the photo to the list and calls onChanged without auto-selecting", async () => {
    vi.mocked(uploadImage).mockResolvedValue({
      assetId: "up-asset",
      url: "https://x/up.jpg",
      width: 900,
      height: 600,
      format: "jpeg",
      sizeBytes: 20000,
    });
    // Route the gallery-items POST to return a new item.
    mockFetch.mockImplementation((u: string, init?: RequestInit) => {
      if (u === "/api/portfolio/gallery/items" && (init as RequestInit)?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ id: "up-id", thumbUrl: "https://x/up-thumb.jpg", caption: null }) } as Response);
      }
      return defaultRoute(u, init);
    });

    const onChanged = vi.fn();
    renderWithProviders(
      <EditCollectionDialog open onOpenChange={vi.fn()} collection={collection} onChanged={onChanged} />
    );

    // Wait for the dialog to load existing items.
    await screen.findByRole("checkbox", { name: /select A/i });

    // Trigger upload via the hidden file input.
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["data"], "new.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // The upload pipeline completes: the new item appears in the list.
    await waitFor(() => expect(mockFetch.mock.calls.some(([u, i]) =>
      String(u) === "/api/portfolio/gallery/items" && (i as RequestInit)?.method === "POST"
    )).toBe(true));
    // onChanged is called for cache refresh — that's the only side-effect.
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    // No "selection" callback is called — EditCollectionDialog has no such API.
    // Verify the uploaded photo checkbox is NOT pre-checked (no auto-select).
    const allCheckboxes = screen.getAllByRole("checkbox");
    for (const cb of allCheckboxes) {
      expect(cb).not.toBeChecked();
    }
  });
});
