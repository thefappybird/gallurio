import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, ActivityLog } from "@/lib/db/models";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 50;

export async function GET(req: Request, { params }: Params) {
  const ctx = await requireOrg();
  const { id } = await params;

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(
    1,
    Math.min(
      MAX_PAGE_SIZE,
      Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE
    )
  );

  await connectDB();

  // Ownership guard — never expose another workspace's activity, even accidentally.
  const exists = await Booking.exists({ _id: id, workspaceId: ctx.workspace._id });
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filter = {
    workspaceId: ctx.workspace._id,
    entity: "booking" as const,
    entityId: id,
  };

  const [entries, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ActivityLog.countDocuments(filter),
  ]);

  return NextResponse.json({ entries, total, page, pageSize });
}
