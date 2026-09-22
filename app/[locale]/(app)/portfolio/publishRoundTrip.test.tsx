/**
 * Publish round-trip on Puck 0.23 — draft -> publish -> public render.
 *
 * `_draftActions.test.ts` already covers the publish action's plumbing, but it
 * publishes a one-block payload. This asks the question the upgrade actually
 * raises: does a REAL template survive the publish pipeline (chrome
 * normalization, PageBody normalization, preset-layout normalization,
 * reconciliation) and still render through the production renderer?
 *
 * Runs against a throwaway in-memory workspace, so it verifies the real write
 * path without touching the shared dev database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import React from "react";
import { render } from "@testing-library/react";
import { Render, type Config, type Data } from "@puckeditor/core";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));
// Reconcile has its own suite; this one is about the publish -> render path.
vi.mock("@/lib/page-builder/reconcile", () => ({
  reconcileGalleryImages: async (_wsId: string, data: unknown) => data,
  reconcileFeaturedCollections: async (_wsId: string, data: unknown) => data,
}));
vi.mock("@/lib/storage/cloudflareImages", () => ({
  deleteImage: vi.fn().mockResolvedValue(undefined),
  verifyImageOwnership: vi.fn().mockResolvedValue(true),
  updateImageMetadata: vi.fn().mockResolvedValue(undefined),
  imageDeliveryUrl: (id: string) => `https://imagedelivery.net/hash/${id}/public`,
  DEMO_UPLOAD_SUBFOLDER: "portfolio-maker-demo",
}));
vi.mock("@/lib/storage/cloudinary", () => ({
  cloudinaryThumbnailUrl: (publicId: string) =>
    `https://res.cloudinary.com/test/image/upload/${publicId}`,
}));

let mockCtx: {
  userId: string;
  role: "owner" | "staff";
  workspace: { _id: Types.ObjectId; slug: string; plan: "free" | "pro" | "beta" };
};
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId: mockCtx.userId,
    clerkOrgId: "org_test",
    role: mockCtx.role,
    workspace: mockCtx.workspace,
  }),
}));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { PortfolioDraft, Workspace } from "@/lib/db/models";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import { PORTFOLIO_TEMPLATES } from "@/lib/page-builder/templates";
import { puckConfig } from "@/lib/page-builder/config";
import { publishDraftAction } from "./_draftActions";

const renderConfig = puckConfig as unknown as Config;

function countBlocks(data: unknown): number {
  let n = 0;
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    if (typeof rec.type === "string" && rec.props) n += 1;
    Object.values(rec).forEach(walk);
  };
  walk((data as { content?: unknown })?.content ?? []);
  return n;
}

describe("publish round-trip on 0.23", () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  }, 180_000);
  afterAll(async () => {
    await stopInMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
    mockCtx = {
      userId: "user_owner",
      role: "owner",
      workspace: { _id: new Types.ObjectId(), slug: "throwaway-studio", plan: "pro" },
    };
    await Workspace.create({
      _id: mockCtx.workspace._id,
      slug: mockCtx.workspace.slug,
      name: "Throwaway Studio",
      ownerUserId: "user_owner",
      clerkOrgId: `org_${Math.round(Math.random() * 1e9)}`,
      currency: "PHP",
      plan: "pro",
      publicPage: { data: { home: null, gallery: null }, latestVersion: 0 },
    });
  });

  it.each(PORTFOLIO_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s publishes and the published data still renders",
    async (_id, template) => {
      const seeded = template.seedData({ workspace: { name: "Throwaway Studio" } });
      const draft = await PortfolioDraft.create({
        workspaceId: mockCtx.workspace._id,
        name: `${template.id} draft`,
        templateId: template.id,
        data: seeded,
        brandKit: template.defaultBrandKit ?? DEFAULT_BRAND_KIT,
        contact: template.defaultContact ?? {},
        collectionsPopup: template.defaultCollectionsPopup ?? {},
        formLocale: "",
      });

      const res = await publishDraftAction(String(draft._id));
      expect(res).toEqual({ ok: true });

      const ws = await Workspace.findById(mockCtx.workspace._id).lean();
      const published = ws!.publicPage!.data!;
      expect(ws!.publicPage!.publishedAt).toBeInstanceOf(Date);

      for (const zone of ["home", "gallery"] as const) {
        const seededCount = countBlocks(seeded[zone]);
        if (seededCount === 0) continue;
        // Publish normalizes, and normalization may ADD structure — the bare
        // "scratch" template gains a PageBody wrapper on the way out. What it
        // must never do is silently DROP the owner's blocks, which is the
        // failure this pins.
        expect(
          countBlocks(published[zone]),
          `${template.id}/${zone} blocks survived`
        ).toBeGreaterThanOrEqual(seededCount);
        // And the normalized payload must still be renderable by the public page.
        const { container, unmount } = render(
          <Render config={renderConfig} data={published[zone] as unknown as Data} />
        );
        const text = (container.textContent ?? "").replace(/\s+/g, " ").trim();
        expect(text.length, `${template.id}/${zone} rendered copy`).toBeGreaterThan(20);
        unmount();
      }
    },
    120_000
  );
});
