import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import type { DiscoverCard } from "@/lib/db/queries/discover";
import { DiscoverBanner } from "./discover-banner";

function card(n: number): DiscoverCard {
  return {
    slug: `studio-${n}`,
    name: `Studio ${n}`,
    category: null,
    country: null,
    pitch: "",
    cover: null,
    brand: { bg: "#111111", fg: "#ffffff", accent: "#cc8844", headingFont: "inter" },
  };
}

function mockFeed(count: number) {
  const items = Array.from({ length: count }, (_, i) => card(i));
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items, nextCursor: null }) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DiscoverBanner", () => {
  it("renders nothing when fewer than 8 portfolios are listed", async () => {
    const fetchMock = mockFeed(7);
    const { container } = renderWithProviders(<DiscoverBanner />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {});

    expect(container.querySelector("section")).toBeNull();
  });

  it("renders the copy, a Discover link and three aria-hidden rows with 8 portfolios", async () => {
    mockFeed(8);
    const { container } = renderWithProviders(<DiscoverBanner />);

    expect(await screen.findByRole("heading", { level: 2, name: "Portfolios built on Gallurio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse portfolios/ })).toHaveAttribute("href", "/discover");

    const rows = container.querySelectorAll("[data-discover-row]");
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).toHaveAttribute("aria-hidden", "true");
  });

  it("toggles the pause button label between Pause and Resume scrolling", async () => {
    mockFeed(8);
    const { container } = renderWithProviders(<DiscoverBanner />);

    fireEvent.click(await screen.findByRole("button", { name: "Pause scrolling" }));

    expect(screen.getByRole("button", { name: "Resume scrolling" })).toBeInTheDocument();
    expect(container.querySelector(".dsc-banner")).toHaveAttribute("data-paused");

    fireEvent.click(screen.getByRole("button", { name: "Resume scrolling" }));
    expect(screen.getByRole("button", { name: "Pause scrolling" })).toBeInTheDocument();
  });
});
