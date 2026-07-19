import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { CreateCollectionDialog } from "./CreateCollectionDialog";
import { __clearPickerDataCache } from "./usePickerData";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const collections = [{ id: "c0", name: "Existing", coverUrl: "https://x/c.jpg", coverPublicId: "pid-c", itemCount: 1 }];
const photos = [{ id: "src1", publicId: "pid-src1", thumbUrl: "https://x/s.jpg", caption: "Src" }];

beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
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
