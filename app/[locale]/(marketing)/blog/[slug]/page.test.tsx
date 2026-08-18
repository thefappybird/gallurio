import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg?: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : arg?.namespace;
    return (key: string) => `${namespace}:${key}`;
  }),
}));

function baseEntry(): Record<string, unknown> {
  return {
    kind: "blog",
    slug: "how-to-price-event-photography-packages",
    title: "How to price your event photography packages",
    description: "A working method for setting package prices.",
    publishedAt: "2026-08-18",
    body: "Most photographers price by looking at what the person down the road charges.",
  };
}

const entries = { value: [baseEntry()] as Array<Record<string, unknown>> };
vi.mock("@/lib/content/entries", () => ({
  listEntries: vi.fn(() => entries.value),
  getEntry: vi.fn((kind: string, slug: string) => entries.value.find((e) => e.slug === slug) ?? null),
}));

vi.mock("@/lib/content/render", () => ({
  renderContent: vi.fn(async (body: string) => <div data-testid="article-content">{body}</div>),
}));

import BlogPostPage, { generateMetadata, generateStaticParams } from "./page";
import { getEntry } from "@/lib/content/entries";

describe("Blog slug page", () => {
  beforeEach(() => {
    vi.mocked(getEntry).mockClear();
    entries.value = [baseEntry()];
  });

  it("returns English slugs for static params", () => {
    expect(generateStaticParams()).toEqual([
      { slug: "how-to-price-event-photography-packages" },
    ]);
  });

  it("renders the entry title, description, published date, and article body", async () => {
    const page = await BlogPostPage({
      params: Promise.resolve({ locale: "en", slug: "how-to-price-event-photography-packages" }),
    });
    render(page);

    expect(
      screen.getByRole("heading", { name: "How to price your event photography packages" })
    ).toBeInTheDocument();
    expect(screen.getByText("A working method for setting package prices.")).toBeInTheDocument();
    expect(screen.getByTestId("article-content")).toBeInTheDocument();

    const time = document.querySelector("time");
    expect(time).toHaveAttribute("datetime", "2026-08-18");
  });

  it("emits Article and Breadcrumb JSON-LD, with no FAQ script tag", async () => {
    const page = await BlogPostPage({
      params: Promise.resolve({ locale: "en", slug: "how-to-price-event-photography-packages" }),
    });
    const { container } = render(page);

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(2);
    expect(scripts[0].innerHTML).toContain('"@type":"Article"');
    expect(scripts[1].innerHTML).toContain('"@type":"BreadcrumbList"');
  });

  it("calls notFound() for an unknown slug", async () => {
    await expect(
      BlogPostPage({ params: Promise.resolve({ locale: "en", slug: "nope" }) })
    ).rejects.toThrow("notFound");
  });

  it("returns empty metadata for an unknown slug", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en", slug: "nope" }) });
    expect(meta).toEqual({});
  });

  it("publishes the entry's title/description as metadata at /blog/<slug>", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({
        locale: "en",
        slug: "how-to-price-event-photography-packages",
      }),
    });
    expect(meta.title).toEqual({ absolute: "How to price your event photography packages" });
    expect((meta.alternates as { canonical?: string })?.canonical).toBe(
      "http://localhost:3000/blog/how-to-price-event-photography-packages"
    );
  });
});
