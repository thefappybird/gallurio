import { NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, ActivityLog, Client } from "@/lib/db/models";
import { bookingPatchSchema, type EditableKey } from "@/lib/validators/booking";
import { reassignBookingBetweenClients } from "@/lib/db/clientTransactions";
import { sessionsAreSameDayInTz, FALLBACK_TZ } from "@/lib/bookings/session-validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const ctx = await requireOrg();
  const { id } = await params;

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();
  // Drafts are inquiry placeholders, not real bookings — they're invisible to
  // the bookings surfaces (Phase 6 contract) and are only viewed via the lead
  // inbox. Excluding the draft status here keeps a draft id from pulling an
  // unapproved booking into the bookings drawer.
  const booking = await Booking.findOne({
    _id: id,
    workspaceId: ctx.workspace._id,
    status: { $ne: "draft" },
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

  // Drafts cannot be edited via the bookings API — promotion happens only
  // through the inquiry approval flow (which records client financials). A
  // direct PATCH would bypass that, so drafts 404 here too.
  const existing = await Booking.findOne({
    _id: id,
    workspaceId: ctx.workspace._id,
    status: { $ne: "draft" },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Authoritative timezone-aware midnight check for session patches.
  // The Zod UTC-day check is a cheap baseline; this is the definitive guard.
  if (parsed.data.sessions) {
    const tzCheck = sessionsAreSameDayInTz(
      parsed.data.sessions,
      ctx.workspace.timezone ?? FALLBACK_TZ
    );
    if (!tzCheck.ok) {
      return NextResponse.json(
        {
          error: `Session ${tzCheck.sessionIndex} crosses midnight in the workspace timezone`,
        },
        { status: 400 }
      );
    }
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
      case "location.lat":
        return existing.location?.lat ?? null;
      case "location.lng":
        return existing.location?.lng ?? null;
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

  // Raw map coordinates persist but are kept out of the human-readable activity
  // diff — a pin nudge shouldn't spam history; the address change carries the
  // meaning. A patch that only moves the pin therefore produces no log entry.
  const SILENT_KEYS = new Set<EditableKey>(["location.lat", "location.lng"]);

  for (const [key, value] of Object.entries(parsed.data)) {
    const k = key as EditableKey;
    // Skip clientId here — handled separately with transaction logic below.
    if (k === "clientId") continue;
    const before = beforeOf(k);
    // For sessions arrays, always treat as changed (deep equality is expensive
    // and the client only sends sessions when it intends to update).
    if (k !== "sessions" && before === value) continue;
    setOp[k] = value;
    if (!SILENT_KEYS.has(k)) diff[k] = { before, after: value };
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

        // Build a post-patch snapshot of the fields consumed by
        // reassignBookingBetweenClients. The booking document hasn't been
        // written yet (we're inside the transaction), so we merge setOp
        // onto the pre-patch values to derive what the new state will be.
        // This prevents the new client from being credited with stale
        // financial data when amount.* or sessions change in the same PATCH.
        const mergedAmountTotal =
          typeof (setOp["amount.total"] as number | undefined) === "number"
            ? (setOp["amount.total"] as number)
            : (existing.amount?.total ?? 0);
        const mergedAmountDeposit =
          typeof (setOp["amount.deposit"] as number | undefined) === "number"
            ? (setOp["amount.deposit"] as number)
            : (existing.amount?.deposit ?? 0);
        const mergedCurrency =
          typeof setOp["amount.currency"] === "string"
            ? (setOp["amount.currency"] as string)
            : (existing.amount?.currency ?? "PHP");

        // firstSessionStart is either already recomputed into setOp (when
        // sessions were updated in this same PATCH) or falls back to the
        // existing stored value.
        const mergedFirstSessionStart =
          setOp.firstSessionStart instanceof Date
            ? setOp.firstSessionStart
            : typeof setOp.firstSessionStart === "string"
              ? new Date(setOp.firstSessionStart)
              : existing.firstSessionStart;

        // Reconcile transaction history between old and new clients using
        // the merged (post-patch) financial snapshot, not the stale pre-patch
        // values stored on `existing`.
        await reassignBookingBetweenClients({
          workspaceId: ctx.workspace._id,
          fromClientId: oldClientId,
          toClientId: newClientId!,
          booking: {
            _id: existing._id,
            amount: {
              total: mergedAmountTotal,
              deposit: mergedAmountDeposit,
              currency: mergedCurrency,
            },
            firstSessionStart: mergedFirstSessionStart,
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

    // Skip the activity entry when the only change was a silent coordinate
    // nudge (diff is empty but setOp persisted lat/lng).
    if (Object.keys(diff).length > 0) {
      await ActivityLog.create({
        workspaceId: ctx.workspace._id,
        actorUserId: ctx.userId,
        entity: "booking",
        entityId: existing._id,
        action: "status" in setOp ? "status_changed" : "updated",
        diff: { changes: diff },
      });
    }
  }

  const updated = await Booking.findOne({
    _id: id,
    workspaceId: ctx.workspace._id,
  }).lean();
  return NextResponse.json(updated);
}
