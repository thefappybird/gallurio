import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { CreateCollectionDialog } from "./CreateCollectionDialog";
import { __clearPickerDataCache } from "./usePickerData";

vi.mock("@/lib/storage/uploadImage.client", () => ({ uploadImage: vi.fn() }));
import { uploadImage } from "@/lib/storage/uploadImage.client";
import { UploadError } from "@/lib/uploads/uploadError";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const collections = [{ id: "c0", name: "Existing", coverUrl: "https://x/c.jpg", coverPublicId: "pid-c", itemCount: 1 }];
const photos = [{ id: "src1", publicId: "pid-src1", thumbUrl: "https://x/s.jpg", caption: "Src", altText: null }];

beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  vi.mocked(uploadImage).mockReset();
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/portfolio/gallery") return Promise.resolve({ ok: true, json: async () => ({ collections, items: photos }) } as Response);
    if (url === "/api/portfolio/gallery/collections" && init?.method === "POST")
      return Promise.resolve({ ok: true, json: async () => ({ id: "newCol", name: "X", slug: "x" }) } as Response);
    if (url.includes("/items/copy")) return Promise.resolve({ ok: true, json: async () => ({ items: [] }) } as Response);
    return Promise.resolve({ ok: true, json: async () => ({ items: photos, nextCursor: null }) } as Response);
  });
});

describe("CreateCollectionDialog required fields", () => {
  it("shows a required-field asterisk on the collection title label", () => {
    renderWithProviders(<CreateCollectionDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    const input = screen.getByLabelText(/collection title/i);
    const label = input.closest("label");
    expect(label?.textContent).toContain("*");
    expect(label?.querySelector(".text-destructive")).toBeTruthy();
  });
});

describe("CreateCollectionDialog pick-existing", () => {
  it("copies picked existing photos into the new collection after creation", async () => {
    const onCreated = vi.fn();
    renderWithProviders(<CreateCollectionDialog open onOpenChange={vi.fn()} onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText(/collection title/i), { target: { value: "My collection" } });
    fireEvent.click(screen.getByRole("button", { name: /select existing photos/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Existing$/ }));
    fireEvent.click(await screen.findByRole("option", { name: /src/i }));
    fireEvent.click(screen.getByRole("button", { name: /add 1 photo/i }));
    // Verify a picked-photo thumbnail appears in the preview (img with src = thumbUrl)
    await waitFor(() => expect(document.querySelector('img[src*="s.jpg"]')).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /create/i }));
    await waitFor(() => {
      const calledCopy = mockFetch.mock.calls.some(([u]) => String(u).includes("/collections/newCol/items/copy"));
      expect(calledCopy).toBe(true);
    });
    expect(onCreated).toHaveBeenCalled();
  });

  it("does not pretend success when the copy fails, and retries without re-creating the collection", async () => {
    const onCreated = vi.fn();
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/portfolio/gallery") return Promise.resolve({ ok: true, json: async () => ({ collections, items: photos }) } as Response);
      if (url === "/api/portfolio/gallery/collections" && init?.method === "POST")
        return Promise.resolve({ ok: true, json: async () => ({ id: "newCol", name: "X", slug: "x" }) } as Response);
      if (url.includes("/items/copy")) return Promise.resolve({ ok: false, status: 500 } as Response);
      return Promise.resolve({ ok: true, json: async () => ({ items: photos, nextCursor: null }) } as Response);
    });
    renderWithProviders(<CreateCollectionDialog open onOpenChange={vi.fn()} onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText(/collection title/i), { target: { value: "My collection" } });
    fireEvent.click(screen.getByRole("button", { name: /select existing photos/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Existing$/ }));
    fireEvent.click(await screen.findByRole("option", { name: /src/i }));
    fireEvent.click(screen.getByRole("button", { name: /add 1 photo/i }));
    await waitFor(() => expect(document.querySelector('img[src*="s.jpg"]')).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /create/i }));
    // copy attempted but failed -> NOT reported as success
    await waitFor(() => expect(mockFetch.mock.calls.some(([u]) => String(u).includes("/items/copy"))).toBe(true));
    expect(onCreated).not.toHaveBeenCalled();

    // retry: clicking Create again retries the copy but does NOT create a 2nd collection
    fireEvent.click(screen.getByRole("button", { name: /create/i }));
    await waitFor(() =>
      expect(mockFetch.mock.calls.filter(([u]) => String(u).includes("/items/copy")).length).toBeGreaterThanOrEqual(2)
    );
    const createPosts = mockFetch.mock.calls.filter(
      ([u, i]) => u === "/api/portfolio/gallery/collections" && (i as RequestInit)?.method === "POST"
    ).length;
    expect(createPosts).toBe(1);
  });
});

describe("CreateCollectionDialog upload errors", () => {
  it("reports a per-file error for an unsupported type without touching the network", async () => {
    renderWithProviders(<CreateCollectionDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(["d"], "clip.gif", { type: "image/gif" })] } });

    expect(await screen.findByText(/clip\.gif/i)).toBeTruthy();
    expect(screen.getByText(/isn't a supported format/i)).toBeTruthy();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("reports per-file errors for a mixed batch without collapsing to one message", async () => {
    vi.mocked(uploadImage).mockImplementation(async (file: File) => {
      if (file.name === "big.png") throw new UploadError({ code: "file_too_large", actualBytes: 20 * 1024 * 1024, maxBytes: 15 * 1024 * 1024 });
      return { assetId: `a-${file.name}`, url: `https://x/${file.name}`, width: 900, height: 600, format: "jpeg", sizeBytes: 20000 };
    });
    renderWithProviders(<CreateCollectionDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(["d"], "good.jpg", { type: "image/jpeg" }),
          new File(["d"], "big.png", { type: "image/png" }),
        ],
      },
    });

    const line = await screen.findByText(/big\.png/i);
    expect(line.closest("li")?.textContent).toMatch(/20\.0 MB/);
    // The successful upload still lands in the preview grid.
    await waitFor(() => expect(document.querySelector('img[src*="good.jpg"]')).toBeTruthy());
  });

  it("shows the server's specific reason when creating the collection fails validation, instead of the generic errCreate copy", async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/portfolio/gallery") return Promise.resolve({ ok: true, json: async () => ({ collections, items: photos }) } as Response);
      if (url === "/api/portfolio/gallery/collections" && init?.method === "POST")
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: "file_too_large",
            detail: { code: "file_too_large", actualBytes: 20 * 1024 * 1024, maxBytes: 15 * 1024 * 1024 },
          }),
        } as Response);
      return Promise.resolve({ ok: true, json: async () => ({ items: photos, nextCursor: null }) } as Response);
    });
    renderWithProviders(<CreateCollectionDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/collection title/i), { target: { value: "My collection" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/20\.0 MB/);
    expect(alert.textContent).not.toMatch(/Could not create the collection/i);
  });
});
