import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose, { isValidObjectId } from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { GalleryCollection, GalleryItem } from "@/lib/db/models";
import { connectDB } from "@/lib/db/mongoose";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ orderedItemIds: z.array(z.string().min(1).max(64)).min(1).max(500) });

export async function POST(req: Request, { params }: Params) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "invalid_input" }, { status: 400 });
  }

  const workspaceId = ctx.workspace._id;
  await connectDB();
  const collection = await GalleryCollection.findOne({ _id: id, workspaceId }).select({ _id: 1 }).lean();
  if (!collection) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const validIds = parsed.data.orderedItemIds.filter((x) => isValidObjectId(x));
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      let order = 0;
      for (const itemId of validIds) {
        await GalleryItem.updateOne({ _id: itemId, workspaceId, collectionId: id }, { $set: { order } }, { session });
        order += 1;
      }
    });
  } finally {
    await session.endSession();
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
