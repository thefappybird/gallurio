import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

vi.mock("@/lib/content/entries", () => ({
  listEntries: vi.fn(() => [
    {
      kind: "compare",
      slug: "gallurio-vs-honeybook",
      title: "Gallurio vs HoneyBook",
      description: "HoneyBook comparison.",
      publishedAt: "2026-08-18",
      category: "crm",
      body: "",
    },
    {
      kind: "compare",
      slug: "gallurio-vs-dubsado",
      title: "Gallurio vs Dubsado",
      description: "Dubsado comparison.",
      publishedAt: "2026-08-10",
      category: "crm",
      body: "",
    },
    {
      kind: "compare",
      slug: "gallurio-vs-wix",
      title: "Gallurio vs Wix",
      description: "Wix comparison.",
      publishedAt: "2026-08-18",
      category: "website-builder",
      body: "",
    },
  ]),
}));

import CompareIndexPage, { generateMetadata } from "./page";

describe("Compare index page", () => {
  it("uses the shared editorial index and keeps comparisons newest first", async () => {
    const page = CompareIndexPage();
    render(page);

    const articleLinks = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/compare/"));
    expect(articleLinks.map((link) => link.textContent)).toEqual([
      "Gallurio vs HoneyBook",
      "Gallurio vs Wix",
      "Gallurio vs Dubsado",
    ]);
    expect(screen.getByText("Gallurio vs Wix")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Comparisons" })).toHaveAttribute("aria-current", "page");
  });

  it("shows introductory prose above the list", async () => {
    const page = CompareIndexPage();
    render(page);

    expect(screen.getByRole("heading", { name: "Gallurio compared with the tools you use now" })).toBeInTheDocument();
    expect(screen.getByText(/Direct comparisons of price/)).toBeInTheDocument();
  });

  it("publishes the compare index title and description", async () => {
    const metadata = generateMetadata();
    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/compare");
    expect(metadata.alternates?.languages).not.toHaveProperty("ar");
  });
});
