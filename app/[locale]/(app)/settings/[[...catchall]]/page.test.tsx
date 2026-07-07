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

vi.mock("@/lib/paddle/pricing", () => ({
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
    keywordsPending: boolean;
  };
}

describe("SettingsCatchallPage — public-page defaults read from active draft", () => {
  it("builds publicPageDefaults from the active draft (not stale publicPage) and reports pending changes", async () => {
    const ws = await seedWorkspace({
      seoTitle: "Stale live title",
      seoDescription: "Stale live description",
      inquiryRecipientEmail: "owner@test.com",
    });
    await seedOwnerUser(ws._id);
    const draft = await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "My Draft",
      templateId: "",
      data: { home: null, gallery: null },
      seoTitle: "Fresh draft title",
      seoDescription: "Fresh draft description",
      siteIcon: { url: "https://cdn.example.com/icon.png", assetId: "icon_1" },
      seo: { ogImageUrl: "", ogImageAssetId: "", galleryDescription: "", noindex: false },
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
        publicPage: {
          seoTitle: "Stale live title",
          seoDescription: "Stale live description",
          inquiryRecipientEmail: "owner@test.com",
          publishedAt: null,
        },
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
    expect(props.defaults.seoTitle).toBe("Fresh draft title");
    expect(props.defaults.seoDescription).toBe("Fresh draft description");
    // inquiryRecipientEmail stays live-sourced, unaffected by the draft.
    expect(props.defaults.inquiryRecipientEmail).toBe("owner@test.com");
    expect(props.defaults.siteIconAssetId).toBe("icon_1");

    expect(props.targetDraftId).toBe(String(draft._id));
    expect(props.initialHasPendingChanges).toBe(true);
    expect(props.publishedDefaults.seoTitle).toBe("Stale live title");
  });

  it("reports no pending changes when draft and published SEO fields are equal", async () => {
    const ws = await seedWorkspace({
      seoTitle: "Same title",
      seoDescription: "Same description",
    });
    await seedOwnerUser(ws._id);
    await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "My Draft",
      templateId: "",
      data: { home: null, gallery: null },
      seoTitle: "Same title",
      seoDescription: "Same description",
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
        publicPage: {
          seoTitle: "Same title",
          seoDescription: "Same description",
          publishedAt: null,
        },
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
    const ws = await seedWorkspace({});
    await seedOwnerUser(ws._id);
    await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "My Draft",
      templateId: "",
      data: { home: null, gallery: null },
      seoTitle: "Never published yet",
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
        publicPage: {},
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

  it("computes keywordsPending true when draft and published keywords differ", async () => {
    const ws = await seedWorkspace({
      seoTitle: "Same title",
      seo: { keywords: ["old"] },
    });
    await seedOwnerUser(ws._id);
    await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "My Draft",
      templateId: "",
      data: { home: null, gallery: null },
      seoTitle: "Same title",
      seo: { keywords: ["new", "keywords"] },
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
        publicPage: {
          seoTitle: "Same title",
          seo: { keywords: ["old"] },
          publishedAt: null,
        },
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
    // Server-side hasPendingSeoChanges already folds keywords in, so this is
    // true too; keywordsPending is the independent signal the client needs.
    expect(props.initialHasPendingChanges).toBe(true);
    expect(props.keywordsPending).toBe(true);
  });

  it("computes keywordsPending false when draft and published keywords are equal", async () => {
    const ws = await seedWorkspace({
      seoTitle: "Same title",
      seo: { keywords: ["shared"] },
    });
    await seedOwnerUser(ws._id);
    await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "My Draft",
      templateId: "",
      data: { home: null, gallery: null },
      seoTitle: "Same title",
      seo: { keywords: ["shared"] },
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
        publicPage: {
          seoTitle: "Same title",
          seo: { keywords: ["shared"] },
          publishedAt: null,
        },
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
    expect(props.keywordsPending).toBe(false);
  });
});
