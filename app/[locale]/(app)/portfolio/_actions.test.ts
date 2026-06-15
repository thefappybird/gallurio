import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { GalleryItem } from "@/lib/db/models";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

let mockCtx: { userId: string; role: "owner" | "staff"; workspace: { _id: Types.ObjectId; slug: string } };
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId: mockCtx.userId,
    clerkOrgId: "org_test",
    role: mockCtx.role,
    workspace: mockCtx.workspace,
  }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import {
  savePortfolioDraftAction,
  publishPortfolioAction,
  updateBrandKitAction,
  updateContactConfigAction,
  updateCollectionsPopupConfigAction,
  switchTemplateAction,
  dismissPortfolioGuideAction,
  saveThemeAction,
  updateThemeAction,
} from "./_actions";

let workspaceId: Types.ObjectId;

const samplePuck = { content: [{ type: "Hero", props: { headline: "Hi" } }], root: {} };

async function seedWorkspace() {
  const ws = await Workspace.create({
    slug: "studio-aurora",
    name: "Studio Aurora",
    ownerUserId: "user_owner",
    clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
    currency: "PHP",
    publicPage: {
      data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
      latestVersion: 0,
    },
  });
  workspaceId = ws._id;
  mockCtx = { userId: "user_owner", role: "owner", workspace: { _id: ws._id, slug: "studio-aurora" } };
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  revalidatePath.mockClear();
  await seedWorkspace();
});

describe("savePortfolioDraftAction", () => {
  it("writes only the named zone and bumps latestVersion", async () => {
    const res = await savePortfolioDraftAction({ zone: "home", data: samplePuck });
    expect(res).toMatchObject({ ok: true });

    const ws = await Workspace.findById(workspaceId).lean();
    const home = ws!.publicPage!.data!.home as typeof samplePuck;
    const gallery = ws!.publicPage!.data!.gallery as typeof samplePuck;
    expect(home.content).toHaveLength(1);
    expect(gallery.content).toHaveLength(0); // untouched
    expect(ws!.publicPage!.latestVersion).toBe(1);
  });

  it("does not publish (publishedAt stays null)", async () => {
    await savePortfolioDraftAction({ zone: "gallery", data: samplePuck });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.publishedAt ?? null).toBeNull();
  });

  it("rejects invalid Puck data", async () => {
    const res = await savePortfolioDraftAction({
      zone: "home",
      data: { content: "not-an-array" } as never,
    });
    expect("error" in res).toBe(true);
  });

  it("rejects an unknown zone", async () => {
    const res = await savePortfolioDraftAction({ zone: "about" as never, data: samplePuck });
    expect("error" in res).toBe(true);
  });

  it("rejects a payload that exceeds the 512 KB size cap", async () => {
    // Build a Puck data document whose JSON serialisation exceeds 512 KB.
    const bigContent = Array.from({ length: 6000 }, (_, i) => ({
      type: "Text",
      props: { id: `blk-${i}`, text: "x".repeat(100) },
    }));
    const res = await savePortfolioDraftAction({
      zone: "home",
      data: { content: bigContent, root: {} },
    });
    expect(res).toEqual({ error: "payload_too_large" });
  });

  it("is owner-only", async () => {
    mockCtx.role = "staff";
    const res = await savePortfolioDraftAction({ zone: "home", data: samplePuck });
    expect(res).toEqual({ error: "owner_only" });
  });
});

describe("publishPortfolioAction", () => {
  it("flips publishedAt + lastPublishedAt and revalidates public routes", async () => {
    const res = await publishPortfolioAction();
    expect(res).toEqual({ ok: true });

    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.publishedAt).toBeTruthy();
    expect(ws!.publicPage!.lastPublishedAt).toBeTruthy();

    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toContain("/w/studio-aurora");
    expect(paths).toContain("/w/studio-aurora/gallery");
    expect(paths).toContain("/sitemap.xml");
  });

  it("is owner-only", async () => {
    mockCtx.role = "staff";
    const res = await publishPortfolioAction();
    expect(res).toEqual({ error: "owner_only" });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.publishedAt ?? null).toBeNull();
  });
});

describe("updateBrandKitAction", () => {
  it("persists a valid brand kit", async () => {
    const res = await updateBrandKitAction({ ...DEFAULT_BRAND_KIT, accentColor: "#abcdef" });
    expect(res).toEqual({ ok: true });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.brandKit!.accentColor).toBe("#abcdef");
  });

  it("rejects a malformed brand kit", async () => {
    const res = await updateBrandKitAction({ ...DEFAULT_BRAND_KIT, accentColor: "red" });
    expect("error" in res).toBe(true);
  });

  it("is owner-only", async () => {
    mockCtx.role = "staff";
    const res = await updateBrandKitAction(DEFAULT_BRAND_KIT);
    expect(res).toEqual({ error: "owner_only" });
  });
});

describe("updateContactConfigAction", () => {
  it("persists a valid contact config", async () => {
    const res = await updateContactConfigAction({
      title: "Say hi",
      description: "We reply fast",
      buttonStyle: "solid",
      buttonColor: "accent",
      addSessionButtonStyle: "outline",
      addSessionButtonColor: "secondary",
    });
    expect(res).toEqual({ ok: true });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.contact!.title).toBe("Say hi");
    expect(ws!.publicPage!.contact!.addSessionButtonColor).toBe("secondary");
  });

  it("rejects an over-long title", async () => {
    const res = await updateContactConfigAction({ title: "x".repeat(200) });
    expect("error" in res).toBe(true);
  });

  it("is owner-only", async () => {
    mockCtx.role = "staff";
    const res = await updateContactConfigAction({ title: "x" });
    expect(res).toEqual({ error: "owner_only" });
  });

  it("persists tab styling fields (round-trip)", async () => {
    const res = await updateContactConfigAction({
      tabFontSize: "lg",
      tabColor: "foreground",
      activeTabColor: "accent",
      activeTabScale: true,
      activeTabHighlight: true,
      tabHighlightColor: "primary",
      tabHighlightOpacity: 75,
      activeTabRadius: "subtle",
      activeTabUnderline: false,
      tabUnderlineColor: "",
    });
    expect(res).toEqual({ ok: true });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.contact!.tabFontSize).toBe("lg");
    expect(ws!.publicPage!.contact!.activeTabColor).toBe("accent");
    expect(ws!.publicPage!.contact!.tabHighlightOpacity).toBe(75);
    expect(ws!.publicPage!.contact!.activeTabRadius).toBe("subtle");
    expect(ws!.publicPage!.contact!.activeTabScale).toBe(true);
  });

  it("rejects an invalid tabFontSize", async () => {
    const res = await updateContactConfigAction({ tabFontSize: "xl" as never });
    expect("error" in res).toBe(true);
  });

  it("rejects tabHighlightOpacity out of range", async () => {
    const res = await updateContactConfigAction({ tabHighlightOpacity: 150 });
    expect("error" in res).toBe(true);
  });
});

describe("switchTemplateAction", () => {
  it("re-seeds both zones from the template and archives the previous data", async () => {
    // Give the workspace some existing home content so it gets archived.
    await savePortfolioDraftAction({ zone: "home", data: samplePuck });

    const res = await switchTemplateAction({ templateId: "minimal" });
    expect(res).toMatchObject({ ok: true });
    if (!("ok" in res)) throw new Error("expected ok");
    expect(res.seed.templateId).toBe("minimal");
    expect(res.seed.data.home).toBeTruthy();
    expect(res.seed.data.gallery).toBeTruthy();

    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.templateId).toBe("minimal");
    // Seeded home has real blocks now.
    const home = ws!.publicPage!.data!.home as { content: unknown[] };
    expect(home.content.length).toBeGreaterThan(0);
    // The pre-switch home was archived.
    const prev = ws!.publicPage!.previousData!.home as { content: unknown[] };
    expect(prev.content).toHaveLength(1);
  });

  it("rejects an unknown template id", async () => {
    const res = await switchTemplateAction({ templateId: "not-real" });
    expect("error" in res).toBe(true);
  });

  it("is owner-only", async () => {
    mockCtx.role = "staff";
    const res = await switchTemplateAction({ templateId: "minimal" });
    expect(res).toEqual({ error: "owner_only" });
  });
});

describe("dismissPortfolioGuideAction", () => {
  it("persists guideDismissedAt", async () => {
    const res = await dismissPortfolioGuideAction();
    expect(res).toEqual({ ok: true });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.guideDismissedAt).toBeTruthy();
  });

  it("is owner-only", async () => {
    mockCtx.role = "staff";
    const res = await dismissPortfolioGuideAction();
    expect(res).toEqual({ error: "owner_only" });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.guideDismissedAt ?? null).toBeNull();
  });
});

describe("updateCollectionsPopupConfigAction", () => {
  it("owner-only (403/error for staff)", async () => {
    mockCtx.role = "staff";
    expect(await updateCollectionsPopupConfigAction({})).toEqual({ error: "owner_only" });
  });
  it("persists to publicPage.collectionsPopup + revalidates", async () => {
    const res = await updateCollectionsPopupConfigAction({ borderWidth: 2, radius: "subtle" });
    expect(res).toMatchObject({ ok: true });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.collectionsPopup).toMatchObject({ borderWidth: 2, radius: "subtle" });
    expect(revalidatePath).toHaveBeenCalledWith("/w/studio-aurora");
  });
  it("rejects invalid input", async () => {
    expect(await updateCollectionsPopupConfigAction({ borderWidth: 999 })).toHaveProperty("error");
  });
});

describe("publishPortfolioAction — reconcile + publish", () => {
  it("rejects a non-owner", async () => {
    mockCtx.role = "staff";
    expect(await publishPortfolioAction()).toEqual({ error: "owner_only" });
  });

  it("persists reconciled images (refresh + prune) AND sets publishedAt", async () => {
    const wsId = mockCtx.workspace._id;
    const live = await GalleryItem.create({
      workspaceId: wsId,
      collectionId: null,
      assetId: `ws/${wsId}/live`,
      url: "https://x/l.jpg",
      altText: "Live alt",
      order: 0,
    });
    const missing = new Types.ObjectId().toString();

    // Patch the existing workspace (created by seedWorkspace in beforeEach)
    // with a GalleryGrid block containing stale + missing image references.
    await Workspace.updateOne(
      { _id: wsId },
      {
        $set: {
          "publicPage.data.home": {
            root: {},
            content: [
              {
                type: "GalleryGrid",
                props: {
                  id: "g1",
                  images: [
                    { id: String(live._id), publicId: "STALE", alt: "stale" },
                    { id: missing, publicId: "x" },
                  ],
                  columns: 3,
                  gap: "normal",
                },
              },
            ],
          },
          "publicPage.data.gallery": { root: {}, content: [] },
        },
      }
    );

    const res = await publishPortfolioAction();
    expect(res).toEqual({ ok: true });

    const fresh = await Workspace.findById(wsId).lean();
    const images = (
      fresh!.publicPage!.data!.home as {
        content: Array<{ props: { images: Array<{ id: string; publicId: string; alt: string }> } }>;
      }
    ).content[0].props.images;
    expect(images).toEqual([
      { id: String(live._id), publicId: `ws/${wsId}/live`, alt: "Live alt" },
    ]);
    expect(fresh!.publicPage!.publishedAt).toBeTruthy();
    expect(fresh!.publicPage!.lastPublishedAt).toBeTruthy();
  });
});

describe("saveThemeAction", () => {
  it("rejects a duplicate theme name case-insensitively", async () => {
    await Workspace.updateOne(
      { _id: workspaceId },
      { $set: { "publicPage.savedThemes": [{ id: "a", name: "Sunset", brandKit: DEFAULT_BRAND_KIT }] } }
    );
    const res = await saveThemeAction("  sUnSeT ", DEFAULT_BRAND_KIT);
    expect(res).toEqual({ error: "theme_name_exists" });
  });

  it("saves a uniquely-named theme", async () => {
    const res = await saveThemeAction("Spring 26", DEFAULT_BRAND_KIT);
    expect(res).toMatchObject({ ok: true, theme: { name: "Spring 26" } });
    const ws = await Workspace.findById(workspaceId).lean();
    expect(ws!.publicPage!.savedThemes).toHaveLength(1);
  });
});

describe("updateThemeAction", () => {
  beforeEach(async () => {
    await Workspace.updateOne(
      { _id: workspaceId },
      { $set: { "publicPage.savedThemes": [
        { id: "a", name: "Sunset", brandKit: DEFAULT_BRAND_KIT },
        { id: "b", name: "Moody", brandKit: DEFAULT_BRAND_KIT },
      ] } }
    );
  });

  it("updates name + brandKit in place, preserving id and order", async () => {
    const kit = { ...DEFAULT_BRAND_KIT, accentColor: "#123456" };
    const res = await updateThemeAction("a", "Sunset Bright", kit);
    expect(res).toMatchObject({ ok: true, theme: { id: "a", name: "Sunset Bright" } });
    const doc = await Workspace.findById(workspaceId).lean();
    expect(doc!.publicPage!.savedThemes!.map((t: { id: string }) => t.id)).toEqual(["a", "b"]);
    expect(doc!.publicPage!.savedThemes![0].name).toBe("Sunset Bright");
    expect(doc!.publicPage!.savedThemes![0].brandKit!.accentColor).toBe("#123456");
  });

  it("allows a theme to keep its own name", async () => {
    const res = await updateThemeAction("a", "Sunset", DEFAULT_BRAND_KIT);
    expect(res).toMatchObject({ ok: true });
  });

  it("rejects a name owned by a different theme (case-insensitive)", async () => {
    const res = await updateThemeAction("a", "moody", DEFAULT_BRAND_KIT);
    expect(res).toEqual({ error: "theme_name_exists" });
  });

  it("returns theme_not_found for an unknown id", async () => {
    const res = await updateThemeAction("zzz", "X", DEFAULT_BRAND_KIT);
    expect(res).toEqual({ error: "theme_not_found" });
  });

  it("is owner-only", async () => {
    mockCtx.role = "staff";
    const res = await updateThemeAction("a", "Whatever", DEFAULT_BRAND_KIT);
    expect(res).toEqual({ error: "owner_only" });
  });

  it("cannot edit another workspace's theme (tenant isolation)", async () => {
    const otherWs = await Workspace.create({
      slug: "other-studio",
      name: "Other Studio",
      ownerUserId: "user_other",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
      currency: "PHP",
      publicPage: {
        data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
        latestVersion: 0,
        savedThemes: [{ id: "a", name: "Theirs", brandKit: DEFAULT_BRAND_KIT }],
      },
    });
    // mockCtx still points at workspaceId (owner A); updating id "a" must only
    // touch A's theme, never B's same-id theme.
    await updateThemeAction("a", "Hijacked", DEFAULT_BRAND_KIT);
    const theirs = await Workspace.findById(otherWs._id).lean();
    expect(theirs!.publicPage!.savedThemes![0].name).toBe("Theirs");
  });
});
