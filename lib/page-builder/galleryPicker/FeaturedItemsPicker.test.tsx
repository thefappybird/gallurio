import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FeaturedItemsPicker } from "./FeaturedItemsPicker";
import { __clearPickerDataCache } from "./usePickerData";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const sampleItems = [
  { id: "item1", thumbUrl: "https://res.cloudinary.com/x/1.jpg", caption: "Photo 1" },
  { id: "item2", thumbUrl: "https://res.cloudinary.com/x/2.jpg", caption: null },
  { id: "item3", thumbUrl: "https://res.cloudinary.com/x/3.jpg", caption: "Photo 3" },
  { id: "item4", thumbUrl: "https://res.cloudinary.com/x/4.jpg", caption: null },
];

function makePickerData(items = sampleItems) {
  return {
    ok: true,
    json: async () => ({ collections: [], items }),
  } as unknown as Response;
}

beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(makePickerData());
});

describe("FeaturedItemsPicker", () => {
  it("renders loading state initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<FeaturedItemsPicker value={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/loading photos/i)).toBeTruthy();
  });

  it("renders error state with retry on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("network"));
    render(<FeaturedItemsPicker value={[]} onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/could not load/i)).toBeTruthy());
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("renders photo thumbnails from API data", async () => {
    render(<FeaturedItemsPicker value={[]} onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Photo 1" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "Photo 3" })).toBeTruthy();
  });

  it("calls onChange when a photo is selected", async () => {
    const onChange = vi.fn();
    render(<FeaturedItemsPicker value={[]} onChange={onChange} />);
    await waitFor(() => screen.getByRole("button", { name: "Photo 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Photo 1" }));
    expect(onChange).toHaveBeenCalledWith([{ id: "item1" }]);
  });

  it("accepts { id } objects as value and shows selected strip", async () => {
    render(<FeaturedItemsPicker value={[{ id: "item1" }, { id: "item2" }]} onChange={vi.fn()} />);
    await waitFor(() => screen.getByText("Select up to 3 photos"));
    // Two items in the selected strip shows "2/3 ·" text.
    expect(screen.getByText(/2\/3/)).toBeTruthy();
  });

  it("caps selection at MAX_FEATURED (3) — 4th item is disabled", async () => {
    render(
      <FeaturedItemsPicker
        value={[{ id: "item1" }, { id: "item2" }, { id: "item3" }]}
        onChange={vi.fn()}
      />
    );
    await waitFor(() => screen.getByText("Select up to 3 photos"));
    // item4 has caption null so its aria-label is "Photo"
    // Find the buttons for the listbox items and check disabled ones.
    const listbox = screen.getByRole("listbox", { name: "Gallery photos" });
    const allBtns = listbox.querySelectorAll("button");
    const disabledBtns = Array.from(allBtns).filter((b) => b.disabled);
    expect(disabledBtns.length).toBeGreaterThan(0);
  });

  it("deselects when the remove button in the selected strip is clicked", async () => {
    const onChange = vi.fn();
    render(<FeaturedItemsPicker value={[{ id: "item1" }]} onChange={onChange} />);
    await waitFor(() => screen.getByText(/1\/3/));
    // The selected strip has a remove button with aria-label "Remove photo"
    const removeBtn = screen.getByRole("button", { name: /remove photo/i });
    fireEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("shows 'Select up to 3 photos' hint", async () => {
    render(<FeaturedItemsPicker value={[]} onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/select up to 3/i)).toBeTruthy());
  });

  it("renders an upload affordance for new photos", async () => {
    render(<FeaturedItemsPicker value={[]} onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/upload a photo/i)).toBeTruthy());
  });

  it("accepts plain string ids in value (legacy shape)", async () => {
    const onChange = vi.fn();
    render(<FeaturedItemsPicker value={["item1"]} onChange={onChange} />);
    await waitFor(() => screen.getByText("Select up to 3 photos"));
    expect(screen.getByText(/1\/3/)).toBeTruthy();
  });
});
