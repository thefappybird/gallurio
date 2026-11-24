import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import type { DiscoverCard } from "@/lib/db/queries/discover";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/discover",
}));

import { DiscoverGrid } from "./discover-grid";

const card = (slug: string, name: string): DiscoverCard => ({
  slug,
  name,
  category: "photographer",
  country: "PH",
  pitch: "",
  cover: { url: `https://img.test/${slug}.jpg`, width: 400, height: 500 },
  brand: { bg: "#1f3a34", fg: "#f1efe6", accent: "#e0b873", headingFont: "fraunces" },
});

const base = {
  initialItems: [card("a", "Alpha Studio"), card("b", "Beta Films")],
  initialCursor: null,
  initialCategory: null,
  initialQuery: "",
  initialDetail: null,
};

beforeEach(() => {
  replace.mockReset();
});

describe("DiscoverGrid", () => {
  it("opens the portfolio dialog from a tile click and mirrors it in the URL as ?p=", async () => {
    const detail = { ...card("a", "Alpha Studio"), images: [] };
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => detail }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      renderWithProviders(<DiscoverGrid {...base} />);
      fireEvent.click(screen.getByRole("link", { name: /Alpha Studio/ }));

      expect(await screen.findByRole("heading", { name: "Alpha Studio" })).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/api/public/discover/a");
      expect(window.location.search).toBe("?p=a");

      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(window.location.search).toBe("");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("loads the next page from the API without empty params, appends it, then shows the end note", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ items: [card("c", "Gamma Events")], nextCursor: null }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      renderWithProviders(<DiscoverGrid {...base} initialCursor="cur1" initialCategory="venue" />);
      expect(screen.queryByText("That is everything listed so far.")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Load more portfolios" }));

      expect(await screen.findByRole("link", { name: /Gamma Events/ })).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/api/public/discover?cursor=cur1&category=venue");
      expect(screen.getByText("That is everything listed so far.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Load more portfolios" })).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("debounces search by 250ms before updating the URL", () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(<DiscoverGrid {...base} />);
      fireEvent.change(screen.getByRole("searchbox", { name: "Search portfolios" }), { target: { value: "ale" } });

      act(() => void vi.advanceTimersByTime(249));
      expect(replace).not.toHaveBeenCalled();
      act(() => void vi.advanceTimersByTime(1));
      expect(replace).toHaveBeenCalledWith("/discover?q=ale", { scroll: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the empty state when nothing is listed and no-results (with Clear filters) when a filter matches nothing", () => {
    const { unmount } = renderWithProviders(<DiscoverGrid {...base} initialItems={[]} />);
    expect(screen.getByText("No portfolios are listed yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/sign-up");
    expect(screen.queryByText("No portfolios match")).toBeNull();
    unmount();

    renderWithProviders(<DiscoverGrid {...base} initialItems={[]} initialCategory="venue" />);
    expect(screen.getByText("No portfolios match")).toBeInTheDocument();
    expect(screen.queryByText("No portfolios are listed yet")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(replace).toHaveBeenCalledWith("/discover", { scroll: false });
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reflects a chip click in the URL and marks the chip pressed", () => {
    renderWithProviders(<DiscoverGrid {...base} />);
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Photographer" }));

    expect(replace).toHaveBeenCalledWith("/discover?category=photographer", { scroll: false });
    expect(screen.getByRole("button", { name: "Photographer" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  });
});
