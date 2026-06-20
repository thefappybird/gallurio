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
      // Only advance the index for ids that actually belong to this collection,
      // so foreign/stale ids don't leave gaps that shift the saved order.
      let order = 0;
      for (const itemId of validIds) {
        const result = await GalleryItem.updateOne(
          { _id: itemId, workspaceId, collectionId: id },
          { $set: { order } },
          { session }
        );
        if (result.matchedCount > 0) order += 1;
      }
    });
  } finally {
    await session.endSession();
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
