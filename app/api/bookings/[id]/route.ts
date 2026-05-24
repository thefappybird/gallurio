import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, ActivityLog } from "@/lib/db/models";
import { bookingPatchSchema, type EditableKey } from "@/lib/validators/booking";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const ctx = await requireOrg();
  const { id } = await params;

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();
  const booking = await Booking.findOne({
    _id: id,
    workspaceId: ctx.workspace._id,
  }).lean();

  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(booking);
}

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await requireOrg();
  const { id } = await params;

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = bookingPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  await connectDB();

  const existing = await Booking.findOne({
    _id: id,
    workspaceId: ctx.workspace._id,
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Map dotted-path keys to nested Mongo $set paths and capture before/after.
  const setOp: Record<string, unknown> = {};
  const diff: Record<string, { before: unknown; after: unknown }> = {};

  const beforeOf = (key: EditableKey): unknown => {
    switch (key) {
      case "location.address":
        return existing.location?.address ?? null;
      case "amount.total":
        return existing.amount?.total ?? null;
      case "amount.deposit":
        return existing.amount?.deposit ?? null;
      case "amount.currency":
        return existing.amount?.currency ?? null;
      case "sessions":
        return existing.sessions ?? null;
      default:
        return existing[key as keyof typeof existing] ?? null;
    }
  };

  for (const [key, value] of Object.entries(parsed.data)) {
    const k = key as EditableKey;
    const before = beforeOf(k);
    // For sessions arrays, always treat as changed (deep equality is expensive
    // and the client only sends sessions when it intends to update).
    if (k !== "sessions" && before === value) continue;
    setOp[k] = value;
    diff[k] = { before, after: value };
  }

  // When sessions are being updated, recompute denormalized bounds in the
  // same $set — updateOne skips the pre("save") hook.
  if ("sessions" in setOp) {
    const sessions = setOp.sessions as { startAt: Date | string; endAt: Date | string }[];
    const starts = sessions.map((s) => new Date(s.startAt).getTime());
    const ends = sessions.map((s) => new Date(s.endAt).getTime());
    setOp.firstSessionStart = new Date(Math.min(...starts));
    setOp.lastSessionEnd = new Date(Math.max(...ends));
  }

  if (Object.keys(setOp).length === 0) {
    return NextResponse.json(existing.toObject());
  }

  await Booking.updateOne(
    { _id: id, workspaceId: ctx.workspace._id },
    { $set: setOp }
  );

  await ActivityLog.create({
    workspaceId: ctx.workspace._id,
    actorUserId: ctx.userId,
    entity: "booking",
    entityId: existing._id,
    action: "status" in setOp ? "status_changed" : "updated",
    diff: { changes: diff },
  });

  const updated = await Booking.findOne({
    _id: id,
    workspaceId: ctx.workspace._id,
  }).lean();
  return NextResponse.json(updated);
}
