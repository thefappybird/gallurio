import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg?: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : arg?.namespace;
    return (key: string) => `${namespace}:${key}`;
  }),
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
  it("groups entries by category, newest first within each group", async () => {
    const page = await CompareIndexPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    const crmHeading = screen.getByText("marketing.compare:categories.crm");
    const crmList = crmHeading.nextElementSibling as HTMLElement;
    const links = within(crmList).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Gallurio vs HoneyBook", "Gallurio vs Dubsado"]);
    expect(links[0]).toHaveAttribute("href", "/compare/gallurio-vs-honeybook");

    expect(screen.getByText("marketing.compare:categories.website-builder")).toBeInTheDocument();
    expect(screen.getByText("Gallurio vs Wix")).toBeInTheDocument();
  });

  it("shows introductory prose above the list", async () => {
    const page = await CompareIndexPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    expect(screen.getByText("marketing.compare:index.intro1")).toBeInTheDocument();
    expect(screen.getByText("marketing.compare:index.intro2")).toBeInTheDocument();
  });

  it("publishes the compare index title and description", async () => {
    await generateMetadata({ params: Promise.resolve({ locale: "en" }) });

    expect(vi.mocked(await import("next-intl/server")).getTranslations).toHaveBeenCalledWith({
      locale: "en",
      namespace: "marketing.compare.metadata",
    });
  });
});
