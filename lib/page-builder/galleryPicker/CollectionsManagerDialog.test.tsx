import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CollectionsManagerDialog } from "./CollectionsManagerDialog";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ collections: [], items: [] }),
  } as unknown as Response);
});

describe("CollectionsManagerDialog", () => {
  it("renders the manager with the create-collection form when open", async () => {
    render(<CollectionsManagerDialog open onOpenChange={vi.fn()} />);
    expect(await screen.findByText("Photos & collections")).toBeTruthy();
    expect(screen.getByText(/new collection/i)).toBeTruthy();
    // Explains where collections are used (the #6 ask).
    expect(screen.getByText(/use them in gallery blocks/i)).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    render(<CollectionsManagerDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Photos & collections")).toBeNull();
  });
});
