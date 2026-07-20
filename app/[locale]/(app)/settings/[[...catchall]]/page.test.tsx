import React from "react";
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace, User, PortfolioDraft } from "@/lib/db/models";
import type { PublicPageSettingsInput } from "@/lib/validators/workspace";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async () => (key: string) => key),
}));

const requireOrgMock = vi.fn();
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: () => requireOrgMock(),
}));

const getAuthUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUserMock(),
}));

vi.mock("@/lib/auth/authMethods", () => ({
  getAuthMethods: vi.fn(async () => ({ hasOAuth: false })),
}));

vi.mock("@/lib/utils/get-user-time-format", () => ({
  getUserTimeFormat: vi.fn(async () => "24h"),
}));

vi.mock("@/lib/lemonsqueezy/pricing", () => ({
  getProPricing: vi.fn(async () => ({ monthly: 0, yearly: 0 })),
}));

vi.mock("../_components/settings-user-profile", () => ({
  SettingsUserProfile: (props: unknown) => {
    capturedProps = props;
    return <div data-testid="settings-user-profile" />;
  },
}));

vi.mock("../public-page/_form", () => ({ PublicPageSettingsForm: () => null }));
vi.mock("../workspace/_business-form", () => ({ WorkspaceBusinessForm: () => null }));
vi.mock("../customize/_panel", () => ({ CustomizePanel: () => null }));
vi.mock("../dev-plan/_panel", () => ({ DevPlanPanel: () => null }));
vi.mock("../billing/_panel", () => ({ BillingPanel: () => null }));
vi.mock("../account/_panel", () => ({ AccountPanel: () => null }));

let capturedProps: {
  pages: { slug: string; body: { props: Record<string, unknown> } }[];
} | null = null;

import SettingsCatchallPage from "./page";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  vi.clearAllMocks();
  capturedProps = null;
});

async function seedWorkspace(publicPage: Record<string, unknown> = {}) {
  return Workspace.create({
    slug: "studio-aurora",
    name: "Studio Aurora",
    ownerUserId: "owner_1",
    businessType: "photographer",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    publicPage,
  });
}

async function seedOwnerUser(workspaceId: Types.ObjectId) {
  return User.create({
    workosUserId: "owner_1",
    email: "owner@test.com",
    name: "Owner",
    onboardingStep: "done",
    onboardingCompletedAt: new Date(),
    memberships: [{ workspaceId, role: "owner" }],
  });
}

function getPublicPageProps() {
  const entry = capturedProps?.pages.find((p) => p.slug === "public-page");
  return entry?.body.props as {
    defaults: PublicPageSettingsInput;
    targetDraftId: string;
    initialHasPendingChanges: boolean;
    publishedDefaults: PublicPageSettingsInput;
  };
}

describe("SettingsCatchallPage — public-page defaults read from workspace settingsDraft", () => {
  it("builds publicPageDefaults from settingsDraft (not the active portfolio draft) and reports pending changes", async () => {
    const ws = await seedWorkspace({
      seoTitle: "Stale live title",
      seoDescription: "Stale live description",
      inquiryRecipientEmail: "owner@test.com",
      settingsDraft: {
        seoTitle: "Fresh settings title",
        seoDescription: "Fresh settings description",
        siteIcon: { url: "https://cdn.example.com/icon.png", assetId: "icon_1" },
        seo: {
          keywords: ["wedding photographer", "editorial"],
          ogImageUrl: "",
          ogImageAssetId: "",
          galleryDescription: "",
          noindex: false,
        },
      },
    });
    await seedOwnerUser(ws._id);
    const draft = await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "My Draft",
      templateId: "",
      data: { home: null, gallery: null },
      seoTitle: "Draft title should not drive settings",
      seoDescription: "Draft description should not drive settings",
    });

    requireOrgMock.mockResolvedValue({
      role: "owner",
      userId: "owner_1",
      workspace: {
        _id: ws._id,
        slug: ws.slug,
        name: ws.name,
        businessType: "photographer",
        country: "PH",
        currency: "PHP",
        timezone: "Asia/Manila",
        plan: "free",
        // Mirror the real `Workspace.findById().lean()` shape requireOrg()
        // returns in production, so settingsDraft is present like it seeded.
        publicPage: ws.toObject().publicPage,
      },
    });
    getAuthUserMock.mockResolvedValue({
      name: "Owner",
      email: "owner@test.com",
      avatarUrl: null,
    });

    const page = await SettingsCatchallPage({
      params: Promise.resolve({ locale: "en", catchall: ["public-page"] }),
    });
    render(page);

    const props = getPublicPageProps();
    expect(props.defaults.seoTitle).toBe("Fresh settings title");
    expect(props.defaults.seoDescription).toBe("Fresh settings description");
    // inquiryRecipientEmail stays live-sourced, unaffected by the draft.
    expect(props.defaults.inquiryRecipientEmail).toBe("owner@test.com");
    expect(props.defaults.siteIconAssetId).toBe("icon_1");
    expect(props.defaults.seo.keywords).toEqual(["wedding photographer", "editorial"]);

    expect(props.targetDraftId).toBe(String(draft._id));
    expect(props.initialHasPendingChanges).toBe(true);
    expect(props.publishedDefaults.seoTitle).toBe("Stale live title");
  });

  it("falls back to the live header logo when settingsDraft.logo is untouched (empty default), not just when settingsDraft itself is absent", async () => {
    const ws = await seedWorkspace({
      header: { logoUrl: "https://cdn.example.com/live-logo.png", logoAssetId: "live_logo_1" },
      // settingsDraft exists (e.g. from an earlier unrelated SEO save) but its
      // logo sub-field is still at the schema default — must not be confused
      // with "the settings page explicitly cleared the logo".
      settingsDraft: {
        seoTitle: "Fresh settings title",
        logo: { url: "", assetId: "" },
      },
    });
    await seedOwnerUser(ws._id);

    requireOrgMock.mockResolvedValue({
      role: "owner",
      userId: "owner_1",
      workspace: {
        _id: ws._id,
        slug: ws.slug,
        name: ws.name,
        businessType: "photographer",
        country: "PH",
        currency: "PHP",
        timezone: "Asia/Manila",
        plan: "free",
        publicPage: ws.toObject().publicPage,
      },
    });
    getAuthUserMock.mockResolvedValue({
      name: "Owner",
      email: "owner@test.com",
      avatarUrl: null,
    });

    const page = await SettingsCatchallPage({
      params: Promise.resolve({ locale: "en", catchall: ["public-page"] }),
    });
    render(page);

    const props = getPublicPageProps();
    expect(props.defaults.logoUrl).toBe("https://cdn.example.com/live-logo.png");
    expect(props.defaults.logoAssetId).toBe("live_logo_1");
  });

  it("reports no pending changes when draft and published SEO fields are equal", async () => {
    const ws = await seedWorkspace({
      seoTitle: "Same title",
      seoDescription: "Same description",
      settingsDraft: {
        seoTitle: "Same title",
        seoDescription: "Same description",
      },
    });
    await seedOwnerUser(ws._id);
    await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "My Draft",
      templateId: "",
      data: { home: null, gallery: null },
      seoTitle: "Different draft title should not matter",
      seoDescription: "Different draft description should not matter",
    });

    requireOrgMock.mockResolvedValue({
      role: "owner",
      userId: "owner_1",
      workspace: {
        _id: ws._id,
        slug: ws.slug,
        name: ws.name,
        businessType: "photographer",
        country: "PH",
        currency: "PHP",
        timezone: "Asia/Manila",
        plan: "free",
        publicPage: ws.toObject().publicPage,
      },
    });
    getAuthUserMock.mockResolvedValue({
      name: "Owner",
      email: "owner@test.com",
      avatarUrl: null,
    });

    const page = await SettingsCatchallPage({
      params: Promise.resolve({ locale: "en", catchall: ["public-page"] }),
    });
    render(page);

    const props = getPublicPageProps();
    expect(props.initialHasPendingChanges).toBe(false);
  });

  it("reports pending changes true when the workspace has never been published (draft has content, live is empty)", async () => {
    const ws = await seedWorkspace({
      settingsDraft: {
        seoTitle: "Never published yet",
      },
    });
    await seedOwnerUser(ws._id);
    await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "My Draft",
      templateId: "",
      data: { home: null, gallery: null },
      seoTitle: "Draft title should not drive settings pending state",
    });

    requireOrgMock.mockResolvedValue({
      role: "owner",
      userId: "owner_1",
      workspace: {
        _id: ws._id,
        slug: ws.slug,
        name: ws.name,
        businessType: "photographer",
        country: "PH",
        currency: "PHP",
        timezone: "Asia/Manila",
        plan: "free",
        publicPage: ws.toObject().publicPage,
      },
    });
    getAuthUserMock.mockResolvedValue({
      name: "Owner",
      email: "owner@test.com",
      avatarUrl: null,
    });

    const page = await SettingsCatchallPage({
      params: Promise.resolve({ locale: "en", catchall: ["public-page"] }),
    });
    render(page);

    const props = getPublicPageProps();
    expect(props.initialHasPendingChanges).toBe(true);
  });

  it("reports pending changes when settings-draft keywords differ from published keywords", async () => {
    const ws = await seedWorkspace({
      seoTitle: "Same title",
      seo: { keywords: ["old"] },
      settingsDraft: {
        seoTitle: "Same title",
        seo: { keywords: ["new", "keywords"] },
      },
    });
    await seedOwnerUser(ws._id);
    await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "My Draft",
      templateId: "",
      data: { home: null, gallery: null },
      seoTitle: "Draft title should not drive settings keywords",
      seo: { keywords: ["draft-only"] },
    });

    requireOrgMock.mockResolvedValue({
      role: "owner",
      userId: "owner_1",
      workspace: {
        _id: ws._id,
        slug: ws.slug,
        name: ws.name,
        businessType: "photographer",
        country: "PH",
        currency: "PHP",
        timezone: "Asia/Manila",
        plan: "free",
        publicPage: ws.toObject().publicPage,
      },
    });
    getAuthUserMock.mockResolvedValue({
      name: "Owner",
      email: "owner@test.com",
      avatarUrl: null,
    });

    const page = await SettingsCatchallPage({
      params: Promise.resolve({ locale: "en", catchall: ["public-page"] }),
    });
    render(page);

    const props = getPublicPageProps();
    expect(props.initialHasPendingChanges).toBe(true);
    expect(props.defaults.seo.keywords).toEqual(["new", "keywords"]);
  });

  it("reports no pending changes when settings-draft keywords equal published keywords", async () => {
    const ws = await seedWorkspace({
      seoTitle: "Same title",
      seo: { keywords: ["shared"] },
      settingsDraft: {
        seoTitle: "Same title",
        seo: { keywords: ["shared"] },
      },
    });
    await seedOwnerUser(ws._id);
    await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "My Draft",
      templateId: "",
      data: { home: null, gallery: null },
      seoTitle: "Same title",
      seo: { keywords: ["draft-only"] },
    });

    requireOrgMock.mockResolvedValue({
      role: "owner",
      userId: "owner_1",
      workspace: {
        _id: ws._id,
        slug: ws.slug,
        name: ws.name,
        businessType: "photographer",
        country: "PH",
        currency: "PHP",
        timezone: "Asia/Manila",
        plan: "free",
        publicPage: ws.toObject().publicPage,
      },
    });
    getAuthUserMock.mockResolvedValue({
      name: "Owner",
      email: "owner@test.com",
      avatarUrl: null,
    });

    const page = await SettingsCatchallPage({
      params: Promise.resolve({ locale: "en", catchall: ["public-page"] }),
    });
    render(page);

    const props = getPublicPageProps();
    expect(props.initialHasPendingChanges).toBe(false);
    expect(props.defaults.seo.keywords).toEqual(["shared"]);
  });
});
