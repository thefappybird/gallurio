import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SingleImageControl, MultiImageControl } from "./MediaField";
import { __clearPickerDataCache } from "./usePickerData";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const items = [
  { id: "a", publicId: "pid-a", thumbUrl: "https://x/a.jpg", caption: "A" },
  { id: "b", publicId: "pid-b", thumbUrl: "https://x/b.jpg", caption: "B" },
];

beforeEach(() => {
  __clearPickerDataCache();
  mockFetch.mockReset();
  mockFetch.mockImplementation((u: string) =>
    u === "/api/portfolio/gallery"
      ? Promise.resolve({ ok: true, json: async () => ({ collections: [], items }) } as Response)
      : Promise.resolve({ ok: true, json: async () => ({ items, nextCursor: null }) } as Response)
  );
});

describe("SingleImageControl", () => {
  it("shows 'Choose photo' when empty and opens the picker", async () => {
    render(<SingleImageControl value="" onChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /choose photo/i });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("button", { name: /all photos/i })).toBeTruthy());
  });

  it("renders the current thumbnail and clears to empty", async () => {
    const onChange = vi.fn();
    render(<SingleImageControl value="pid-a" onChange={onChange} />);
    await waitFor(() => screen.getByRole("button", { name: /clear/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("MultiImageControl", () => {
  it("shows the count and opens the picker", async () => {
    render(<MultiImageControl value={[{ id: "a", publicId: "pid-a" }]} onChange={vi.fn()} />);
    expect(screen.getByText(/1 photo/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /choose photos/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /all photos/i })).toBeTruthy());
  });

  it("round-trips an ordered array value", () => {
    render(<MultiImageControl value={[{ id: "a", publicId: "pid-a" }, { id: "b", publicId: "pid-b" }]} onChange={vi.fn()} />);
    expect(screen.getByText(/2 photos/i)).toBeTruthy();
  });
});
