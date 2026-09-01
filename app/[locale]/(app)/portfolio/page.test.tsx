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

// Wraps the real listDraftsAction so most tests exercise the real, tenant-scoped
// implementation, while the isolation test can override it to hand page.tsx a
// foreign workspace's draft id — proving the follow-up PortfolioDraft.findOne
// query (not just listDraftsAction) is what keeps tenants apart.
vi.mock("./_draftActions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_draftActions")>();
  return { ...actual, listDraftsAction: vi.fn(actual.listDraftsAction) };
});

type MockEditorShellProps = {
  initialData: unknown;
  initialBrandKit: unknown;
  initialContact: unknown;
  initialFormLocale: string;
  currentTemplateId: string;
  initialSeoDescription: string;
  initialSeoKeywords: string[];
  initialInquiryRecipientEmail: string;
  hasBeenPublished: boolean;
  initialActiveDraftId: string | null;
  initialActiveDraftName?: string;
};

vi.mock("./_components/EditorShell", () => ({
  EditorShell: ({
    initialData,
    initialBrandKit,
    initialContact,
    initialFormLocale,
    currentTemplateId,
    initialSeoDescription,
    initialSeoKeywords,
    initialInquiryRecipientEmail,
    hasBeenPublished,
    initialActiveDraftId,
    initialActiveDraftName,
  }: MockEditorShellProps) => (
    <div>
      <div data-testid="initial-data">{JSON.stringify(initialData)}</div>
      <div data-testid="initial-brand-kit">{JSON.stringify(initialBrandKit)}</div>
      <div data-testid="initial-contact">{JSON.stringify(initialContact)}</div>
      <div data-testid="initial-form-locale">{initialFormLocale}</div>
      <div data-testid="current-template-id">{currentTemplateId}</div>
      <div data-testid="seo-description">{initialSeoDescription}</div>
      <div data-testid="seo-keywords">{JSON.stringify(initialSeoKeywords)}</div>
      <div data-testid="inquiry-recipient">{initialInquiryRecipientEmail}</div>
      <div data-testid="has-been-published">{String(hasBeenPublished)}</div>
      <div data-testid="active-draft-id">{initialActiveDraftId ?? ""}</div>
      <div data-testid="active-draft-name">{initialActiveDraftName ?? ""}</div>
    </div>
  ),
}));

import PageBuilderEntry from "./page";
import { listDraftsAction } from "./_draftActions";
import { seedDefaultPortfolio } from "@/lib/page-builder/seedPortfolio";

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

async function seedWorkspace(overrides: Partial<{ slug: string }> = {}) {
  return Workspace.create({
    slug: overrides.slug ?? "studio-aurora",
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

async function renderEntry() {
  const page = await PageBuilderEntry({ params: Promise.resolve({ locale: "en" }) });
  render(page);
}

describe("PageBuilderEntry — canvas loads the active draft, not the published page", () => {
  it("loads initialData/brandKit/contact/formLocale/templateId from the newest draft, not publicPage", async () => {
    const ws = await seedWorkspace();
    await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "My Draft",
      templateId: "editorial",
      data: {
        home: { content: [{ type: "Hero", props: { id: "draft-hero" } }], root: {} },
        gallery: null,
      },
      brandKit: { primary: "#draftcolor" },
      contact: { email: "draft@example.com" },
      formLocale: "fil",
    });

    mockRequireOrg(
      { _id: ws._id, slug: ws.slug, name: ws.name, businessType: "photographer" },
      {
        templateId: "scratch",
        data: { home: { content: [{ type: "Hero", props: { id: "STALE" } }], root: {} }, gallery: null },
        brandKit: { primary: "#stalecolor" },
        contact: { email: "stale@example.com" },
        formLocale: "en",
      },
    );

    await renderEntry();

    const rendered = JSON.parse(screen.getByTestId("initial-data").textContent ?? "{}");
    expect(rendered.home.content[0].props.id).toBe("draft-hero");
    expect(screen.getByTestId("initial-brand-kit")).toHaveTextContent("#draftcolor");
    expect(screen.getByTestId("initial-contact")).toHaveTextContent("draft@example.com");
    expect(screen.getByTestId("initial-form-locale")).toHaveTextContent("fil");
    expect(screen.getByTestId("current-template-id")).toHaveTextContent("editorial");
  });

  it("falls back to publicPage-derived values (empty defaults) when there is no active draft", async () => {
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

    await renderEntry();

    expect(screen.getByTestId("initial-data")).toHaveTextContent(
      JSON.stringify({ home: { content: [], root: {} }, gallery: { content: [], root: {} } }),
    );
    expect(screen.getByTestId("initial-brand-kit").textContent).not.toBe("");
    expect(screen.getByTestId("initial-contact")).toHaveTextContent(JSON.stringify({}));
    expect(screen.getByTestId("initial-form-locale")).toHaveTextContent("");
    expect(screen.getByTestId("seo-description")).toHaveTextContent("");
    expect(screen.getByTestId("seo-keywords")).toHaveTextContent(JSON.stringify([]));
    expect(await PortfolioDraft.countDocuments({ workspaceId: ws._id })).toBe(0);
  });

  it("seeds a starter template and opens on it for a brand-new workspace (no home data, no drafts)", async () => {
    const ws = await seedWorkspace();
    vi.mocked(seedDefaultPortfolio).mockResolvedValueOnce({
      templateId: "editorial",
      data: {
        home: { content: [{ type: "Hero", props: { id: "seeded-hero" } }], root: {} },
        gallery: { content: [], root: {} },
      },
      brandKit: { primary: "#seededcolor" },
      contact: { email: "seeded@example.com" },
    });

    mockRequireOrg(
      { _id: ws._id, slug: ws.slug, name: ws.name, businessType: "photographer" },
      { data: { home: null, gallery: null } },
    );

    await renderEntry();

    const rendered = JSON.parse(screen.getByTestId("initial-data").textContent ?? "{}");
    expect(rendered.home.content[0].props.id).toBe("seeded-hero");
    expect(screen.getByTestId("current-template-id")).toHaveTextContent("editorial");
    expect(screen.getByTestId("initial-brand-kit")).toHaveTextContent("#seededcolor");
  });

  it("falls back per-field to publicPage values when the active draft lacks brandKit/contact/formLocale", async () => {
    const ws = await seedWorkspace();
    await PortfolioDraft.create({
      workspaceId: ws._id,
      name: "My Draft",
      data: { home: { content: [{ type: "Hero" }], root: {} }, gallery: null },
      // brandKit/contact/formLocale intentionally omitted — schema defaults
      // apply (null / null / "").
    });

    mockRequireOrg(
      { _id: ws._id, slug: ws.slug, name: ws.name, businessType: "photographer" },
      {
        brandKit: { primary: "#publicpagecolor" },
        contact: { email: "publicpage@example.com" },
        formLocale: "id",
        data: { home: null, gallery: null },
      },
    );

    await renderEntry();

    expect(screen.getByTestId("initial-brand-kit")).toHaveTextContent("#publicpagecolor");
    expect(screen.getByTestId("initial-contact")).toHaveTextContent("publicpage@example.com");
    expect(screen.getByTestId("initial-form-locale")).toHaveTextContent("id");
  });

  it("tenant isolation: a draft id belonging to another workspace resolves to nothing", async () => {
    const foreignWs = await seedWorkspace({ slug: "foreign-studio" });
    const foreignDraft = await PortfolioDraft.create({
      workspaceId: foreignWs._id,
      name: "Foreign Draft",
      data: { home: { content: [{ type: "Hero", props: { id: "FOREIGN" } }], root: {} }, gallery: null },
      brandKit: { primary: "#foreigncolor" },
    });

    const ws = await seedWorkspace({ slug: "victim-studio" });
    mockRequireOrg(
      { _id: ws._id, slug: ws.slug, name: ws.name, businessType: "photographer" },
      {
        data: { home: null, gallery: null },
        brandKit: { primary: "#ownpagecolor" },
      },
    );

    // Force listDraftsAction to hand back the foreign draft's id, as if it had
    // somehow leaked into this workspace's active-draft resolution.
    vi.mocked(listDraftsAction).mockResolvedValueOnce([
      { id: String(foreignDraft._id), name: "Foreign Draft", templateId: "", updatedAt: new Date().toISOString() },
    ]);

    await renderEntry();

    // The workspace-scoped findOne must not resolve the foreign draft — falls
    // back to this workspace's own publicPage-derived brandKit instead.
    expect(screen.getByTestId("initial-brand-kit")).toHaveTextContent("#ownpagecolor");
    expect(screen.getByTestId("initial-brand-kit").textContent).not.toContain("foreigncolor");
    const rendered = JSON.parse(screen.getByTestId("initial-data").textContent ?? "{}");
    expect(JSON.stringify(rendered)).not.toContain("FOREIGN");
  });
});
