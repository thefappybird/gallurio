import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SingleImagePicker } from "./SingleImagePicker";
import { __clearPickerDataCache } from "./usePickerData";
import type { PickerItem } from "./types";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeData(items: PickerItem[] = []) {
  return { ok: true, json: async () => ({ collections: [], items }) } as unknown as Response;
}

beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(makeData());
});

describe("SingleImagePicker", () => {
  it("renders the loading state initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<SingleImagePicker value="" onChange={vi.fn()} />);
    expect(screen.getByText(/loading photos/i)).toBeTruthy();
  });

  it("renders an error state on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("network"));
    render(<SingleImagePicker value="" onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/could not load photos/i)).toBeTruthy());
  });

  it("renders the empty state when the workspace has no photos", async () => {
    render(<SingleImagePicker value="" onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/no photos yet/i)).toBeTruthy());
  });

  it("stores the photo's publicId (not an id) when picked", async () => {
    const onChange = vi.fn();
    mockFetch.mockResolvedValue(
      makeData([{ id: "i1", publicId: "gallurio/ws/p1", thumbUrl: "http://x/p1.jpg", caption: "Sunset", altText: null }])
    );
    render(<SingleImagePicker value="" onChange={onChange} />);
    await waitFor(() => screen.getByRole("button", { name: /sunset/i }));
    fireEvent.click(screen.getByRole("button", { name: /sunset/i }));
    expect(onChange).toHaveBeenCalledWith("gallurio/ws/p1");
  });

  it("clears the selection", async () => {
    const onChange = vi.fn();
    mockFetch.mockResolvedValue(
      makeData([{ id: "i1", publicId: "p1", thumbUrl: "http://x/p1.jpg", caption: null, altText: null }])
    );
    render(<SingleImagePicker value="p1" onChange={onChange} />);
    await waitFor(() => screen.getByRole("button", { name: /clear image/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear image/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
