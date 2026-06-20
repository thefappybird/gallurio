import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { requireApiOrg } from "@/lib/auth/apiOrgContext";
import { GalleryCollection } from "@/lib/db/models";
import { connectDB } from "@/lib/db/mongoose";
import { detachItemsFromCollection } from "@/lib/db/queries/gallery";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ itemIds: z.array(z.string().min(1).max(64)).min(1).max(200) });

export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiOrg();
  if (!auth.ok) return auth.response;
  const ctx = auth.ctx;
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "invalid_input" }, { status: 400 });
  }

  const workspaceId = ctx.workspace._id.toString();
  await connectDB();
  const collection = await GalleryCollection.findOne({ _id: id, workspaceId }).select({ _id: 1 }).lean();
  if (!collection) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const removed = await detachItemsFromCollection({ workspaceId, collectionId: id, itemIds: parsed.data.itemIds });
  return NextResponse.json({ removed }, { status: 200 });
}
