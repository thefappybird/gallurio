import "server-only";

import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import {
  getTemplate,
  getTemplateForBusinessType,
  type PortfolioTemplate,
} from "@/lib/page-builder/templates";
import type { PortfolioBrandKit, PortfolioContactConfig, PortfolioPuckData } from "@/lib/page-builder/types";
import type { Types } from "mongoose";

export type PortfolioSeed = {
  templateId: string;
  data: PortfolioPuckData;
  brandKit: PortfolioBrandKit;
  contact: PortfolioContactConfig;
};

// Build a template's seed data.
async function buildSeed(
  template: PortfolioTemplate,
  ctx: { name: string }
): Promise<PortfolioSeed> {
  const data = template.seedData({ workspace: { name: ctx.name } });

  return {
    templateId: template.id,
    data,
    brandKit: template.defaultBrandKit,
    contact: template.defaultContact,
  };
}

/**
 * First-visit seed. Idempotent: only writes when `publicPage.data.home` is still
 * empty, so concurrent first loads can't double-seed. Returns the seed when it
 * (or a just-completed peer) populates the page, or null when already seeded by
 * a non-default flow (the caller then renders the persisted data).
 *
 * Seeds the scratch template for first visitors unless they explicitly pick a
 * starter template in the editor.
 */
export async function seedDefaultPortfolio(workspaceId: Types.ObjectId): Promise<PortfolioSeed | null> {
  await connectDB();
  const ws = await Workspace.findById(workspaceId)
    .select({ name: 1, businessType: 1, "publicPage.data.home": 1 })
    .lean();
  if (!ws) return null;
  if (ws.publicPage?.data?.home) return null; // already seeded

  const template = getTemplateForBusinessType(ws.businessType);
  const seed = await buildSeed(template, { name: ws.name });

  // Idempotent guard: the filter only matches while home is still empty, so a
  // racing first-load that already seeded leaves this a no-op.
  const res = await Workspace.updateOne(
    { _id: workspaceId, "publicPage.data.home": null },
    {
      $set: {
        "publicPage.templateId": seed.templateId,
        "publicPage.data": seed.data,
        "publicPage.brandKit": seed.brandKit,
        "publicPage.contact": seed.contact,
      },
    }
  );

  // We lost the race — another first-load already seeded. Return what was
  // actually persisted so the caller renders the live data, not our throwaway.
  if (res.matchedCount === 0) {
    const fresh = await Workspace.findById(workspaceId)
      .select({ "publicPage.templateId": 1, "publicPage.data": 1, "publicPage.brandKit": 1, "publicPage.contact": 1 })
      .lean();
    if (fresh?.publicPage?.data?.home) {
      return {
        templateId: fresh.publicPage.templateId ?? seed.templateId,
        data: fresh.publicPage.data as PortfolioPuckData,
        brandKit: (fresh.publicPage.brandKit as PortfolioSeed["brandKit"]) ?? seed.brandKit,
        contact: (fresh.publicPage.contact as PortfolioSeed["contact"]) ?? seed.contact,
      };
    }
  }

  return seed;
}

/**
 * Re-seed both zones from a chosen template (the in-editor template switcher).
 * Archives the current data into `previousData` first so an accidental switch is
 * recoverable. Brand kit + contact are reset to the template defaults. Returns
 * the seed, or null when the template id or workspace is unknown.
 */
export async function reseedPortfolioFromTemplate(
  workspaceId: Types.ObjectId,
  templateId: string
): Promise<PortfolioSeed | null> {
  const template = getTemplate(templateId);
  if (!template) return null;

  await connectDB();
  const ws = await Workspace.findById(workspaceId)
    .select({ name: 1, "publicPage.data": 1 })
    .lean();
  if (!ws) return null;

  const seed = await buildSeed(template, { name: ws.name });

  const set: Record<string, unknown> = {
    "publicPage.templateId": seed.templateId,
    "publicPage.data": seed.data,
    "publicPage.brandKit": seed.brandKit,
    "publicPage.contact": seed.contact,
  };
  if (ws.publicPage?.data?.home) {
    set["publicPage.previousData"] = ws.publicPage.data;
  }

  await Workspace.updateOne({ _id: workspaceId }, { $set: set });
  return seed;
}
