import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryItem } from "@/lib/db/models";
import { cloudinaryThumbnailUrl } from "@/lib/storage/cloudinary";

export const runtime = "nodejs";

const bodySchema = z.object({
  cloudinaryPublicId: z.string().min(1).max(300),
  url: z.string().url().max(1000),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  format: z.string().max(20).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  caption: z.string().max(300).optional(),
  altText: z.string().max(300).optional(),
});

function makeWorkspacePrefixCheck(workspaceId: string) {
  const prefix = `gallurio/${workspaceId}/`;
  return (publicId: string) => !publicId.includes("..") && publicId.startsWith(prefix);
}

/**
 * POST /api/portfolio/gallery/items
 *
 * Creates a single GalleryItem (not tied to a collection) for the picker.
 * Owner-only; non-owners receive 403.
 *
 * Response: { id: string, thumbUrl: string, caption: string | null }
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

  const workspaceId = ctx.workspace._id;

  const prefixCheck = makeWorkspacePrefixCheck(workspaceId.toString());
  if (!prefixCheck(parsed.data.cloudinaryPublicId)) {
    return NextResponse.json({ error: "invalid_image_ownership" }, { status: 400 });
  }

  await connectDB();

  // Assign the next order index within this workspace (no collection = null).
  const existingCount = await GalleryItem.countDocuments({ workspaceId, collectionId: null });

  const item = await GalleryItem.create({
    workspaceId,
    collectionId: null,
    cloudinaryPublicId: parsed.data.cloudinaryPublicId,
    url: parsed.data.url,
    width: parsed.data.width ?? null,
    height: parsed.data.height ?? null,
    format: parsed.data.format ?? null,
    sizeBytes: parsed.data.sizeBytes ?? 0,
    caption: parsed.data.caption ?? "",
    altText: parsed.data.altText ?? "",
    order: existingCount,
  });

  const thumbUrl = cloudinaryThumbnailUrl(parsed.data.cloudinaryPublicId, {
    width: 200,
    height: 200,
  });

  return NextResponse.json(
    { id: String(item._id), thumbUrl, caption: parsed.data.caption ?? null },
    { status: 201 }
  );
}
