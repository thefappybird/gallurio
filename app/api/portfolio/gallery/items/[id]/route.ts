import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrg } from "@/lib/auth/apiOrgContext";
import { updateItemMeta } from "@/lib/db/queries/gallery";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    altText: z.string().trim().max(300).optional(),
    caption: z.string().trim().max(300).optional(),
  })
  .refine((d) => d.altText !== undefined || d.caption !== undefined, { message: "invalid_input" });

/**
 * PATCH /api/portfolio/gallery/items/[id]
 *
 * Updates a GalleryItem's `altText` and/or `caption`. `altText` describes
 * what the image shows — for non-visual users and search engines. `caption`
 * is optional visible context. They are distinct: sending only one field
 * never overwrites the other (see updateItemMeta). Never derive alt text
 * from a raw filename.
 *
 * Owner-only. Tenant-scoped — an item belonging to another workspace resolves
 * to the same 404 as a missing item, so existence is never leaked cross-tenant.
 *
 * Response: 200 with the updated PickerItem.
 */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireApiOrg();
  if (!auth.ok) return auth.response;
  const ctx = auth.ctx;
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "owner_only" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const { id } = await params;

  const json = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "invalid_input" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const item = await updateItemMeta({
    workspaceId: ctx.workspace._id.toString(),
    itemId: id,
    ...parsed.data,
  });
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(item, { status: 200, headers: { "Cache-Control": "no-store" } });
}
