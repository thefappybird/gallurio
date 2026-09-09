import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireApiOrg } from "@/lib/auth/apiOrgContext";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryCollection, GalleryItem } from "@/lib/db/models";
import { verifyImageOwnership } from "@/lib/storage/cloudflareImages";
import { validatePhotoMeta, PORTFOLIO_PHOTO_MAX_BYTES } from "@/lib/page-builder/photoSpec";
import { photoCheckDetail } from "@/lib/uploads/photoCheckDetail";
import { galleryItemMetaFields } from "@/lib/validators/galleryItemMeta";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(1, "Name is required").max(100).trim(),
  description: z.string().trim().max(2000).optional(),
  items: z
    .array(
      z.object({
        assetId: z.string().min(1).max(300),
        url: z.string().url().max(1000),
        width: z.number().int().positive().max(20000).optional(),
        height: z.number().int().positive().max(20000).optional(),
        format: z.string().max(20).optional(),
        sizeBytes: z.number().int().nonnegative().optional(),
        caption: z.string().max(2000).optional(),
        altText: z.string().max(300).optional(),
        ...galleryItemMetaFields,
      })
    )
    .max(50)
    .default([]),
});

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "collection";
}

/**
 * POST /api/portfolio/gallery/collections
 *
 * Creates a new GalleryCollection with optional starter items.
 * Owner-only; non-owners receive 403.
 *
 * Response: { id: string, name: string, slug: string, description: string }
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

  const { name, description, items } = parsed.data;
  const workspaceId = ctx.workspace._id;

  if (items.length > 0) {
    const ownershipResults = await Promise.all(
      items.map((img) => verifyImageOwnership(img.assetId, workspaceId.toString()))
    );
    if (ownershipResults.some((ok) => !ok)) {
      return NextResponse.json({ error: "invalid_image_ownership" }, { status: 400 });
    }
  }

  // Server-side photo validation — format, size, and dimensions for every starter item.
  for (const img of items) {
    const photoMeta = { format: img.format, sizeBytes: img.sizeBytes, width: img.width, height: img.height };
    const photoCheck = validatePhotoMeta(photoMeta, PORTFOLIO_PHOTO_MAX_BYTES);
    if (!photoCheck.ok) {
      return NextResponse.json(
        {
          error: photoCheck.reason,
          detail: photoCheckDetail(photoCheck.reason, photoMeta, PORTFOLIO_PHOTO_MAX_BYTES),
          assetId: img.assetId,
        },
        { status: 400 }
      );
    }
  }

  await connectDB();

  // Derive a unique slug — append a short random suffix when the base collides.
  const baseSlug = makeSlug(name);
  let slug = baseSlug;
  const existing = await GalleryCollection.findOne({ workspaceId, slug }).lean();
  if (existing) {
    slug = `${baseSlug}-${Math.floor(Math.random() * 9000) + 1000}`;
  }

  const session = await mongoose.startSession();
  let collectionId: string;
  try {
    await session.withTransaction(async () => {
      const [collection] = await GalleryCollection.create(
        [{ workspaceId, name, slug, isPublic: true, order: 0, description: description ?? "" }],
        { session }
      );

      if (items.length > 0) {
        const docs = items.map((img, i) => ({
          workspaceId,
          collectionId: collection._id,
          assetId: img.assetId,
          url: img.url,
          width: img.width ?? null,
          height: img.height ?? null,
          format: img.format ?? null,
          sizeBytes: img.sizeBytes ?? 0,
          caption: img.caption ?? "",
          altText: img.altText ?? "",
          title: img.title ?? "",
          date: img.date ?? "",
          location: img.location ?? "",
          client: img.client ?? "",
          tags: img.tags ?? [],
          meta: img.meta ?? [],
          order: i,
        }));
        const createdItems = await GalleryItem.create(docs, { session, ordered: true });

        // Set the first item as the cover.
        if (createdItems[0]) {
          await GalleryCollection.updateOne(
            { _id: collection._id, workspaceId },
            { $set: { coverItemId: createdItems[0]._id } },
            { session }
          );
        }
      }

      collectionId = String(collection._id);
    });
  } catch (err) {
    console.error("[portfolio/gallery/collections] create failed:", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  } finally {
    await session.endSession();
  }

  return NextResponse.json({ id: collectionId!, name, slug, description: description ?? "" }, { status: 201 });
}
