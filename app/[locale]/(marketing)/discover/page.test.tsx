import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import type { DiscoverCard, DiscoverDetail } from "@/lib/db/queries/discover";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg?: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : arg?.namespace;
    return (key: string) => `${namespace}:${key}`;
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/discover",
}));

const listDiscoverPortfolios = vi.fn();
const getDiscoverPortfolio = vi.fn();
vi.mock("@/lib/db/queries/discover", () => ({
  listDiscoverPortfolios: (...args: unknown[]) => listDiscoverPortfolios(...args),
  getDiscoverPortfolio: (...args: unknown[]) => getDiscoverPortfolio(...args),
}));

import DiscoverPage from "./page";

const card: DiscoverCard = {
  slug: "alpha",
  name: "Alpha Studio",
  category: "photographer",
  country: "PH",
  pitch: "",
  cover: { url: "https://img.test/alpha.jpg", width: 400, height: 500 },
  brand: { bg: "#1f3a34", fg: "#f1efe6", accent: "#e0b873", headingFont: "fraunces" },
};

const render = async (searchParams: Record<string, string>) =>
  renderWithProviders(
    await DiscoverPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve(searchParams) }),
  );

beforeEach(() => {
  listDiscoverPortfolios.mockReset().mockResolvedValue({ items: [card], nextCursor: null });
  getDiscoverPortfolio.mockReset();
});

describe("Discover page", () => {
  it("renders the grid and no dialog for an unknown ?p=", async () => {
    getDiscoverPortfolio.mockResolvedValue(null);
    const { container } = await render({ p: "unknown" });

    expect(getDiscoverPortfolio).toHaveBeenCalledWith("unknown");
    expect(screen.getByRole("link", { name: /Alpha Studio/ })).toBeInTheDocument();
    expect(container.querySelector("dialog[open]")).toBeNull();
  });

  it("opens the dialog for a known ?p=", async () => {
    const detail: DiscoverDetail = { ...card, images: [] };
    getDiscoverPortfolio.mockResolvedValue(detail);
    const { container } = await render({ p: "alpha" });

    expect(container.querySelector("dialog[open]")).not.toBeNull();
  });
});
