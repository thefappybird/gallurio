import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose, { isValidObjectId } from "mongoose";
import { requireApiOrg } from "@/lib/auth/apiOrgContext";
import { GalleryCollection, GalleryItem } from "@/lib/db/models";
import { connectDB } from "@/lib/db/mongoose";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ orderedItemIds: z.array(z.string().min(1).max(64)).min(1).max(500) });

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

  const workspaceId = ctx.workspace._id;
  await connectDB();
  const collection = await GalleryCollection.findOne({ _id: id, workspaceId }).select({ _id: 1 }).lean();
  if (!collection) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const validIds = parsed.data.orderedItemIds.filter((x) => isValidObjectId(x));
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Batch: one find to know which ids actually belong to this collection,
      // then one bulkWrite for all matching updates -- 2 round trips total
      // instead of one updateOne per item. Order only advances for ids that
      // actually match (preserves the original "no gap" behavior: a
      // foreign/stale id doesn't consume an order slot).
      const existing = await GalleryItem.find(
        { _id: { $in: validIds }, workspaceId, collectionId: id },
        { _id: 1 }
      ).session(session).lean();
      const existingIdSet = new Set(existing.map((d) => String(d._id)));

      const ops: Parameters<typeof GalleryItem.bulkWrite>[0] = [];
      let order = 0;
      for (const itemId of validIds) {
        if (!existingIdSet.has(itemId)) continue;
        ops.push({
          updateOne: {
            filter: { _id: itemId, workspaceId, collectionId: id },
            update: { $set: { order } },
          },
        });
        order += 1;
      }
      if (ops.length > 0) {
        await GalleryItem.bulkWrite(ops, { session });
      }
    });
  } finally {
    await session.endSession();
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
