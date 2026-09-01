import type { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace, PortfolioDraft } from "@/lib/db/models";
import { DEFAULT_DRAFT_NAME } from "./drafts";
import { normalizeSharedChromeData } from "./sharedChrome";
import type { PortfolioHeaderConfig, PuckData } from "./types";

/**
 * One-time, idempotent migration: when a workspace has no drafts yet but already
 * has portfolio content in publicPage.data, fold that content into a single
 * "New Draft" so the owner keeps editing their current portfolio as a draft.
 * Runs on first editor entry post-ship.
 */
export async function ensureLegacyDraftMigrated(workspaceId: Types.ObjectId): Promise<void> {
  await connectDB();
  const existing = await PortfolioDraft.countDocuments({ workspaceId });
  if (existing > 0) return;

  const ws = await Workspace.findById(workspaceId).select({ publicPage: 1 }).lean();
  const pp = ws?.publicPage;
  const home = pp?.data?.home ?? null;
  // null is the intentional empty-zone shape for an unpopulated page, matching publicPage.data.
  const gallery = pp?.data?.gallery ?? null;
  const navigation = pp?.data?.navigation ?? null;
  const footer = pp?.data?.footer ?? null;
  if (!home && !gallery && !navigation && !footer) return;

  const normalizedData = normalizeSharedChromeData(
    {
      home: home as PuckData | null,
      gallery: gallery as PuckData | null,
      navigation: navigation as PuckData | null,
      footer: footer as PuckData | null,
    },
    pp?.header as PortfolioHeaderConfig | null,
  );

  try {
    await PortfolioDraft.create({
      workspaceId,
      name: DEFAULT_DRAFT_NAME,
      templateId: pp?.templateId ?? "",
      data: normalizedData,
      brandKit: pp?.brandKit ?? null,
      contact: pp?.contact ?? null,
      header: pp?.header ?? null,
      collectionsPopup: pp?.collectionsPopup ?? null,
      formLocale: pp?.formLocale ?? "",
      formDir: pp?.formDir ?? "",
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
  } catch (err) {
    // Benign race: a concurrent first-load already created the migrated draft.
    // The unique { workspaceId, name } index rejects the duplicate; anything
    // else is a real error.
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) return;
    throw err;
  }
}
