import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ExistingPhotosPicker } from "./ExistingPhotosPicker";
import { __clearPickerDataCache } from "./usePickerData";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const collections = Array.from({ length: 9 }, (_, i) => ({
  id: `c${i}`, name: `Collection ${i}`, coverUrl: `https://x/c${i}.jpg`, coverPublicId: `pid-c${i}`, itemCount: 2,
}));
const photos = [
  { id: "p1", publicId: "pid-1", thumbUrl: "https://x/1.jpg", caption: "One" },
  { id: "p2", publicId: "pid-2", thumbUrl: "https://x/2.jpg", caption: "Two" },
];
function routeFetch(url: string) {
  if (url === "/api/portfolio/gallery") {
    return Promise.resolve({ ok: true, json: async () => ({ collections, items: photos }) } as Response);
  }
  return Promise.resolve({ ok: true, json: async () => ({ items: photos, nextCursor: null }) } as Response);
}
beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockFetch.mockImplementation((u: string) => routeFetch(u));
});

describe("ExistingPhotosPicker", () => {
  it("pins 'All Photos' as the first collection cell", async () => {
    renderWithProviders(<ExistingPhotosPicker open onOpenChange={vi.fn()} onAdd={vi.fn()} />);
    const buttons = await screen.findAllByRole("button", { name: /collection \d|all photos/i });
    expect(buttons[0]).toHaveAccessibleName(/all photos/i);
  });

  it("client-paginates collections (8 per page incl. All Photos)", async () => {
    renderWithProviders(<ExistingPhotosPicker open onOpenChange={vi.fn()} onAdd={vi.fn()} />);
    await screen.findByRole("button", { name: /all photos/i });
    expect(screen.queryByRole("button", { name: /^Collection 7$/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(await screen.findByRole("button", { name: /^Collection 7$/ })).toBeTruthy();
  });

  it("opens a collection and multi-selects, then calls onAdd and closes", async () => {
    const onAdd = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(<ExistingPhotosPicker open onOpenChange={onOpenChange} onAdd={onAdd} />);
    fireEvent.click(await screen.findByRole("button", { name: /^Collection 0$/ }));
    fireEvent.click(await screen.findByRole("option", { name: /one/i }));
    fireEvent.click(screen.getByRole("button", { name: /add 1 photo/i }));
    expect(onAdd).toHaveBeenCalledWith([expect.objectContaining({ id: "p1", publicId: "pid-1" })]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables photos already in the target collection", async () => {
    renderWithProviders(<ExistingPhotosPicker open onOpenChange={vi.fn()} onAdd={vi.fn()} excludePublicIds={["pid-1"]} />);
    fireEvent.click(await screen.findByRole("button", { name: /^Collection 0$/ }));
    const opt = await screen.findByRole("option", { name: /already added/i });
    expect(opt.querySelector("button")).toBeDisabled();
  });

  it("shows error + retry when the photo feed fails", async () => {
    mockFetch.mockImplementation((u: string) =>
      u === "/api/portfolio/gallery" ? routeFetch(u) : Promise.resolve({ ok: false, status: 500 } as Response)
    );
    renderWithProviders(<ExistingPhotosPicker open onOpenChange={vi.fn()} onAdd={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /^Collection 0$/ }));
    await waitFor(() => expect(screen.getByText(/could not load photos/i)).toBeTruthy());
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });
});
