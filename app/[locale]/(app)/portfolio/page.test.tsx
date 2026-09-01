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
    initialData,
    initialActiveDraftId,
    initialActiveDraftName,
  }: {
    initialSeoDescription: string;
    initialSeoKeywords: string[];
    initialInquiryRecipientEmail: string;
    hasBeenPublished: boolean;
    initialData: unknown;
    initialActiveDraftId: string | null;
    initialActiveDraftName: string;
  }) => (
    <div>
      <div data-testid="seo-description">{initialSeoDescription}</div>
      <div data-testid="seo-keywords">{JSON.stringify(initialSeoKeywords)}</div>
      <div data-testid="inquiry-recipient">{initialInquiryRecipientEmail}</div>
      <div data-testid="has-been-published">{String(hasBeenPublished)}</div>
      <div data-testid="initial-data">{JSON.stringify(initialData)}</div>
      <div data-testid="active-draft-id">{initialActiveDraftId}</div>
      <div data-testid="active-draft-name">{initialActiveDraftName}</div>
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
  it("loads the newest durable draft before published content and does not seed scratch", async () => {
    const ws = await seedWorkspace();
    const older = await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "Older",
      templateId: "scratch",
      data: {
        home: { content: [{ type: "HeroPreset", props: { id: "older" } }], root: {} },
        gallery: { content: [], root: {} },
      },
    });
    const newest = await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "Newest",
      templateId: "scratch",
      data: {
        home: { content: [{ type: "HeroPreset", props: { id: "newest" } }], root: {} },
        gallery: { content: [], root: {} },
      },
    });
    await PortfolioDraft.collection.updateOne(
      { _id: older._id },
      { $set: { updatedAt: new Date("2026-08-30T00:00:00.000Z") } },
    );
    await PortfolioDraft.collection.updateOne(
      { _id: newest._id },
      { $set: { updatedAt: new Date("2026-09-01T00:00:00.000Z") } },
    );

    mockRequireOrg(
      { _id: ws._id, slug: ws.slug, name: ws.name, businessType: "photographer" },
      {
        data: {
          home: { content: [{ type: "HeroPreset", props: { id: "published" } }], root: {} },
          gallery: { content: [], root: {} },
        },
      },
    );

    render(await PageBuilderEntry({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByTestId("active-draft-id")).toHaveTextContent(String(newest._id));
    expect(screen.getByTestId("active-draft-name")).toHaveTextContent("Newest");
    expect(screen.getByTestId("initial-data")).toHaveTextContent("newest");
    expect(screen.getByTestId("initial-data")).not.toHaveTextContent("published");
  });

  it("falls back to published portfolio content when no durable draft exists", async () => {
    const ws = await seedWorkspace();
    const publishedData = {
      home: { content: [{ type: "HeroPreset", props: { id: "published-home" } }], root: {} },
      gallery: { content: [], root: {} },
    };
    await Workspace.updateOne(
      { _id: ws._id },
      { $set: { "publicPage.data": publishedData, "publicPage.templateId": "scratch" } },
    );
    mockRequireOrg(
      { _id: ws._id, slug: ws.slug, name: ws.name, businessType: "photographer" },
      { data: publishedData, templateId: "scratch" },
    );

    render(await PageBuilderEntry({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByTestId("initial-data")).toHaveTextContent("published-home");
  });

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

  it("falls back to a clean scratch document when there is no durable or published content", async () => {
    const ws = await seedWorkspace();

    // No published content means there is nothing to migrate, so no durable
    // draft is synthesized and the editor receives empty scratch Puck data.
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
    expect(screen.getByTestId("initial-data")).toHaveTextContent('"home":{"content":[]');

    expect(await PortfolioDraft.countDocuments({ workspaceId: ws._id })).toBe(0);
  });
});
