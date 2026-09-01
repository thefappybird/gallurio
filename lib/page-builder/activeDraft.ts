import type { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { PortfolioDraft, Workspace } from "@/lib/db/models";
import { DEFAULT_DRAFT_NAME } from "./drafts";
import { ensureLegacyDraftMigrated } from "./migrateDraft";
import { normalizeSharedChromeData } from "./sharedChrome";
import type { PortfolioHeaderConfig } from "./types";

/**
 * Resolves the draft a workspace's next publish should act on: the most
 * recently updated draft, migrating legacy publicPage content into a draft
 * first if needed, or creating a minimal default draft if none exists at all.
 */
export async function resolveActiveDraftId(workspaceId: Types.ObjectId): Promise<Types.ObjectId> {
  await connectDB();
  await ensureLegacyDraftMigrated(workspaceId);

  const existing = await PortfolioDraft.findOne({ workspaceId })
    .sort({ updatedAt: -1 })
    .select({ _id: 1 })
    .lean();
  if (existing) return existing._id;

  // No page content ever existed to migrate, but SEO/icon fields may already be
  // set directly on publicPage (old Settings-form writes) — seed them so this
  // fresh draft doesn't silently blank out real, previously-configured data.
  const ws = await Workspace.findById(workspaceId).select({ publicPage: 1 }).lean();
  const pp = ws?.publicPage;

  try {
    const created = await PortfolioDraft.create({
      workspaceId,
      name: DEFAULT_DRAFT_NAME,
      templateId: "",
      data: normalizeSharedChromeData(
        { home: null, gallery: null },
        pp?.header as PortfolioHeaderConfig | null | undefined,
      ),
      brandKit: null,
      contact: null,
      header: null,
      collectionsPopup: null,
      formLocale: "",
      formDir: "",
      seoTitle: pp?.seoTitle ?? "",
      seoDescription: pp?.seoDescription ?? "",
      siteIcon: {
        url: pp?.siteIcon?.url ?? "",
        assetId: pp?.siteIcon?.assetId ?? "",
      },
      seo: {
        ogImageUrl: pp?.seo?.ogImageUrl ?? "",
        ogImageAssetId: pp?.seo?.ogImageAssetId ?? "",
        galleryDescription: pp?.seo?.galleryDescription ?? "",
        noindex: pp?.seo?.noindex ?? false,
        keywords: pp?.seo?.keywords ?? [],
      },
    });
    return created._id;
  } catch (err) {
    // Benign race: a concurrent first-load already created the default draft.
    // The unique { workspaceId, name } index rejects the duplicate; anything
    // else is a real error.
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      const raced = await PortfolioDraft.findOne({ workspaceId, name: DEFAULT_DRAFT_NAME })
        .select({ _id: 1 })
        .lean();
      if (raced) return raced._id;
    }
    throw err;
  }
}
