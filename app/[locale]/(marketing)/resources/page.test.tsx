import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/lib/content/entries", () => ({
  listEntries: vi.fn((kind: "blog" | "compare") =>
    kind === "blog"
      ? [{ kind: "blog", slug: "guide", title: "A practical guide", description: "Guide.", publishedAt: "2026-08-18", category: "operations", body: "" }]
      : [{ kind: "compare", slug: "gallurio-vs-example", title: "Gallurio vs Example", description: "Comparison.", publishedAt: "2026-08-18", category: "crm", body: "" }]
  ),
}));

import ResourcesPage, { generateMetadata } from "./page";

describe("Resources page", () => {
  it("presents guides and comparisons in one English editorial hub", async () => {
    render(await ResourcesPage());

    expect(screen.getByRole("heading", { name: "Practical resources for running an event business" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A practical guide" })).toHaveAttribute("href", "/blog/guide");
    expect(screen.getByRole("link", { name: "Gallurio vs Example" })).toHaveAttribute("href", "/compare/gallurio-vs-example");
    expect(screen.getByRole("link", { name: "Guides" })).toHaveAttribute("href", "/blog");
    expect(screen.getByRole("link", { name: "Comparisons" })).toHaveAttribute("href", "/compare");
  });

  it("uses one English canonical", async () => {
    const metadata = await generateMetadata();
    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/resources");
    expect(metadata.alternates?.languages).not.toHaveProperty("fil");
  });
});
