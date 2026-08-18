import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
      kind: "blog",
      slug: "older-post",
      title: "Older post",
      description: "An older post.",
      publishedAt: "2026-08-01",
      body: "",
    },
    {
      kind: "blog",
      slug: "newer-post",
      title: "Newer post",
      description: "A newer post.",
      publishedAt: "2026-08-18",
      body: "",
    },
  ]),
}));

import BlogIndexPage, { generateMetadata } from "./page";

describe("Blog index page", () => {
  it("lists posts newest first with title, description, and a formatted <time>", async () => {
    const page = await BlogIndexPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Newer post", "Older post"]);
    expect(links[0]).toHaveAttribute("href", "/blog/newer-post");

    expect(screen.getByText("A newer post.")).toBeInTheDocument();

    const times = document.querySelectorAll("time");
    expect(times[0]).toHaveAttribute("datetime", "2026-08-18");
    expect(times[0].textContent).toContain("2026");
  });

  it("publishes the blog index title and description", async () => {
    await generateMetadata({ params: Promise.resolve({ locale: "en" }) });

    expect(vi.mocked(await import("next-intl/server")).getTranslations).toHaveBeenCalledWith({
      locale: "en",
      namespace: "marketing.blog.metadata",
    });
  });
});
