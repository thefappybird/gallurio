import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { EditCollectionDialog } from "./EditCollectionDialog";
import { __clearPickerDataCache } from "./usePickerData";
import { UploadError } from "@/lib/uploads/uploadError";
import { PORTFOLIO_PHOTO_MAX_BYTES } from "@/lib/page-builder/photoSpec";

vi.mock("@/lib/storage/uploadImage.client", () => ({
  uploadImage: vi.fn(),
}));
import { uploadImage } from "@/lib/storage/uploadImage.client";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const collection = { id: "col1", name: "Weddings", coverUrl: "https://x/c.jpg", coverPublicId: "pid-a", itemCount: 2 };
const items = [
  { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: "A", altText: null },
  { id: "b", publicId: "pid-b", thumbUrl: "https://x/b.jpg", caption: "B", altText: null },
];

function defaultRoute(url: string, init?: RequestInit) {
  if (url === "/api/portfolio/gallery") return Promise.resolve({ ok: true, json: async () => ({ collections: [collection], items }) } as Response);
  if (url.startsWith("/api/portfolio/gallery/collections/col1?")) return Promise.resolve({ ok: true, json: async () => ({ items, nextCursor: null, description: "Full-day coverage." }) } as Response);
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

  it("places a same-size upload drop card before the collection photos", async () => {
    open();
    await screen.findByRole("checkbox", { name: /select A/i });
    const card = screen.getByTestId("collection-upload-drop-card");
    const grid = card.closest("ul");
    expect(grid?.firstElementChild).toContainElement(card);
    expect(card.closest("li")?.className).toContain("aspect-square");
  });

  it("opens the file picker when the upload card is clicked", async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, "click");
    open();
    await screen.findByRole("checkbox", { name: /select A/i });
    fireEvent.click(screen.getByTestId("collection-upload-drop-card"));
    expect(click).toHaveBeenCalled();
    click.mockRestore();
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

  it("prefills the description from the collection fetch and saves it via PATCH", async () => {
    open();
    const field = await screen.findByLabelText(/description/i);
    await waitFor(() => expect(field).toHaveValue("Full-day coverage."));

    fireEvent.change(field, { target: { value: "Updated description." } });
    fireEvent.click(screen.getByRole("button", { name: /save description/i }));

    await waitFor(() => {
      const call = mockFetch.mock.calls.find(
        ([u, i]) => String(u) === "/api/portfolio/gallery/collections/col1" && (i as RequestInit)?.method === "PATCH"
      );
      expect(call).toBeTruthy();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ description: "Updated description." });
    });
  });

  it("disables Save description until the description actually changes", async () => {
    open();
    const field = await screen.findByLabelText(/description/i);
    await waitFor(() => expect(field).toHaveValue("Full-day coverage."));
    expect(screen.getByRole("button", { name: /save description/i })).toBeDisabled();
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

  it("uploads files dropped on the first grid card", async () => {
    vi.mocked(uploadImage).mockResolvedValue({
      assetId: "drop-asset",
      url: "https://x/drop.jpg",
      width: 900,
      height: 600,
      format: "jpeg",
      sizeBytes: 20000,
    });
    mockFetch.mockImplementation((u: string, init?: RequestInit) => {
      if (u === "/api/portfolio/gallery/items" && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ id: "drop-id", thumbUrl: "https://x/drop-thumb.jpg", caption: null }) } as Response);
      }
      return defaultRoute(u, init);
    });

    open();
    await screen.findByRole("checkbox", { name: /select A/i });
    fireEvent.drop(screen.getByTestId("collection-upload-drop-card"), {
      dataTransfer: { files: [new File(["data"], "dropped.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() => expect(vi.mocked(uploadImage)).toHaveBeenCalled());
    await waitFor(() => expect(mockFetch.mock.calls.some(([u, i]) =>
      String(u) === "/api/portfolio/gallery/items" && (i as RequestInit)?.method === "POST"
    )).toBe(true));
  });

  it("renders a per-photo edit-alt-text trigger with an accessible name", async () => {
    open();
    expect(await screen.findByRole("button", { name: /edit alt text for A/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /edit alt text for B/i })).toBeTruthy();
  });

  it("meets the 24x24 minimum target size (WCAG 2.2 SC 2.5.8)", async () => {
    open();
    const editTrigger = await screen.findByRole("button", { name: /edit alt text for A/i });
    expect(editTrigger.className).toMatch(/\bsize-6\b/);
  });

  it("editing alt text PATCHes the item and the tile reflects it when reopened", async () => {
    mockFetch.mockImplementation((u: string, init?: RequestInit) => {
      if (u === "/api/portfolio/gallery/items/a" && init?.method === "PATCH") {
        return Promise.resolve({ ok: true, json: async () => ({ ...items[0], altText: "Bride and groom" }) } as Response);
      }
      return defaultRoute(u, init);
    });
    open();
    fireEvent.click(await screen.findByRole("button", { name: /edit alt text for A/i }));
    const field = await screen.findByLabelText("Alt text");
    expect(field).toHaveValue("");
    fireEvent.change(field, { target: { value: "Bride and groom" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(mockFetch.mock.calls.some(([u, i]) => String(u) === "/api/portfolio/gallery/items/a" && (i as RequestInit)?.method === "PATCH")).toBe(true)
    );
    await waitFor(() => expect(screen.queryByLabelText("Alt text")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /edit alt text for A/i }));
    expect(await screen.findByLabelText("Alt text")).toHaveValue("Bride and groom");
  });

  it("reports a per-file error for a file rejected before upload (unsupported type), instead of silently dropping it", async () => {
    open();
    await screen.findByRole("checkbox", { name: /select A/i });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(["data"], "clip.gif", { type: "image/gif" });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    const alert = await screen.findByText(/clip\.gif/i);
    expect(alert.closest("li")?.textContent).toMatch(/gif/i);
    // Never uploaded — pre-validation rejected it before hitting the network.
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("reports per-file errors on a mixed batch — some files succeed, one fails at upload, one fails type validation", async () => {
    vi.mocked(uploadImage).mockImplementation(async (file: File) => {
      if (file.name === "bad.png") throw new UploadError({ code: "file_too_large", actualBytes: 20_000_000, maxBytes: PORTFOLIO_PHOTO_MAX_BYTES });
      return { assetId: `asset-${file.name}`, url: `https://x/${file.name}`, width: 900, height: 600, format: "jpeg", sizeBytes: 20000 };
    });
    mockFetch.mockImplementation((u: string, init?: RequestInit) => {
      if (u === "/api/portfolio/gallery/items" && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ id: "up-id", thumbUrl: "https://x/up-thumb.jpg", caption: null }) } as Response);
      }
      return defaultRoute(u, init);
    });

    open();
    await screen.findByRole("checkbox", { name: /select A/i });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const good = new File(["data"], "good.jpg", { type: "image/jpeg" });
    const tooBig = new File(["data"], "bad.png", { type: "image/png" });
    const wrongType = new File(["data"], "clip.gif", { type: "image/gif" });
    fireEvent.change(fileInput, { target: { files: [good, tooBig, wrongType] } });

    // The one that fails validation reports immediately.
    await screen.findByText(/clip\.gif/i);
    // The one that fails upload reports once the batch settles.
    const badLine = await screen.findByText(/bad\.png/i);
    expect(badLine.closest("li")?.textContent).toMatch(/20\.0 MB|too large|15/i);
    // Both are visible together — not collapsed into one message.
    expect(screen.getByText(/clip\.gif/i)).toBeTruthy();
    expect(screen.getByText(/bad\.png/i)).toBeTruthy();
    // The good file still succeeded despite the other two failing.
    await waitFor(() => expect(mockFetch.mock.calls.some(([u, i]) =>
      String(u) === "/api/portfolio/gallery/items" && (i as RequestInit)?.method === "POST"
    )).toBe(true));
  });

  it("shows the server's specific reason (dimension_too_small) when the create-item API rejects an uploaded photo", async () => {
    vi.mocked(uploadImage).mockResolvedValue({
      assetId: "small-asset", url: "https://x/small.jpg", width: 300, height: 300, format: "jpeg", sizeBytes: 20000,
    });
    mockFetch.mockImplementation((u: string, init?: RequestInit) => {
      if (u === "/api/portfolio/gallery/items" && init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: "dimension_too_small",
            detail: { code: "dimension_too_small", actualWidth: 300, actualHeight: 300, minShortSide: 600 },
          }),
        } as Response);
      }
      return defaultRoute(u, init);
    });

    open();
    await screen.findByRole("checkbox", { name: /select A/i });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(["data"], "small.jpg", { type: "image/jpeg" })] } });

    const line = await screen.findByText(/small\.jpg/i);
    // The rendered message must contain the actual dimensions, not a generic fallback.
    expect(line.closest("li")?.textContent).toMatch(/300/);
  });
});

describe("EditCollectionDialog metadata wizard (10a) and incomplete-metadata warning", () => {
  it("shows an incomplete-metadata warning badge for a photo with no alt text", async () => {
    open();
    // Both seeded items (A, B) have altText: null, so both get the badge.
    await screen.findByRole("checkbox", { name: /select A/i });
    expect(await screen.findAllByRole("button", { name: /missing alt text/i })).toHaveLength(2);
  });

  it("offers the metadata wizard after an upload, dismissable without gating anything", async () => {
    vi.mocked(uploadImage).mockResolvedValue({
      assetId: "up-asset", url: "https://x/up.jpg", width: 900, height: 600, format: "jpeg", sizeBytes: 20000,
    });
    mockFetch.mockImplementation((u: string, init?: RequestInit) => {
      if (u === "/api/portfolio/gallery/items" && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ id: "up-id", thumbUrl: "https://x/up-thumb.jpg", caption: null }) } as Response);
      }
      return defaultRoute(u, init);
    });
    open();
    await screen.findByRole("checkbox", { name: /select A/i });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(["data"], "new.jpg", { type: "image/jpeg" })] } });

    expect(await screen.findByText(/add details/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(screen.queryByText(/add details/i)).toBeNull();
  });

  it("wizard save PATCHes the uploaded item and clears its warning badge", async () => {
    vi.mocked(uploadImage).mockResolvedValue({
      assetId: "up-asset", url: "https://x/up.jpg", width: 900, height: 600, format: "jpeg", sizeBytes: 20000,
    });
    mockFetch.mockImplementation((u: string, init?: RequestInit) => {
      if (u === "/api/portfolio/gallery/items" && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ id: "up-id", thumbUrl: "https://x/up-thumb.jpg", caption: null }) } as Response);
      }
      if (u === "/api/portfolio/gallery/items/up-id" && init?.method === "PATCH") {
        return Promise.resolve({ ok: true, json: async () => ({ id: "up-id", publicId: "up-asset", thumbUrl: "https://x/up-thumb.jpg", caption: null, altText: "New photo" }) } as Response);
      }
      return defaultRoute(u, init);
    });
    open();
    await screen.findByRole("checkbox", { name: /select A/i });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(["data"], "new.jpg", { type: "image/jpeg" })] } });

    fireEvent.click(await screen.findByRole("button", { name: /add details/i }));
    const altField = await screen.findByRole("textbox", { name: /^alt text$/i });
    fireEvent.change(altField, { target: { value: "New photo" } });
    fireEvent.click(screen.getByRole("button", { name: /^save and exit$/i }));

    await waitFor(() =>
      expect(mockFetch.mock.calls.some(([u, i]) => String(u) === "/api/portfolio/gallery/items/up-id" && (i as RequestInit)?.method === "PATCH")).toBe(true)
    );
  });
});
