/**
 * Tests for the portfolio public home page.
 *
 * Strategy:
 * - Query helper tests live in lib/db/queries/publicPage.test.ts (canonical).
 * - Here we cover:
 *     1. generateMetadata — pure function, tested with mocked query.
 *     2. ComingSoonFallback integration — renders when data.home is null (via
 *        the component directly, which is the same code path the page uses).
 *     3. Brand-kit CSS variables — applied by the layout; verified via
 *        resolveBrandKit directly (pure function, no React needed).
 *
 * We do NOT import the page's default export here because Next.js async server
 * components that call notFound() are not testable in a happy-dom environment
 * without Next.js' full RSC runtime. The acceptance criteria for the 404 path
 * is covered by the query-helper tests (unpublished workspace → null) combined
 * with the page code calling notFound() when the helper returns null.
 */
import React from "react";
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Types } from "mongoose";

import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import { buildRenderWorkspace, runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { ContactDetailsBlock, contactDetailsDefaultProps } from "@/lib/page-builder/blocks/ContactDetailsBlock";
import { ComingSoonFallback } from "./_components/ComingSoonFallback";
import { generateMetadata } from "./page";
import type { WorkspaceDoc } from "@/lib/db/models/Workspace";

// ---------------------------------------------------------------------------
// Mock next-intl/server — page component calls getTranslations(); this avoids
// requiring a full Next.js request context in happy-dom unit tests.
// ---------------------------------------------------------------------------

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string, vars?: Record<string, unknown>) => {
    const en: Record<string, string> = {
      comingSoon: "Coming soon",
      poweredBy: "Powered by Gallurio",
      notFoundEyebrow: "Gallurio",
      notFoundTitle: "Portfolio not found",
      notFoundBody: "This portfolio doesn't exist or hasn't been published yet.",
      startingFrom: "Starting from {price}",
    };
    let s = en[key] ?? key;
    if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, String(vars[k]));
    return s;
  }),
}));

// ---------------------------------------------------------------------------
// Mock localeForCountry — used by page component
// ---------------------------------------------------------------------------

vi.mock("@/lib/i18n/localeForCountry", () => ({
  localeForCountry: vi.fn(() => "en"),
  resolvePublicChromeLocale: vi.fn(() => "en"),
}));

// ---------------------------------------------------------------------------
// Mock findPublishedWorkspaceBySlug so generateMetadata doesn't need Mongo
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/queries/publicPage", () => ({
  findPublishedWorkspaceBySlug: vi.fn(),
}));

import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";

const mockFind = vi.mocked(findPublishedWorkspaceBySlug);

// Lean return type from findPublishedWorkspaceBySlug (non-null variant)
type LeanWorkspace = NonNullable<Awaited<ReturnType<typeof findPublishedWorkspaceBySlug>>>;

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

function makePublishedWorkspace(overrides: Partial<WorkspaceDoc> = {}): LeanWorkspace {
  return {
    _id: new Types.ObjectId(),
    __v: 0,
    slug: "luna-studio",
    name: "Luna Studio",
    ownerUserId: "user_001",
    clerkOrgId: "org_001",
    businessType: "photographer",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    branding: {
      logoUrl: "https://res.cloudinary.com/demo/logo.png",
      logoCloudinaryPublicId: "demo/logo",
      primaryColor: "#1a1a2e",
      secondaryColor: "#e9e9e9",
      tagline: "Moments captured forever",
      description: "",
    },
    publicPage: {
      templateId: "minimal",
      data: { home: null, gallery: null },
      brandKit: {
        themePreset: "minimal",
        fontPair: "merriweather-only",
        primaryColor: "#1a1a2e",
        secondaryColor: "#e9e9e9",
        accentColor: "#2f5d56",
        backgroundColor: "#fafafa",
        foregroundColor: "#111111",
        radius: "sharp",
        buttonStyle: "solid",
      },
      publishedAt: new Date("2025-01-01T00:00:00Z"),
      lastPublishedAt: null,
      latestVersion: 0,
      seoTitle: "",
      seoDescription: "",
      inquiryRecipientEmail: "",
    },
    customDomain: null,
    plan: "free",
    paddleSubscriptionId: null,
    paddleCustomerId: null,
    paddleSubscriptionStatus: null,
    paddleCurrentPeriodEnd: null,
    trialEndsAt: null,
    onboardingCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as LeanWorkspace;
}

// ---------------------------------------------------------------------------
// generateMetadata tests
// ---------------------------------------------------------------------------

describe("generateMetadata", () => {
  it("returns empty object when workspace is not found", async () => {
    mockFind.mockResolvedValueOnce(null);

    const result = await generateMetadata({
      params: Promise.resolve({ orgSlug: "nonexistent" }),
    });

    expect(result).toEqual({});
  });

  it("uses seoTitle and seoDescription when set", async () => {
    const workspace = makePublishedWorkspace({
      publicPage: {
        templateId: "minimal",
        data: { home: null, gallery: null },
        brandKit: DEFAULT_BRAND_KIT,
        publishedAt: new Date(),
        lastPublishedAt: null,
        latestVersion: 0,
        seoTitle: "Luna Wedding Photography",
        seoDescription: "Award-winning wedding photographer in Manila",
        inquiryRecipientEmail: "",
      },
    } as Partial<WorkspaceDoc>);

    mockFind.mockResolvedValueOnce(workspace);

    const result = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    expect(result.title).toBe("Luna Wedding Photography");
    expect(result.description).toBe("Award-winning wedding photographer in Manila");
  });

  it("falls back to workspace.name when seoTitle is empty", async () => {
    const workspace = makePublishedWorkspace();
    mockFind.mockResolvedValueOnce(workspace);

    const result = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    expect(result.title).toBe("Luna Studio");
  });

  it("falls back to branding.tagline when seoDescription is empty", async () => {
    const workspace = makePublishedWorkspace();
    mockFind.mockResolvedValueOnce(workspace);

    const result = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    expect(result.description).toBe("Moments captured forever");
  });

  it("includes OG image from branding.logoUrl", async () => {
    const workspace = makePublishedWorkspace();
    mockFind.mockResolvedValueOnce(workspace);

    const meta = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    const og = meta.openGraph as { images?: { url: string }[] };
    expect(og?.images?.[0]?.url).toBe("https://res.cloudinary.com/demo/logo.png");
  });

  it("omits OG images when branding.logoUrl is null", async () => {
    const workspace = makePublishedWorkspace({
      branding: {
        logoUrl: null,
        logoCloudinaryPublicId: null,
        primaryColor: "#111111",
        secondaryColor: "#f5f5f5",
        tagline: "My tagline",
        description: "",
      },
    });
    mockFind.mockResolvedValueOnce(workspace);

    const meta = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    const og = meta.openGraph as { images?: unknown[] };
    expect(og?.images).toBeUndefined();
  });

  it("sets the canonical alternates URL to /w/<slug>", async () => {
    const workspace = makePublishedWorkspace({ slug: "luna-studio" });
    mockFind.mockResolvedValueOnce(workspace);

    const meta = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    expect((meta.alternates as { canonical?: string })?.canonical).toBe("/w/luna-studio");
  });
});

// ---------------------------------------------------------------------------
// Brand-kit CSS variable resolution (layout wrapper behavior)
// ---------------------------------------------------------------------------

describe("resolveBrandKit", () => {
  it("generates the expected CSS custom properties for a custom brand kit", () => {
    const customKit = {
      ...DEFAULT_BRAND_KIT,
      primaryColor: "#3a3a3a",
      backgroundColor: "#fefefe",
      foregroundColor: "#0d0d0d",
      radius: "rounded" as const,
    };

    const { cssVars, className } = resolveBrandKit(customKit);

    expect(cssVars["--pf-color-primary"]).toBe("#3a3a3a");
    expect(cssVars["--pf-color-bg"]).toBe("#fefefe");
    expect(cssVars["--pf-color-fg"]).toBe("#0d0d0d");
    expect(cssVars["--pf-radius"]).toBe("0.5rem");
    expect(className).toContain("pf-theme-minimal");
    expect(className).toContain("pf-button-solid");
  });

  it("generates sharp radius for the 'sharp' preset", () => {
    const { cssVars } = resolveBrandKit({ ...DEFAULT_BRAND_KIT, radius: "sharp" });
    expect(cssVars["--pf-radius"]).toBe("0");
  });

  it("generates subtle radius for the 'subtle' preset", () => {
    const { cssVars } = resolveBrandKit({ ...DEFAULT_BRAND_KIT, radius: "subtle" });
    expect(cssVars["--pf-radius"]).toBe("0.25rem");
  });
});

// ---------------------------------------------------------------------------
// ComingSoonFallback: renders when data.home is null
// ---------------------------------------------------------------------------

describe("Portfolio page — ComingSoonFallback integration", () => {
  it("renders the workspace name when data.home is null", () => {
    const workspace = makePublishedWorkspace();
    render(<ComingSoonFallback workspace={workspace} />);
    expect(screen.getByText("Luna Studio")).toBeInTheDocument();
  });

  it("renders the tagline from workspace branding", () => {
    const workspace = makePublishedWorkspace();
    render(<ComingSoonFallback workspace={workspace} />);
    expect(screen.getByText("Moments captured forever")).toBeInTheDocument();
  });

  it("renders the 'Coming soon' message", () => {
    const workspace = makePublishedWorkspace();
    render(<ComingSoonFallback workspace={workspace} />);
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("applies --pf-font-body CSS var to the main element (verifies brand-kit var usage)", () => {
    const workspace = makePublishedWorkspace();
    const { container } = render(<ComingSoonFallback workspace={workspace} />);
    const main = container.querySelector("main");
    const style = main?.getAttribute("style") ?? "";
    // happy-dom preserves font-family var() references — sufficient to verify
    // the component wires up --pf-* variables in its inline style.
    expect(style).toContain("--pf-font-body");
  });

  it("renders labels.comingSoon and labels.poweredBy when provided", () => {
    const workspace = makePublishedWorkspace();
    render(
      <ComingSoonFallback
        workspace={workspace}
        labels={{ comingSoon: "Maaga pa", poweredBy: "Pinapagana ng Gallurio" }}
      />
    );
    expect(screen.getByText("Maaga pa")).toBeInTheDocument();
    expect(screen.getByText("Pinapagana ng Gallurio")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Regression: finding #1 — contact must flow into render context
// ---------------------------------------------------------------------------

describe("buildRenderWorkspace — contact field regression", () => {
  it("copies contact onto the render workspace", () => {
    const doc = {
      _id: new Types.ObjectId(),
      name: "Studio",
      branding: { tagline: "t" },
      publicPage: { inquiryRecipientEmail: "" },
      contact: {
        email: "hello@studio.com",
        phone: "+63 900 000 0000",
        address: "Manila",
        socials: { instagram: "studio_ig" },
      },
    };
    const rw = buildRenderWorkspace(doc);
    expect(rw.contact?.email).toBe("hello@studio.com");
    expect(rw.contact?.socials?.instagram).toBe("studio_ig");
  });

  it("sets contact to null when workspace.contact is absent", () => {
    const doc = { _id: new Types.ObjectId(), name: "Studio" };
    const rw = buildRenderWorkspace(doc);
    expect(rw.contact).toBeNull();
  });

  it("ContactDetailsBlock renders contact rows from the built render context", () => {
    const doc = {
      _id: new Types.ObjectId(),
      name: "Studio",
      contact: {
        email: "hello@studio.com",
        phone: "+63 900 000 0000",
        address: "Manila",
        socials: { instagram: "studio_ig" },
      },
    };
    const rw = buildRenderWorkspace(doc);
    const { getByText } = runWithRenderWorkspace(rw, () =>
      render(React.createElement(ContactDetailsBlock, contactDetailsDefaultProps))
    );
    expect(getByText("hello@studio.com")).toBeInTheDocument();
  });
});
