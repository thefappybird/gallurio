/**
 * Tests for the portfolio public gallery page.
 *
 * Mirrors the Home page test strategy: we test `generateMetadata` (a pure
 * function with mocked query) and the ComingSoonFallback integration. The
 * default export calls notFound() and <Render>, which require Next.js' full RSC
 * runtime — the 404 path is covered by the query-helper tests (unpublished →
 * null) combined with the page calling notFound() when the helper returns null.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Types } from "mongoose";

import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import { ComingSoonFallback } from "../_components/ComingSoonFallback";
import PortfolioGalleryPage, { generateMetadata } from "./page";
import type { WorkspaceDoc } from "@/lib/db/models/Workspace";
import { buildHomeJsonLd } from "@/lib/page-builder/seo/jsonLd";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string, vars?: Record<string, unknown>) => {
    const en: Record<string, string> = {
      comingSoon: "Coming soon",
      poweredBy: "Powered by Gallurio",
      startingFrom: "Starting from {price}",
      galleryDescription: "Browse {name}'s portfolio gallery — recent photos and highlights.",
    };
    let s = en[key] ?? key;
    if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, String(vars[k]));
    return s;
  }),
}));

vi.mock("@/lib/i18n/localeForCountry", () => ({
  localeForCountry: vi.fn(() => "en"),
  resolvePublicChromeLocale: vi.fn(() => "en"),
}));

vi.mock("@/lib/db/queries/publicPage", () => ({
  findPublishedWorkspaceBySlug: vi.fn(),
}));

vi.mock("@/lib/portfolio/publicUrl", () => ({
  portfolioPublicUrl: (slug: string) => `http://localhost:3000/w/${slug}`,
  portfolioGalleryUrl: (slug: string) => `http://localhost:3000/w/${slug}/gallery`,
}));

// Wraps the real implementation with vi.fn (rather than a fully-stubbed
// [{}, {}] mock) so the self-containment tests below can inspect real @ids.
vi.mock("@/lib/page-builder/seo/jsonLd", async () => {
  const actual = await vi.importActual<typeof import("@/lib/page-builder/seo/jsonLd")>(
    "@/lib/page-builder/seo/jsonLd"
  );
  return {
    ...actual,
    buildGalleryJsonLd: vi.fn(actual.buildGalleryJsonLd),
    safeJsonLd: vi.fn(actual.safeJsonLd),
  };
});

// The populated-branch test only needs normalizePublicPageData to return
// truthy/falsy — real Puck-config-driven block validation is exercised
// elsewhere (normalizePublicPageData's own tests).
vi.mock("@/lib/page-builder/normalizePublicPageData", () => ({
  normalizePublicPageData: vi.fn((raw: unknown) => (raw ? { root: {}, content: [] } : null)),
  hasRenderableBlocks: vi.fn((raw: unknown) => {
    const data = raw as { content?: unknown[] } | null | undefined;
    return Array.isArray(data?.content) && data.content.length > 0;
  }),
}));

vi.mock("@/lib/page-builder/seo/publishedImages.server", () => ({
  collectGalleryPublishedImages: vi.fn(async () => []),
}));

import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";

const mockFind = vi.mocked(findPublishedWorkspaceBySlug);
const mockResolvePublicChromeLocale = vi.mocked(resolvePublicChromeLocale);

// ---------------------------------------------------------------------------
// Reusable regression guard (mirrors lib/page-builder/seo/__tests__/jsonLd.test.ts
// and ../page.test.tsx): every `@id` referenced anywhere in this page's
// emitted JSON-LD <script> tags must be defined by one of those same
// scripts' top-level nodes.
// ---------------------------------------------------------------------------

function collectJsonLdNodes(node: React.ReactNode, into: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) {
    for (const n of node) collectJsonLdNodes(n, into);
    return into;
  }
  if (!node || typeof node !== "object" || !("type" in node)) return into;
  const el = node as React.ReactElement<Record<string, unknown>>;
  if (el.type === "script" && el.props?.type === "application/ld+json") {
    const html = (el.props.dangerouslySetInnerHTML as { __html?: string } | undefined)?.__html;
    if (typeof html === "string") into.push(JSON.parse(html));
    return into;
  }
  if (el.props?.children) collectJsonLdNodes(el.props.children as React.ReactNode, into);
  return into;
}

function collectAllIds(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectAllIds(v, into);
    return into;
  }
  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key === "@id" && typeof v === "string") into.add(v);
      else collectAllIds(v, into);
    }
  }
  return into;
}

function assertAllIdsResolveWithinPage(nodes: Record<string, unknown>[]) {
  const definedIds = new Set(nodes.map((n) => n["@id"] as string));
  const referencedIds = collectAllIds(nodes);
  for (const id of referencedIds) {
    expect(definedIds.has(id), `@id "${id}" is referenced but not defined among this page's rendered nodes`).toBe(
      true
    );
  }
}
type LeanWorkspace = NonNullable<Awaited<ReturnType<typeof findPublishedWorkspaceBySlug>>>;

function makePublishedWorkspace(overrides: Partial<WorkspaceDoc> = {}): LeanWorkspace {
  return {
    _id: new Types.ObjectId(),
    __v: 0,
    slug: "luna-studio",
    name: "Luna Studio",
    ownerUserId: "user_001",
    businessType: "photographer",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    publicPage: {
      templateId: "minimal",
      data: { home: null, gallery: null },
      brandKit: DEFAULT_BRAND_KIT,
      publishedAt: new Date("2025-01-01T00:00:00Z"),
      lastPublishedAt: null,
      latestVersion: 0,
      seoTitle: "",
      seoDescription: "",
      inquiryRecipientEmail: "",
    },
    plan: "free",
    lsSubscriptionId: null,
    lsCustomerId: null,
    lsSubscriptionStatus: null,
    lsCurrentPeriodEnd: null,
    trialEndsAt: null,
    onboardingCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as LeanWorkspace;
}

beforeEach(() => {
  mockFind.mockReset();
});

describe("gallery generateMetadata", () => {
  it("returns empty object when workspace is not found", async () => {
    mockFind.mockResolvedValueOnce(null);
    const result = await generateMetadata({ params: Promise.resolve({ orgSlug: "nope" }) });
    expect(result).toEqual({});
  });

  it("appends ' — Gallery' to the workspace name as the title", async () => {
    mockFind.mockResolvedValueOnce(makePublishedWorkspace());
    const result = await generateMetadata({ params: Promise.resolve({ orgSlug: "luna-studio" }) });
    expect(result.title).toBe("Luna Studio — Gallery");
  });

  it("marks the thin Coming Soon placeholder noindex while allowing crawlers to follow its links", async () => {
    mockFind.mockResolvedValueOnce(makePublishedWorkspace());

    const result = await generateMetadata({ params: Promise.resolve({ orgSlug: "luna-studio" }) });

    expect(result.robots).toEqual({ index: false, follow: true });
  });

  it("leaves a populated Gallery page indexable", async () => {
    mockFind.mockResolvedValueOnce(
      makePublishedWorkspace({
        publicPage: {
          templateId: "minimal",
          data: { home: null, gallery: { root: {}, content: [{ type: "Heading", props: {} }] } },
          brandKit: DEFAULT_BRAND_KIT,
          publishedAt: new Date(),
          lastPublishedAt: null,
          latestVersion: 0,
          seoTitle: "",
          seoDescription: "",
          inquiryRecipientEmail: "",
        },
      } as Partial<WorkspaceDoc>)
    );

    const result = await generateMetadata({ params: Promise.resolve({ orgSlug: "luna-studio" }) });

    expect(result.robots).toBeUndefined();
  });

  it("uses seoDescription when set, else falls back to the translated gallery default (never English-hardcoded/empty)", async () => {
    mockFind.mockResolvedValueOnce(
      makePublishedWorkspace({
        publicPage: {
          templateId: "minimal",
          data: { home: null, gallery: null },
          brandKit: DEFAULT_BRAND_KIT,
          publishedAt: new Date(),
          lastPublishedAt: null,
          latestVersion: 0,
          seoTitle: "",
          seoDescription: "Manila wedding gallery",
          inquiryRecipientEmail: "",
        },
      } as Partial<WorkspaceDoc>)
    );
    const withSeo = await generateMetadata({ params: Promise.resolve({ orgSlug: "luna-studio" }) });
    expect(withSeo.description).toBe("Manila wedding gallery");

    mockFind.mockResolvedValueOnce(makePublishedWorkspace());
    const fallback = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });
    expect(fallback.description).toBe("Browse Luna Studio's portfolio gallery — recent photos and highlights.");
    expect(fallback.description).not.toBe("");
  });

  it("Gallery's default description differs from what Home's default would be", async () => {
    mockFind.mockResolvedValueOnce(makePublishedWorkspace());
    const result = await generateMetadata({ params: Promise.resolve({ orgSlug: "luna-studio" }) });
    expect(result.description).not.toContain("browse recent work and get in touch to book");
  });

  it("sets the canonical alternates URL to /w/<slug>/gallery", async () => {
    mockFind.mockResolvedValueOnce(makePublishedWorkspace({ slug: "luna-studio" }));
    const meta = await generateMetadata({ params: Promise.resolve({ orgSlug: "luna-studio" }) });
    expect((meta.alternates as { canonical?: string })?.canonical).toBe("http://localhost:3000/w/luna-studio/gallery");
  });

  it("sets icons.icon from siteIcon.url when present", async () => {
    const workspace = makePublishedWorkspace({
      publicPage: {
        templateId: "minimal",
        data: { home: null, gallery: null },
        brandKit: DEFAULT_BRAND_KIT,
        publishedAt: new Date(),
        lastPublishedAt: null,
        latestVersion: 0,
        seoTitle: "",
        seoDescription: "",
        inquiryRecipientEmail: "",
        siteIcon: { url: "https://cdn.example.com/icon.png", assetId: "" },
      },
    } as Partial<WorkspaceDoc>);
    mockFind.mockResolvedValueOnce(workspace);

    const result = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    expect(result.icons).toEqual({
      icon: "https://cdn.example.com/icon.png",
      shortcut: "https://cdn.example.com/icon.png",
      apple: "https://cdn.example.com/icon.png",
    });
  });

  it("does not fall back to header.logoUrl when siteIcon.url is empty (header logo removed as a favicon source)", async () => {
    const workspace = makePublishedWorkspace({
      publicPage: {
        templateId: "minimal",
        data: { home: null, gallery: null },
        brandKit: DEFAULT_BRAND_KIT,
        publishedAt: new Date(),
        lastPublishedAt: null,
        latestVersion: 0,
        seoTitle: "",
        seoDescription: "",
        inquiryRecipientEmail: "",
        siteIcon: { url: "", assetId: "" },
        header: { logoUrl: "https://cdn.example.com/logo.png" },
      },
    } as Partial<WorkspaceDoc>);
    mockFind.mockResolvedValueOnce(workspace);

    const result = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    expect(result.icons).toBeUndefined();
  });

  it("omits icons when both siteIcon.url and header.logoUrl are empty", async () => {
    const workspace = makePublishedWorkspace();
    mockFind.mockResolvedValueOnce(workspace);

    const result = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    expect(result.icons).toBeUndefined();
  });

  it("sets openGraph.locale from the workspace's resolved public-page locale", async () => {
    const workspace = makePublishedWorkspace();
    mockFind.mockResolvedValueOnce(workspace);
    mockResolvePublicChromeLocale.mockReturnValueOnce("fil");

    const result = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    expect(result.openGraph?.locale).toBe("fil");
  });
});

describe("gallery page — ComingSoonFallback integration", () => {
  it("renders the workspace name (fallback path when data.gallery is null)", () => {
    const workspace = makePublishedWorkspace();
    render(<ComingSoonFallback workspace={workspace} />);
    expect(screen.getByText("Luna Studio")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PortfolioGalleryPage — JSON-LD self-containment (both ComingSoon and
// populated branches must emit business+website+gallery+breadcrumb).
// ---------------------------------------------------------------------------

describe("PortfolioGalleryPage — JSON-LD self-containment", () => {
  it("ComingSoon branch (data.gallery null) emits business, website, gallery, and breadcrumb — every @id resolves", async () => {
    const workspace = makePublishedWorkspace({
      contact: { email: "hi@studio.com", socials: { instagram: "studio_ig" } },
    } as Partial<WorkspaceDoc>);
    mockFind.mockResolvedValueOnce(workspace);

    const element = await PortfolioGalleryPage({ params: Promise.resolve({ orgSlug: "luna-studio" }) });
    const nodes = collectJsonLdNodes(element);
    expect(nodes.map((n) => n["@type"])).toEqual(
      expect.arrayContaining(["PhotographyBusiness", "WebSite", "ImageGallery", "BreadcrumbList"])
    );
    assertAllIdsResolveWithinPage(nodes);
  });

  it("populated branch (data.gallery set) emits business, website, gallery, and breadcrumb — every @id resolves", async () => {
    const workspace = makePublishedWorkspace({
      publicPage: {
        templateId: "minimal",
        data: { home: null, gallery: { content: [{ type: "Gallery", props: {} }] } },
        brandKit: DEFAULT_BRAND_KIT,
        publishedAt: new Date(),
        lastPublishedAt: null,
        latestVersion: 0,
        seoTitle: "",
        seoDescription: "",
        inquiryRecipientEmail: "",
      },
    } as Partial<WorkspaceDoc>);
    mockFind.mockResolvedValueOnce(workspace);

    const element = await PortfolioGalleryPage({ params: Promise.resolve({ orgSlug: "luna-studio" }) });
    const nodes = collectJsonLdNodes(element);
    expect(nodes.map((n) => n["@type"])).toEqual(
      expect.arrayContaining(["PhotographyBusiness", "WebSite", "ImageGallery", "BreadcrumbList"])
    );
    assertAllIdsResolveWithinPage(nodes);
  });

  it("emits business/website nodes deep-equal to what buildHomeJsonLd emits for the same workspace (same entity, no drift)", async () => {
    const workspace = makePublishedWorkspace({
      contact: { email: "hi@studio.com", phone: "+63 900", address: "Manila", socials: { instagram: "studio_ig" } },
      publicPage: {
        templateId: "minimal",
        data: { home: null, gallery: null },
        brandKit: DEFAULT_BRAND_KIT,
        publishedAt: new Date(),
        lastPublishedAt: null,
        latestVersion: 0,
        seoTitle: "",
        seoDescription: "Manila wedding photographer",
        inquiryRecipientEmail: "",
        seo: { ogImageUrl: "https://cdn/og.png", keywords: ["wedding", "manila"] },
      },
    } as Partial<WorkspaceDoc>);
    mockFind.mockResolvedValueOnce(workspace);

    const element = await PortfolioGalleryPage({ params: Promise.resolve({ orgSlug: "luna-studio" }) });
    const nodes = collectJsonLdNodes(element);
    const galleryBusiness = nodes.find((n) => typeof n["@id"] === "string" && (n["@id"] as string).endsWith("#business"));
    const galleryWebsite = nodes.find((n) => typeof n["@id"] === "string" && (n["@id"] as string).endsWith("#website"));

    const [homeBusiness, homeWebsite] = buildHomeJsonLd({
      name: workspace.name,
      slug: workspace.slug,
      businessType: workspace.businessType || undefined,
      description: workspace.publicPage?.seoDescription || undefined,
      image: (workspace.publicPage?.seo as { ogImageUrl?: string })?.ogImageUrl || undefined,
      email: workspace.contact?.email || undefined,
      phone: workspace.contact?.phone || undefined,
      address: workspace.contact?.address || undefined,
      sameAs: ["https://www.instagram.com/studio_ig"],
      keywords: (workspace.publicPage?.seo as { keywords?: string[] })?.keywords,
    });

    expect(galleryBusiness).toEqual(homeBusiness);
    expect(galleryWebsite).toEqual(homeWebsite);
  });
});
