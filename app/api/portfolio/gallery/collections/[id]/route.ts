import { NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryCollection, GalleryItem } from "@/lib/db/models";
import { deleteImage } from "@/lib/storage/cloudflareImages";
import { listCollectionItemsPage, listAllItemsPage, listCollectionNewest, countItemsByAssetId } from "@/lib/db/queries/gallery";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/portfolio/gallery/collections/[id]?cursor=<c>&limit=16
 *
 * Owner-only paginated feed of a collection's photos for the MediaPicker.
 * `id="all"` is a virtual sentinel: newest-first across the whole workspace
 * (covers standalone collectionId:null items). `?newest=<n>` returns the newest
 * n items of a collection (bulk "select all"). Tenant-scoped — a foreign or
 * missing collection resolves to an empty page.
 *
 * Response: { items: PickerItem[]; nextCursor: string | null }
 */
export async function GET(req: Request, { params }: Params) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw == null ? undefined : Number(limitRaw);
  const newestRaw = searchParams.get("newest");
  const workspaceId = ctx.workspace._id.toString();

  if (id === "all") {
    const page = await listAllItemsPage({ workspaceId, cursor, limit });
    return NextResponse.json(page);
  }

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  // Bulk "select all in collection": the newest N items, no pagination.
  if (newestRaw != null) {
    const items = await listCollectionNewest({ workspaceId, collectionId: id, limit: Number(newestRaw) });
    return NextResponse.json({ items, nextCursor: null });
  }

  const page = await listCollectionItemsPage({ workspaceId, collectionId: id, cursor, limit });
  return NextResponse.json(page);
}

/**
 * DELETE /api/portfolio/gallery/collections/[id]
 *
 * Hard-deletes a collection AND every photo inside it — the GalleryItem docs
 * are removed and their remote assets deleted. Irreversible; the editor
 * UI warns the owner before calling this.
 *
 * Owner-only. Items that live outside a collection (collectionId: null, e.g.
 * Hero/CTA backgrounds and Featured Work picks) are never touched.
 *
 * The DB delete (collection + items) runs in a transaction. CF Images deletes
 * run after the transaction commits, per-asset and best-effort: a single failed
 * delete is logged but never strands the DB delete or fails the whole request.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const workspaceId = ctx.workspace._id;
  await connectDB();

  // Ownership check is part of the same filter — never delete by _id alone.
  const collection = await GalleryCollection.findOne({ _id: id, workspaceId })
    .select({ _id: 1 })
    .lean();
  if (!collection) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Capture asset IDs before deletion so we can clean up CF Images after.
  const items = await GalleryItem.find({ workspaceId, collectionId: id })
    .select({ assetId: 1 })
    .lean();
  const assetIds = items.map((it) => it.assetId).filter(Boolean);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await GalleryItem.deleteMany({ workspaceId, collectionId: id }, { session });
      await GalleryCollection.deleteOne({ _id: id, workspaceId }, { session });
    });
  } catch (err) {
    console.error("[portfolio/gallery/collections] delete failed:", err);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  } finally {
    await session.endSession();
  }

  // Reference-counted cleanup: the collection's item docs are gone; delete an
  // asset from CF Images only if no remaining doc (a copy elsewhere) references it.
  let assetsFailed = 0;
  let assetsDestroyed = 0;
  await Promise.all(
    assetIds.map(async (assetId) => {
      try {
        const remaining = await countItemsByAssetId(workspaceId.toString(), assetId);
        if (remaining > 0) return;
        await deleteImage(assetId);
        assetsDestroyed += 1;
      } catch (err) {
        assetsFailed += 1;
        console.error(`[portfolio/gallery/collections] CF Images delete failed for ${assetId}:`, err);
      }
    })
  );

  return NextResponse.json(
    { deleted: true, itemsDeleted: items.length, assetsDestroyed, assetsFailed },
    { status: 200 }
  );
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    coverItemId: z.string().min(1).max(64).optional(),
  })
  .refine((d) => d.name !== undefined || d.coverItemId !== undefined, { message: "no_fields" });

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const json = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "invalid_input" }, { status: 400 });
  }

  const workspaceId = ctx.workspace._id;
  await connectDB();
  const collection = await GalleryCollection.findOne({ _id: id, workspaceId });
  if (!collection) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (parsed.data.coverItemId !== undefined) {
    if (!isValidObjectId(parsed.data.coverItemId)) {
      return NextResponse.json({ error: "invalid_cover" }, { status: 400 });
    }
    const coverItem = await GalleryItem.findOne({ _id: parsed.data.coverItemId, workspaceId, collectionId: id })
      .select({ _id: 1 })
      .lean();
    if (!coverItem) return NextResponse.json({ error: "invalid_cover" }, { status: 400 });
    collection.coverItemId = coverItem._id;
  }
  if (parsed.data.name !== undefined) collection.name = parsed.data.name;
  await collection.save();

  return NextResponse.json(
    { id: String(collection._id), name: collection.name, coverItemId: collection.coverItemId ? String(collection.coverItemId) : null },
    { status: 200 }
  );
}
