import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CollectionPicker } from "./CollectionPicker";
import { __clearPickerDataCache } from "./usePickerData";

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
