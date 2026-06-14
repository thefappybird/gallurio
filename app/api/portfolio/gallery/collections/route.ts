import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryCollection, GalleryItem } from "@/lib/db/models";
import { verifyImageOwnership } from "@/lib/storage/cloudflareImages";
import { validatePhotoMeta } from "@/lib/page-builder/photoSpec";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(1, "Name is required").max(100).trim(),
  items: z
    .array(
      z.object({
        assetId: z.string().min(1).max(300),
        url: z.string().url().max(1000),
        width: z.number().int().positive().max(20000).optional(),
        height: z.number().int().positive().max(20000).optional(),
        format: z.string().max(20).optional(),
        sizeBytes: z.number().int().nonnegative().optional(),
        caption: z.string().max(300).optional(),
        altText: z.string().max(300).optional(),
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
 * Response: { id: string, name: string, slug: string }
 */
export async function POST(req: Request) {
  const ctx = await requireOrg();
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

  const { name, items } = parsed.data;
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
    const photoCheck = validatePhotoMeta({
      format: img.format,
      sizeBytes: img.sizeBytes,
      width: img.width,
      height: img.height,
    });
    if (!photoCheck.ok) {
      return NextResponse.json({ error: photoCheck.reason }, { status: 400 });
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
        [{ workspaceId, name, slug, isPublic: true, order: 0 }],
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

  return NextResponse.json({ id: collectionId!, name, slug }, { status: 201 });
}
