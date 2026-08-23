/**
 * Focused test for the portfolio public Home page's `generateMetadata`.
 * Only covers the canonical/openGraph URL source (must come from the
 * resolved DB `workspace.slug`, never the raw route param) — the full
 * SEO-string precedence is covered by lib/portfolio/seoDefaults.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { WorkspaceDoc } from "@/lib/db/models/Workspace";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string, vars?: Record<string, unknown>) => {
    const en: Record<string, string> = {
      homeDescriptionGeneric: "{name} — browse recent work and get in touch to book.",
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

import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { generateMetadata } from "./page";

const mockFind = vi.mocked(findPublishedWorkspaceBySlug);

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

describe("Home generateMetadata canonical URL", () => {
  it("builds canonical/openGraph.url from the resolved DB slug, not the raw (possibly mixed-case) route param", async () => {
    // The DB slug is always lowercase (Mongoose lowercase: true); the raw
    // route param can arrive mixed-case (e.g. /w/Luna-Studio still resolves
    // via findPublishedWorkspaceBySlug's own lowercasing).
    mockFind.mockResolvedValueOnce(makePublishedWorkspace({ slug: "luna-studio" }));

    const result = await generateMetadata({
      params: Promise.resolve({ orgSlug: "Luna-Studio" }),
    });

    expect((result.alternates as { canonical?: string })?.canonical).toBe(
      "http://localhost:3000/w/luna-studio"
    );
    expect(result.openGraph?.url).toBe("http://localhost:3000/w/luna-studio");
  });
});
