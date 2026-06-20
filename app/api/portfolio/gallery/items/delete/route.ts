import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrg } from "@/lib/auth/apiOrgContext";
import { deleteItemsByAssetId } from "@/lib/db/queries/gallery";
import { deleteImage } from "@/lib/storage/cloudflareImages";

export const runtime = "nodejs";

const bodySchema = z.object({ itemIds: z.array(z.string().min(1).max(64)).min(1).max(200) });

export async function POST(req: Request) {
  const auth = await requireApiOrg();
  if (!auth.ok) return auth.response;
  const ctx = auth.ctx;
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "invalid_input" }, { status: 400 });
  }

  const workspaceId = ctx.workspace._id.toString();
  const { assetIds, deletedDocs } = await deleteItemsByAssetId({ workspaceId, itemIds: parsed.data.itemIds });

  let assetsFailed = 0;
  await Promise.all(
    assetIds.map(async (assetId) => {
      try {
        await deleteImage(assetId);
      } catch (err) {
        assetsFailed += 1;
        console.error(`[portfolio/gallery/items/delete] CF Images delete failed for ${assetId}:`, err);
      }
    })
  );

  return NextResponse.json(
    { deletedDocs, assetsDestroyed: assetIds.length - assetsFailed, assetsFailed },
    { status: 200 }
  );
}
