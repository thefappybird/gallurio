import { NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryCollection, GalleryItem } from "@/lib/db/models";
import { destroyAsset } from "@/lib/storage/cloudinary";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/portfolio/gallery/collections/[id]
 *
 * Hard-deletes a collection AND every photo inside it — the GalleryItem docs
 * are removed and their Cloudinary assets destroyed. Irreversible; the editor
 * UI warns the owner before calling this.
 *
 * Owner-only. Items that live outside a collection (collectionId: null, e.g.
 * Hero/CTA backgrounds and Featured Work picks) are never touched.
 *
 * The DB delete (collection + items) runs in a transaction. Cloudinary destroys
 * run after the transaction commits, per-asset and best-effort: a single failed
 * destroy is logged but never strands the DB delete or fails the whole request.
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

  // Capture the public IDs before deletion so we can clean up Cloudinary after.
  const items = await GalleryItem.find({ workspaceId, collectionId: id })
    .select({ cloudinaryPublicId: 1 })
    .lean();
  const publicIds = items.map((it) => it.cloudinaryPublicId).filter(Boolean);

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

  // DB state is now authoritative. Best-effort Cloudinary cleanup — a stuck
  // asset must not resurrect the (already-deleted) collection.
  let assetsFailed = 0;
  await Promise.all(
    publicIds.map(async (pid) => {
      try {
        await destroyAsset(pid);
      } catch (err) {
        assetsFailed += 1;
        console.error(`[portfolio/gallery/collections] cloudinary destroy failed for ${pid}:`, err);
      }
    })
  );

  return NextResponse.json(
    { deleted: true, itemsDeleted: publicIds.length, assetsFailed },
    { status: 200 }
  );
}
