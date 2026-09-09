import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CollectionPicker } from "./CollectionPicker";
import { __clearPickerDataCache } from "./usePickerData";

vi.mock("@/lib/storage/uploadImage.client", () => ({ uploadImage: vi.fn() }));
import { uploadImage } from "@/lib/storage/uploadImage.client";
import { UploadError } from "@/lib/uploads/uploadError";

// Mock fetch globally.
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import type { PickerCollection } from "./types";

function makePickerData(collections: PickerCollection[] = [], items: unknown[] = []) {
  return {
    ok: true,
    json: async () => ({ collections, items }),
  } as unknown as Response;
}

beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  vi.mocked(uploadImage).mockReset();
  // Default: empty workspace.
  mockFetch.mockResolvedValue(makePickerData());
});

describe("CollectionPicker", () => {
  it("renders loading state initially", () => {
    // Keep fetch pending.
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<CollectionPicker value="" onChange={vi.fn()} />);
    expect(screen.getByText(/loading collections/i)).toBeTruthy();
  });

  it("renders error state with retry on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));
    render(<CollectionPicker value="" onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/could not load/i)).toBeTruthy());
    expect(screen.getByText(/retry/i)).toBeTruthy();
  });

  it("announces the fetch-failure message via role=alert", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));
    render(<CollectionPicker value="" onChange={vi.fn()} />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not load/i);
  });

  it("renders empty state when no collections", async () => {
    render(<CollectionPicker value="" onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/no collections yet/i)).toBeTruthy());
  });

  it("renders collection cards from API data", async () => {
    mockFetch.mockResolvedValue(
      makePickerData([{ id: "col1", name: "Wedding 2024", coverUrl: null, coverPublicId: "", itemCount: 5 }])
    );
    render(<CollectionPicker value="" onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Wedding 2024")).toBeTruthy());
    expect(screen.getByText("5 photos")).toBeTruthy();
  });

  it("calls onChange when a collection card is clicked", async () => {
    const onChange = vi.fn();
    mockFetch.mockResolvedValue(
      makePickerData([{ id: "col1", name: "My Collection", coverUrl: null, coverPublicId: "", itemCount: 2 }])
    );
    render(<CollectionPicker value="" onChange={onChange} />);
    await waitFor(() => screen.getByText("My Collection"));
    fireEvent.click(screen.getByRole("button", { name: /my collection/i }));
    expect(onChange).toHaveBeenCalledWith("col1");
  });

  it("deselects when the same collection is clicked while selected", async () => {
    const onChange = vi.fn();
    mockFetch.mockResolvedValue(
      makePickerData([{ id: "col1", name: "My Collection", coverUrl: null, coverPublicId: "", itemCount: 2 }])
    );
    render(<CollectionPicker value="col1" onChange={onChange} />);
    await waitFor(() => screen.getByText("My Collection"));
    fireEvent.click(screen.getByRole("button", { name: /my collection/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("shows the 'Create new collection' button", async () => {
    render(<CollectionPicker value="" onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/create new collection/i)).toBeTruthy());
  });

  it("(c) empty state renders inside a min-height centered container", async () => {
    render(<CollectionPicker value="" onChange={vi.fn()} />);
    const emptyMsg = await screen.findByText(/no collections yet/i);
    const wrapper = emptyMsg.closest("div");
    expect(wrapper?.className).toMatch(/min-h/);
    expect(wrapper?.className).toMatch(/items-center/);
    expect(wrapper?.className).toMatch(/justify-center/);
  });

  it("opens the create form when 'Create new collection' is clicked", async () => {
    render(<CollectionPicker value="" onChange={vi.fn()} />);
    await waitFor(() => screen.getByText(/create new collection/i));
    fireEvent.click(screen.getByText(/create new collection/i));
    expect(screen.getByLabelText(/collection title/i)).toBeTruthy();
  });

  it("create button is disabled when name is empty", async () => {
    render(<CollectionPicker value="" onChange={vi.fn()} />);
    await waitFor(() => screen.getByText(/create new collection/i));
    fireEvent.click(screen.getByText(/create new collection/i));
    const createBtn = screen.getByRole("button", { name: /create collection/i });
    expect(createBtn).toBeDisabled();
  });
});

describe("CollectionPicker upload errors", () => {
  async function openCreateForm() {
    render(<CollectionPicker value="" onChange={vi.fn()} />);
    await waitFor(() => screen.getByText(/create new collection/i));
    fireEvent.click(screen.getByText(/create new collection/i));
  }

  it("reports a per-file error for an unsupported type without touching the network", async () => {
    await openCreateForm();
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
    await openCreateForm();
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
    await waitFor(() => expect(document.querySelector('img[src*="good.jpg"]')).toBeTruthy());
  });

  it("shows the server's specific reason when creating the collection fails validation", async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/portfolio/gallery/collections" && init?.method === "POST")
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: "dimension_too_small",
            detail: { code: "dimension_too_small", actualWidth: 300, actualHeight: 300, minShortSide: 600 },
          }),
        } as Response);
      return Promise.resolve(makePickerData());
    });
    await openCreateForm();
    fireEvent.change(screen.getByLabelText(/collection title/i), { target: { value: "My collection" } });
    fireEvent.click(screen.getByRole("button", { name: /^create collection$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/300/);
    expect(alert.textContent).not.toMatch(/Could not create the collection/i);
  });
});
