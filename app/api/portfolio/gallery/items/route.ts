import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { requireApiOrg } from "@/lib/auth/apiOrgContext";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryCollection, GalleryItem } from "@/lib/db/models";
import { verifyImageOwnership, imageDeliveryUrl } from "@/lib/storage/cloudflareImages";
import { validatePhotoMeta, PORTFOLIO_PHOTO_MAX_BYTES } from "@/lib/page-builder/photoSpec";
import { photoCheckDetail } from "@/lib/uploads/photoCheckDetail";

export const runtime = "nodejs";

const bodySchema = z.object({
  assetId: z.string().min(1).max(300),
  url: z.string().url().max(1000),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  format: z.string().max(20).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  caption: z.string().max(300).optional(),
  altText: z.string().max(300).optional(),
  collectionId: z.string().min(1).max(64).optional(),
});

/**
 * POST /api/portfolio/gallery/items
 *
 * Creates a single GalleryItem (not tied to a collection) for the picker.
 * Owner-only; non-owners receive 403.
 *
 * Response: { id: string, thumbUrl: string, caption: string | null }
 */
export async function POST(req: Request) {
  const auth = await requireApiOrg();
  if (!auth.ok) return auth.response;
  const ctx = auth.ctx;
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "invalid_input" },
      { status: 400 }
    );
  }

  const workspaceId = ctx.workspace._id;

  const owned = await verifyImageOwnership(parsed.data.assetId, workspaceId.toString());
  if (!owned) {
    return NextResponse.json({ error: "invalid_image_ownership" }, { status: 400 });
  }

  // Server-side photo validation — format, size, and dimensions.
  const photoMeta = {
    format: parsed.data.format,
    sizeBytes: parsed.data.sizeBytes,
    width: parsed.data.width,
    height: parsed.data.height,
  };
  const photoCheck = validatePhotoMeta(photoMeta, PORTFOLIO_PHOTO_MAX_BYTES);
  if (!photoCheck.ok) {
    return NextResponse.json(
      { error: photoCheck.reason, detail: photoCheckDetail(photoCheck.reason, photoMeta, PORTFOLIO_PHOTO_MAX_BYTES) },
      { status: 400 }
    );
  }

  await connectDB();

  // Resolve an optional collection — must be a valid id owned by THIS workspace.
  let collectionId: typeof workspaceId | null = null;
  if (parsed.data.collectionId) {
    if (!isValidObjectId(parsed.data.collectionId)) {
      return NextResponse.json({ error: "invalid_collection" }, { status: 400 });
    }
    const collection = await GalleryCollection.findOne({
      _id: parsed.data.collectionId,
      workspaceId,
    })
      .select({ _id: 1 })
      .lean();
    if (!collection) {
      return NextResponse.json({ error: "invalid_collection" }, { status: 400 });
    }
    collectionId = collection._id;
  }

  // Next order index within the target scope (collection or standalone).
  const existingCount = await GalleryItem.countDocuments({ workspaceId, collectionId });

  const item = await GalleryItem.create({
    workspaceId,
    collectionId,
    assetId: parsed.data.assetId,
    url: parsed.data.url,
    width: parsed.data.width ?? null,
    height: parsed.data.height ?? null,
    format: parsed.data.format ?? null,
    sizeBytes: parsed.data.sizeBytes ?? 0,
    caption: parsed.data.caption ?? "",
    altText: parsed.data.altText ?? "",
    order: existingCount,
  });

  const thumbUrl = imageDeliveryUrl(parsed.data.assetId, {
    width: 200,
    height: 200,
    fit: "cover",
  });

  return NextResponse.json(
    { id: String(item._id), thumbUrl, caption: parsed.data.caption ?? null },
    { status: 201 }
  );
}
