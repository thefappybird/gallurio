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
import { generateMetadata } from "./page";
import type { WorkspaceDoc } from "@/lib/db/models/Workspace";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string, vars?: Record<string, unknown>) => {
    const en: Record<string, string> = {
      comingSoon: "Coming soon",
      poweredBy: "Powered by Gallurio",
      startingFrom: "Starting from {price}",
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
}));

vi.mock("@/lib/page-builder/seo/jsonLd", () => ({
  buildGalleryJsonLd: vi.fn(() => [{}, {}]),
  safeJsonLd: vi.fn(() => "{}"),
}));

import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";

const mockFind = vi.mocked(findPublishedWorkspaceBySlug);
const mockResolvePublicChromeLocale = vi.mocked(resolvePublicChromeLocale);
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

  it("uses seoDescription when set, else falls back to the name + Photography Portfolio", async () => {
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
    expect(fallback.description).toBe("Luna Studio — Photography Portfolio");
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

  it("falls back to header.logoUrl when siteIcon.url is empty", async () => {
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

    expect(result.icons).toEqual({
      icon: "https://cdn.example.com/logo.png",
      shortcut: "https://cdn.example.com/logo.png",
      apple: "https://cdn.example.com/logo.png",
    });
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
