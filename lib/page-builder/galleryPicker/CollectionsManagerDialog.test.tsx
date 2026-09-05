import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
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

function ControlledCollectionsManagerDialog() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <CollectionsManagerDialog open={open} onOpenChange={setOpen} />
      <output data-testid="manager-open-state">{String(open)}</output>
    </>
  );
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

  it("announces the collections fetch failure via role=alert", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));
    renderWithProviders(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not load/i);
  });

  it("shows a skeleton grid (not just a spinner line) while collections are loading", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    mockFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );
    renderWithProviders(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);
    const status = await screen.findByRole("status");
    expect(status.querySelectorAll("li").length).toBeGreaterThan(0);
    resolveFetch({ ok: true, json: async () => ({ collections: [], items: [] }) } as unknown as Response);
    await screen.findByTestId("collections-empty-state");
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

  it.each([
    ["Done", () => fireEvent.click(screen.getByRole("button", { name: /done/i }))],
    ["Close", () => fireEvent.click(screen.getByRole("button", { name: /close/i }))],
    ["Escape", () => fireEvent.keyDown(document, { key: "Escape", code: "Escape" })],
  ])("closes the manager with %s", async (_name, dismiss) => {
    renderWithProviders(<ControlledCollectionsManagerDialog />);
    await screen.findByText("Photos & collections");

    dismiss();

    await waitFor(() => expect(screen.getByTestId("manager-open-state")).toHaveTextContent("false"));
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
  it("replaces the manager contents with collection editing in the same shell and supports Back", async () => {
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
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByText("Photos & collections")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /back to photos and collections/i }));
    expect(await screen.findByText("Photos & collections")).toBeTruthy();
    expect(screen.queryByLabelText(/collection name/i)).toBeNull();
  });

  it.each([
    ["Done", () => fireEvent.click(screen.getByRole("button", { name: /done/i }))],
    ["Close", () => fireEvent.click(screen.getByRole("button", { name: /close/i }))],
    ["Escape", () => fireEvent.keyDown(document, { key: "Escape", code: "Escape" })],
  ])("closes the outer manager from the embedded editor with %s", async (_name, dismiss) => {
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/portfolio/gallery") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            collections: [{ id: "col1", name: "Weddings", coverUrl: null, itemCount: 0 }],
            items: [],
          }),
        } as unknown as Response);
      }
      if (url.startsWith("/api/portfolio/gallery/collections/col1?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [], nextCursor: null }),
        } as unknown as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
    });

    renderWithProviders(<ControlledCollectionsManagerDialog />);
    fireEvent.click(await screen.findByRole("button", { name: /edit weddings/i }));
    await screen.findByLabelText(/collection name/i);

    dismiss();

    await waitFor(() => expect(screen.getByTestId("manager-open-state")).toHaveTextContent("false"));
    // Fully closed — not just `editing` reset back to the list view.
    expect(screen.queryByText("Photos & collections")).toBeNull();
  });

  it.each([
    ["Done", () => fireEvent.click(screen.getByRole("button", { name: /done/i }))],
    ["Close", () => fireEvent.click(screen.getByRole("button", { name: /close/i }))],
    ["Escape", () => fireEvent.keyDown(document, { key: "Escape", code: "Escape" })],
  ])(
    "still fully closes with %s after editing a second collection (Back, then edit another) — this case was completely dead before the single-Popup fix",
    async (_name, dismiss) => {
      mockFetch.mockImplementation((url: string) => {
        if (url === "/api/portfolio/gallery") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              collections: [
                { id: "col1", name: "Weddings", coverUrl: null, itemCount: 0 },
                { id: "col2", name: "Portraits", coverUrl: null, itemCount: 0 },
              ],
              items: [],
            }),
          } as unknown as Response);
        }
        if (url.startsWith("/api/portfolio/gallery/collections/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [], nextCursor: null }),
          } as unknown as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      });

      renderWithProviders(<ControlledCollectionsManagerDialog />);

      // Open the first collection, then go Back to the list — mounts and
      // unmounts one embedded-edit view without ever closing the outer
      // manager Dialog.
      fireEvent.click(await screen.findByRole("button", { name: /edit weddings/i }));
      await screen.findByLabelText(/collection name/i);
      fireEvent.click(screen.getByRole("button", { name: /back to photos and collections/i }));
      await screen.findByText("Photos & collections");

      // Open a second collection — this swap was the case that left
      // Done/Close/Escape completely dead before the fix.
      fireEvent.click(await screen.findByRole("button", { name: /edit portraits/i }));
      await screen.findByLabelText(/collection name/i);

      dismiss();

      await waitFor(() => expect(screen.getByTestId("manager-open-state")).toHaveTextContent("false"));
      expect(screen.queryByText("Photos & collections")).toBeNull();
      expect(screen.queryByLabelText(/collection name/i)).toBeNull();
    }
  );
});
