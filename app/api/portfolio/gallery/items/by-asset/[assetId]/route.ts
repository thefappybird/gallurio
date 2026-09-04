import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrg } from "@/lib/auth/apiOrgContext";
import { findItemByAsset, updateItemMetaByAsset } from "@/lib/db/queries/gallery";
import { galleryItemMetaFields } from "@/lib/validators/galleryItemMeta";

export const runtime = "nodejs";

type Params = { params: Promise<{ assetId: string }> };

const NO_STORE = { "Cache-Control": "no-store" } as const;

const patchSchema = z
  .object({
    altText: z.string().trim().max(300).optional(),
    caption: z.string().trim().max(2000).optional(),
    ...galleryItemMetaFields,
  })
  .refine((d) => Object.keys(d).length > 0, { message: "invalid_input" });

/**
 * Metadata for a photo addressed by its Cloudflare asset id rather than by a
 * GalleryItem id.
 *
 * An Image block on the page stores only `_style.bgImagePublicId` — it has no
 * GalleryItem id to work with — so the editor's Content tab needs this
 * indirection to read and write the photo's title, description, date, location,
 * client and freeform rows.
 *
 * One asset can back several GalleryItem docs: adding the same photograph to a
 * second collection copies the row, which is what the {workspaceId, assetId}
 * index exists for. Reads return the newest as the representative; writes go to
 * every copy, because the editor tells the owner these details live on the
 * photo and that editing them updates every place it appears. Writing only the
 * representative would leave one photograph titled differently in two
 * collections — precisely the surprise that wording rules out.
 *
 * Owner-only and tenant-scoped: an asset belonging to another workspace returns
 * the same 404 as one that does not exist, so existence never leaks.
 */
async function ownerContext() {
  const auth = await requireApiOrg();
  if (!auth.ok) return { ok: false as const, response: auth.response };
  if (auth.ctx.role !== "owner") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "owner_only" }, { status: 403, headers: NO_STORE }),
    };
  }
  return { ok: true as const, workspaceId: auth.ctx.workspace._id.toString() };
}

/** GET /api/portfolio/gallery/items/by-asset/[assetId] */
export async function GET(_req: Request, { params }: Params) {
  const auth = await ownerContext();
  if (!auth.ok) return auth.response;

  const { assetId } = await params;
  const item = await findItemByAsset({ workspaceId: auth.workspaceId, assetId });
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json(item, { headers: NO_STORE });
}

/** PATCH /api/portfolio/gallery/items/by-asset/[assetId] */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await ownerContext();
  if (!auth.ok) return auth.response;

  const { assetId } = await params;

  const json = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "invalid_input" },
      { status: 400, headers: NO_STORE }
    );
  }

  const result = await updateItemMetaByAsset({
    workspaceId: auth.workspaceId,
    assetId,
    ...parsed.data,
  });
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }

  // `matched` lets the editor say "updated in 3 places" rather than implying a
  // single-row write, which would understate what just happened.
  return NextResponse.json({ ...result.item, matched: result.matched }, { headers: NO_STORE });
}
