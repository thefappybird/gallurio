import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { deleteItemsByPublicId } from "@/lib/db/queries/gallery";
import { destroyAsset } from "@/lib/storage/cloudinary";

export const runtime = "nodejs";

const bodySchema = z.object({ itemIds: z.array(z.string().min(1).max(64)).min(1).max(200) });

export async function POST(req: Request) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "invalid_input" }, { status: 400 });
  }

  const workspaceId = ctx.workspace._id.toString();
  const { publicIds, deletedDocs } = await deleteItemsByPublicId({ workspaceId, itemIds: parsed.data.itemIds });

  let assetsFailed = 0;
  await Promise.all(
    publicIds.map(async (pid) => {
      try {
        await destroyAsset(pid);
      } catch (err) {
        assetsFailed += 1;
        console.error(`[portfolio/gallery/items/delete] cloudinary destroy failed for ${pid}:`, err);
      }
    })
  );

  return NextResponse.json(
    { deletedDocs, assetsDestroyed: publicIds.length - assetsFailed, assetsFailed },
    { status: 200 }
  );
}
