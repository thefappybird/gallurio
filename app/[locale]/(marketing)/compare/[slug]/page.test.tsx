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
    kind: "compare",
    slug: "gallurio-vs-honeybook",
    title: "Gallurio vs HoneyBook",
    description: "HoneyBook comparison.",
    publishedAt: "2026-08-18",
    category: "crm",
    body: "## The short version\n\nBody text.",
    faq: [{ question: "Is it cheaper?", answer: "Yes." }],
    bestFor: "Simple booking operations",
    notFor: "Contract automation",
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

import ComparePage, { generateMetadata, generateStaticParams } from "./page";
import { getEntry } from "@/lib/content/entries";
import { renderContent } from "@/lib/content/render";

describe("Compare slug page", () => {
  beforeEach(() => {
    vi.mocked(getEntry).mockClear();
    vi.mocked(renderContent).mockClear();
    entries.value = [baseEntry()];
  });

  it("returns English slugs for static params", () => {
    expect(generateStaticParams()).toEqual([{ slug: "gallurio-vs-honeybook" }]);
  });

  it("renders the entry title, description, and article body", async () => {
    const page = await ComparePage({
      params: Promise.resolve({ locale: "en", slug: "gallurio-vs-honeybook" }),
    });
    render(page);

    expect(screen.getByRole("heading", { name: "Gallurio vs HoneyBook" })).toBeInTheDocument();
    expect(screen.getByText("HoneyBook comparison.")).toBeInTheDocument();
    expect(screen.getByTestId("article-content")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Frequently asked questions" })).toBeInTheDocument();
    expect(screen.getByText("Yes.")).toBeInTheDocument();
    expect(screen.getByText("Gallurio Editorial")).toBeInTheDocument();
  });

  it("emits Article, Breadcrumb, and FAQ JSON-LD script tags", async () => {
    const page = await ComparePage({
      params: Promise.resolve({ locale: "en", slug: "gallurio-vs-honeybook" }),
    });
    const { container } = render(page);

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(3);
    expect(scripts[0].innerHTML).toContain('"@type":"Article"');
    expect(scripts[1].innerHTML).toContain('"@type":"BreadcrumbList"');
    expect(scripts[2].innerHTML).toContain('"@type":"FAQPage"');
  });

  it("omits the FAQ script tag when the entry has no FAQ", async () => {
    entries.value = [{ ...baseEntry(), faq: undefined }];
    const page = await ComparePage({
      params: Promise.resolve({ locale: "en", slug: "gallurio-vs-honeybook" }),
    });
    const { container } = render(page);

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(2);
  });

  it("calls notFound() for an unknown slug", async () => {
    await expect(
      ComparePage({ params: Promise.resolve({ locale: "en", slug: "nope" }) })
    ).rejects.toThrow("notFound");
  });

  it("returns empty metadata for an unknown slug", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en", slug: "nope" }) });
    expect(meta).toEqual({});
  });

  it("publishes the entry's title/description as metadata at /compare/<slug>", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: "en", slug: "gallurio-vs-honeybook" }),
    });
    expect(meta.title).toEqual({ absolute: "Gallurio vs HoneyBook" });
    expect((meta.alternates as { canonical?: string })?.canonical).toBe(
      "http://localhost:3000/compare/gallurio-vs-honeybook"
    );
    expect((meta.alternates as { languages?: Record<string, string> })?.languages).not.toHaveProperty("fil");
  });
});
