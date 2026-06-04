import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CollectionsManagerDialog } from "./CollectionsManagerDialog";
import { __clearPickerDataCache } from "./usePickerData";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockPickerResponse(collections: unknown[]) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ collections, items: [] }),
  } as unknown as Response);
}

beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockPickerResponse([]);
});

describe("CollectionsManagerDialog", () => {
  it("renders the manager with the add-new-collection button when open", async () => {
    render(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);
    expect(await screen.findByText("Photos & collections")).toBeTruthy();
    expect(screen.getByRole("button", { name: /add new collection/i })).toBeTruthy();
    // Explains where collections are used.
    expect(screen.getByText(/use them in gallery blocks/i)).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    render(<CollectionsManagerDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Photos & collections")).toBeNull();
  });

  it("does not show the create form until 'Add new collection' is clicked", async () => {
    render(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);
    await screen.findByText("Photos & collections");
    // The nested create dialog (title "New collection") is hidden initially.
    expect(screen.queryByText("New collection")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /add new collection/i }));
    expect(await screen.findByText("New collection")).toBeTruthy();
  });

  it("opens a destructive confirm when a collection's delete button is pressed", async () => {
    mockPickerResponse([{ id: "c1", name: "Weddings", coverUrl: null, itemCount: 4 }]);
    render(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);

    const del = await screen.findByRole("button", { name: /delete collection: weddings/i });
    fireEvent.click(del);

    expect(await screen.findByText(/delete this collection\?/i)).toBeTruthy();
    expect(screen.getByText(/permanently deleted/i)).toBeTruthy();
  });

  it("DELETEs the collection and refreshes on confirm", async () => {
    mockPickerResponse([{ id: "c1", name: "Weddings", coverUrl: null, itemCount: 4 }]);
    render(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /delete collection: weddings/i }));
    // The DELETE call resolves ok; subsequent picker refetch returns empty.
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as unknown as Response);
    mockPickerResponse([]);

    fireEvent.click(await screen.findByRole("button", { name: /delete permanently/i }));

    await waitFor(() =>
      expect(
        mockFetch.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/portfolio/gallery/collections/c1" &&
            (init as RequestInit | undefined)?.method === "DELETE"
        )
      ).toBe(true)
    );
  });
});
