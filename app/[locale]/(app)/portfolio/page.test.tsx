import React from "react";
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace, PortfolioDraft } from "@/lib/db/models";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async () => (key: string) => key),
}));

const requireOrgMock = vi.fn();
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: () => requireOrgMock(),
}));

vi.mock("@/lib/page-builder/seedPortfolio", () => ({
  seedDefaultPortfolio: vi.fn(async () => null),
}));

vi.mock("@/lib/page-builder/reconcile", () => ({
  reconcileGalleryImages: vi.fn(async (_ws: string, zone: unknown) => zone),
  reconcileFeaturedCollections: vi.fn(async (_ws: string, zone: unknown) => zone),
}));

vi.mock("@/lib/storage/portfolioAssetUrls", () => ({
  portfolioHeaderLogoUrl: vi.fn(() => ""),
}));

vi.mock("./_components/EditorShell", () => ({
  EditorShell: ({
    initialSeoDescription,
    initialSeoKeywords,
    initialInquiryRecipientEmail,
    hasBeenPublished,
  }: {
    initialSeoDescription: string;
    initialSeoKeywords: string[];
    initialInquiryRecipientEmail: string;
    hasBeenPublished: boolean;
  }) => (
    <div>
      <div data-testid="seo-description">{initialSeoDescription}</div>
      <div data-testid="seo-keywords">{JSON.stringify(initialSeoKeywords)}</div>
      <div data-testid="inquiry-recipient">{initialInquiryRecipientEmail}</div>
      <div data-testid="has-been-published">{String(hasBeenPublished)}</div>
    </div>
  ),
}));

import PageBuilderEntry from "./page";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  vi.clearAllMocks();
});

async function seedWorkspace() {
  return Workspace.create({
    slug: "studio-aurora",
    name: "Studio Aurora",
    ownerUserId: "owner_1",
    businessType: "photographer",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
  });
}

function mockRequireOrg(workspace: { _id: Types.ObjectId; slug: string; name: string; businessType?: string }, publicPage: Record<string, unknown>) {
  requireOrgMock.mockResolvedValue({
    role: "owner",
    workspace: {
      ...workspace,
      publicPage,
    },
  });
}

describe("PageBuilderEntry — SEO fields read from active draft", () => {
  it("reads initialSeoDescription/initialSeoKeywords from the active draft, not stale publicPage", async () => {
    const ws = await seedWorkspace();
    // Seed a draft with fresh SEO fields (this is what a real prior save wrote to).
    const draft = await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "My Draft",
      templateId: "",
      data: { home: null, gallery: null },
      seoDescription: "Fresh from draft",
      seo: { keywords: ["fresh", "keywords"] },
    });

    mockRequireOrg(
      { _id: ws._id, slug: ws.slug, name: ws.name, businessType: "photographer" },
      {
        // Stale live values — should NOT be what renders.
        seoDescription: "STALE live value",
        seo: { keywords: ["stale"] },
        data: { home: { content: [{ type: "Hero" }], root: {} }, gallery: null },
      },
    );

    const page = await PageBuilderEntry({
      params: Promise.resolve({ locale: "en" }),
    });
    render(page);

    expect(screen.getByTestId("seo-description")).toHaveTextContent("Fresh from draft");
    expect(screen.getByTestId("seo-keywords")).toHaveTextContent(
      JSON.stringify(["fresh", "keywords"]),
    );

    // Sanity: the draft we asserted against really is the resolved active draft.
    const drafts = await PortfolioDraft.find({ workspaceId: ws._id }).lean();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]._id.toString()).toBe(draft._id.toString());
  });

  it("falls back to empty defaults when there is no active draft (no drafts, nothing to migrate)", async () => {
    const ws = await seedWorkspace();

    // No home/gallery content in the live publicPage and seedDefaultPortfolio is
    // mocked to return null — ensureLegacyDraftMigrated has nothing to migrate,
    // so no draft ever gets created and listDraftsAction() legitimately returns [].
    mockRequireOrg(
      { _id: ws._id, slug: ws.slug, name: ws.name, businessType: "photographer" },
      {
        seoDescription: "STALE live value",
        seo: { keywords: ["stale"] },
        data: { home: null, gallery: null },
      },
    );

    const page = await PageBuilderEntry({
      params: Promise.resolve({ locale: "en" }),
    });
    render(page);

    expect(screen.getByTestId("seo-description")).toHaveTextContent("");
    expect(screen.getByTestId("seo-keywords")).toHaveTextContent(JSON.stringify([]));

    expect(await PortfolioDraft.countDocuments({ workspaceId: ws._id })).toBe(0);
  });
});
