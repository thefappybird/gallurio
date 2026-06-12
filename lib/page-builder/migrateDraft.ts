import type { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace, PortfolioDraft } from "@/lib/db/models";
import { DEFAULT_DRAFT_NAME } from "./drafts";

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
  if (!home && !gallery) return;

  try {
    await PortfolioDraft.create({
      workspaceId,
      name: DEFAULT_DRAFT_NAME,
      templateId: pp?.templateId ?? "",
      data: { home, gallery },
      brandKit: pp?.brandKit ?? null,
      contact: pp?.contact ?? null,
      header: pp?.header ?? null,
      collectionsPopup: pp?.collectionsPopup ?? null,
      formLocale: pp?.formLocale ?? "",
    });
  } catch (err) {
    // Benign race: a concurrent first-load already created the migrated draft.
    // The unique { workspaceId, name } index rejects the duplicate; anything
    // else is a real error.
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) return;
    throw err;
  }
}
