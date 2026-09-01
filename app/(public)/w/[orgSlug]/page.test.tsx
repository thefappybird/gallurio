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
import { buildRenderWorkspace } from "@/lib/page-builder/serverContext";
import { ContactDetailsBlock, contactDetailsDefaultProps } from "@/lib/page-builder/blocks/ContactDetailsBlock";
import { ComingSoonFallback } from "./_components/ComingSoonFallback";
import PortfolioHomePage, { generateMetadata } from "./page";
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
      homeDescription: "{name} is a {businessType} — browse recent work and get in touch to book.",
      homeDescriptionGeneric: "{name} — browse recent work and get in touch to book.",
      "businessType.photographer": "Photographer",
      "businessType.venue": "Venue",
      "businessType.planner": "Event Planner",
      "businessType.stylist": "Stylist",
      "businessType.catering": "Catering",
      "businessType.entertainer": "Entertainer",
      "businessType.artists": "Artist",
      "businessType.other": "Business",
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

vi.mock("@/lib/portfolio/publicUrl", () => ({
  portfolioPublicUrl: (slug: string) => `http://localhost:3000/w/${slug}`,
}));

// Wraps the real implementation with vi.fn so existing `toHaveBeenCalledWith`
// spy assertions keep working, while also letting the new self-containment
// test below inspect real emitted @ids (a fully-stubbed [{}, {}, {}] mock
// cannot exercise that invariant).
vi.mock("@/lib/page-builder/seo/jsonLd", async () => {
  const actual = await vi.importActual<typeof import("@/lib/page-builder/seo/jsonLd")>(
    "@/lib/page-builder/seo/jsonLd"
  );
  return {
    ...actual,
    buildHomeJsonLd: vi.fn(actual.buildHomeJsonLd),
    safeJsonLd: vi.fn(actual.safeJsonLd),
  };
});

import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";
import { buildHomeJsonLd } from "@/lib/page-builder/seo/jsonLd";

// ---------------------------------------------------------------------------
// Reusable regression guard (mirrors lib/page-builder/seo/__tests__/jsonLd.test.ts):
// every `@id` referenced anywhere in this page's emitted JSON-LD <script> tags
// must be defined by one of those same scripts' top-level nodes.
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

const mockFind = vi.mocked(findPublishedWorkspaceBySlug);
const mockResolvePublicChromeLocale = vi.mocked(resolvePublicChromeLocale);
const mockBuildHomeJsonLd = vi.mocked(buildHomeJsonLd);

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
    businessType: "photographer",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
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

  it("marks the thin Coming Soon placeholder noindex while allowing crawlers to follow its links", async () => {
    const workspace = makePublishedWorkspace();
    mockFind.mockResolvedValueOnce(workspace);

    const result = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    expect(result.robots).toEqual({ index: false, follow: true });
  });

  it("leaves a populated Home page indexable", async () => {
    const workspace = makePublishedWorkspace({
      publicPage: {
        templateId: "minimal",
        data: { home: { root: {}, content: [{ type: "Heading", props: {} }] }, gallery: null },
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

    const result = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    expect(result.robots).toBeUndefined();
  });

  it("never emits an empty description — falls back to the businessType default when seoDescription is blank", async () => {
    const workspace = makePublishedWorkspace({ businessType: "photographer" });
    mockFind.mockResolvedValueOnce(workspace);

    const result = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    expect(result.description).toBe("Luna Studio is a Photographer — browse recent work and get in touch to book.");
    expect(result.description).not.toBe("");
    expect(result.openGraph?.description).toBe(result.description);
  });

  it("uses the generic default (no businessType phrase) when businessType is 'other'", async () => {
    const workspace = makePublishedWorkspace({ businessType: "other" });
    mockFind.mockResolvedValueOnce(workspace);

    const result = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    expect(result.description).toBe("Luna Studio — browse recent work and get in touch to book.");
  });

  it("sets the canonical alternates URL to /w/<slug>", async () => {
    const workspace = makePublishedWorkspace({ slug: "luna-studio" });
    mockFind.mockResolvedValueOnce(workspace);

    const meta = await generateMetadata({
      params: Promise.resolve({ orgSlug: "luna-studio" }),
    });

    expect((meta.alternates as { canonical?: string })?.canonical).toBe("http://localhost:3000/w/luna-studio");
  });

  it("builds canonical/openGraph.url from the resolved DB slug, not the raw (possibly mixed-case) route param", async () => {
    // The DB slug is always lowercase (Mongoose lowercase: true);
    // findPublishedWorkspaceBySlug lowercases its own lookup, so a mixed-case
    // route param still resolves — but every emitted URL must echo the DB
    // slug, not the param, or it disagrees with app/sitemap.ts (which always
    // lists the lowercase DB slug).
    const workspace = makePublishedWorkspace({ slug: "luna-studio" });
    mockFind.mockResolvedValueOnce(workspace);

    const meta = await generateMetadata({
      params: Promise.resolve({ orgSlug: "Luna-Studio" }),
    });

    expect((meta.alternates as { canonical?: string })?.canonical).toBe("http://localhost:3000/w/luna-studio");
    expect(meta.openGraph?.url).toBe("http://localhost:3000/w/luna-studio");
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

// ---------------------------------------------------------------------------
// PortfolioHomePage — JSON-LD keywords wiring
// (data.home is null in the fixture, so the page returns via the ComingSoon
// branch without needing the Puck Render/runWithRenderWorkspace machinery —
// buildHomeJsonLd is still called unconditionally before that branch.)
// ---------------------------------------------------------------------------

describe("PortfolioHomePage — JSON-LD keywords", () => {
  it("passes publicPage.seo.keywords through to buildHomeJsonLd", async () => {
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
        seo: { keywords: ["wedding", "manila"] },
      },
    } as Partial<WorkspaceDoc>);
    mockFind.mockResolvedValueOnce(workspace);

    await PortfolioHomePage({ params: Promise.resolve({ orgSlug: "luna-studio" }) });

    expect(mockBuildHomeJsonLd).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: ["wedding", "manila"] })
    );
  });

  it("omits keywords when publicPage.seo.keywords is unset", async () => {
    const workspace = makePublishedWorkspace();
    mockFind.mockResolvedValueOnce(workspace);

    await PortfolioHomePage({ params: Promise.resolve({ orgSlug: "luna-studio" }) });

    expect(mockBuildHomeJsonLd).toHaveBeenCalledWith(expect.objectContaining({ keywords: undefined }));
  });

  it("every @id referenced in the rendered JSON-LD resolves to a node defined on this same page", async () => {
    const workspace = makePublishedWorkspace({
      contact: { email: "hi@studio.com", socials: { instagram: "studio_ig" } },
    } as Partial<WorkspaceDoc>);
    mockFind.mockResolvedValueOnce(workspace);

    const element = await PortfolioHomePage({ params: Promise.resolve({ orgSlug: "luna-studio" }) });
    const nodes = collectJsonLdNodes(element);
    expect(nodes).toHaveLength(3);
    assertAllIdsResolveWithinPage(nodes);
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
    // The render path threads the workspace through Puck `metadata` (RSC-safe),
    // which is how ContactDetailsBlock reads it.
    const { getByText } = render(
      React.createElement(ContactDetailsBlock, {
        ...contactDetailsDefaultProps,
        puck: { metadata: { workspace: rw } },
      })
    );
    expect(getByText("hello@studio.com")).toBeInTheDocument();
  });
});
