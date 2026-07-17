import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
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
    renderWithProviders(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);
    expect(await screen.findByText("Photos & collections")).toBeTruthy();
    expect(screen.getByRole("button", { name: /add new collection/i })).toBeTruthy();
    // Explains where collections are used.
    expect(screen.getByText(/use them in gallery blocks/i)).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    renderWithProviders(<CollectionsManagerDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Photos & collections")).toBeNull();
  });

  it("keeps an empty manager comfortably sized", async () => {
    renderWithProviders(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);
    const emptyState = await screen.findByTestId("collections-empty-state");
    expect(emptyState).toHaveClass("min-h-52");
  });

  it("does not show the create form until 'Add new collection' is clicked", async () => {
    renderWithProviders(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);
    await screen.findByText("Photos & collections");
    // The nested create dialog (title "New collection") is hidden initially.
    expect(screen.queryByText("New collection")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /add new collection/i }));
    expect(await screen.findByText("New collection")).toBeTruthy();
  });

  it("opens a destructive confirm when a collection's delete button is pressed", async () => {
    mockPickerResponse([{ id: "c1", name: "Weddings", coverUrl: null, itemCount: 4 }]);
    renderWithProviders(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);

    const del = await screen.findByRole("button", { name: /delete collection: weddings/i });
    fireEvent.click(del);

    expect(await screen.findByText(/delete this collection\?/i)).toBeTruthy();
    expect(screen.getByText(/permanently deleted/i)).toBeTruthy();
  });

  it("DELETEs the collection and refreshes on confirm", async () => {
    mockPickerResponse([{ id: "c1", name: "Weddings", coverUrl: null, itemCount: 4 }]);
    renderWithProviders(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);

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

describe("CollectionsManagerDialog edit", () => {
  it("opens the edit dialog when a collection is clicked", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/portfolio/gallery")
        return Promise.resolve({
          ok: true,
          json: async () => ({
            collections: [{ id: "col1", name: "Weddings", coverUrl: "https://x/c.jpg", coverPublicId: "pid-a", itemCount: 2 }],
            items: [],
          }),
        } as unknown as Response);
      if (url.startsWith("/api/portfolio/gallery/collections/col1?"))
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [], nextCursor: null }),
        } as unknown as Response);
      return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
    });

    renderWithProviders(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /edit weddings/i }));
    expect(await screen.findByLabelText(/collection name/i)).toBeTruthy();
  });
});
