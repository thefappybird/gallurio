import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { EditCollectionDialog } from "./EditCollectionDialog";
import { __clearPickerDataCache } from "./usePickerData";

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
});
