import { NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, ActivityLog, Client } from "@/lib/db/models";
import { bookingPatchSchema, type EditableKey } from "@/lib/validators/booking";
import { reassignBookingBetweenClients } from "@/lib/db/clientTransactions";

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

  // Block client reassignment on multi-session bookings.
  const incomingClientId = parsed.data.clientId;
  if (
    incomingClientId &&
    incomingClientId !== String(existing.clientId) &&
    Array.isArray(existing.sessions) &&
    existing.sessions.length > 1
  ) {
    return NextResponse.json(
      { error: "Cannot change client on a multi-session booking" },
      { status: 422 }
    );
  }

  // When clientId is being changed, resolve the new client's canonical name
  // and validate it belongs to the same workspace.
  let newClientId: mongoose.Types.ObjectId | undefined;
  let newClientName: string | undefined;
  const oldClientId = existing.clientId as mongoose.Types.ObjectId;

  if (incomingClientId && incomingClientId !== String(existing.clientId)) {
    if (!isValidObjectId(incomingClientId)) {
      return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
    }
    const newClient = await Client.findOne({
      _id: incomingClientId,
      workspaceId: ctx.workspace._id,
    }).lean();
    if (!newClient) {
      return NextResponse.json(
        { error: "Client not found in this workspace" },
        { status: 404 }
      );
    }
    newClientId = newClient._id;
    newClientName = newClient.name;
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
      case "clientId":
        return String(existing.clientId ?? null);
      default:
        return existing[key as keyof typeof existing] ?? null;
    }
  };

  for (const [key, value] of Object.entries(parsed.data)) {
    const k = key as EditableKey;
    // Skip clientId here — handled separately with transaction logic below.
    if (k === "clientId") continue;
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

  const isClientChange = !!newClientId;

  if (Object.keys(setOp).length === 0 && !isClientChange) {
    return NextResponse.json(existing.toObject());
  }

  if (isClientChange) {
    // Client reassignment: wrap everything in a transaction so booking update,
    // transaction history reconciliation, and activity log are all atomic.
    const mongoSession = await mongoose.startSession();
    try {
      await mongoSession.withTransaction(async () => {
        // Update booking with new clientId and canonical clientName.
        const clientSetOp: Record<string, unknown> = {
          ...setOp,
          clientId: newClientId,
          clientName: newClientName,
        };

        if ("sessions" in setOp) {
          // already included in setOp
        }

        await Booking.updateOne(
          { _id: id, workspaceId: ctx.workspace._id },
          { $set: clientSetOp },
          { session: mongoSession }
        );

        // Reconcile transaction history between old and new clients.
        await reassignBookingBetweenClients({
          workspaceId: ctx.workspace._id,
          fromClientId: oldClientId,
          toClientId: newClientId!,
          booking: {
            _id: existing._id,
            amount: {
              total: existing.amount?.total ?? 0,
              deposit: existing.amount?.deposit ?? 0,
              currency: existing.amount?.currency ?? "PHP",
            },
            firstSessionStart: existing.firstSessionStart,
          },
          session: mongoSession,
        });

        // Write activity log with client_changed action and meta.
        await ActivityLog.create(
          [
            {
              workspaceId: ctx.workspace._id,
              actorUserId: ctx.userId,
              entity: "booking",
              entityId: existing._id,
              action: "client_changed",
              diff: Object.keys(diff).length > 0 ? { changes: diff } : null,
              meta: {
                from: String(oldClientId),
                to: String(newClientId),
              },
            },
          ],
          { session: mongoSession }
        );
      });
    } finally {
      await mongoSession.endSession();
    }
  } else {
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
  }

  const updated = await Booking.findOne({
    _id: id,
    workspaceId: ctx.workspace._id,
  }).lean();
  return NextResponse.json(updated);
}
