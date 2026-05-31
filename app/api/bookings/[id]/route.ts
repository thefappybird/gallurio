import { NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getTeamsForUser } from "@/lib/auth/teamContext";
import { canEditBooking, canWriteBookingForTeam } from "@/lib/auth/canEditBooking";
import { resolveBookingTeamScope } from "@/lib/auth/bookingTeamScope";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, ActivityLog, Client, Team } from "@/lib/db/models";
import { bookingPatchSchema, type EditableKey } from "@/lib/validators/booking";
import { reassignBookingBetweenClients } from "@/lib/db/clientTransactions";
import { sessionsAreSameDayInTz, FALLBACK_TZ } from "@/lib/bookings/session-validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Fetches and shapes the client sub-document for a booking response. */
async function buildClientBlock(
  clientId: mongoose.Types.ObjectId | null | undefined,
  workspaceId: mongoose.Types.ObjectId
) {
  if (!clientId) return null;
  const clientDoc = await Client.findOne({
    _id: clientId,
    workspaceId,
  })
    .select({ _id: 1, name: 1, email: 1, phone: 1 })
    .lean();
  if (!clientDoc) return null;
  return {
    id: clientDoc._id.toString(),
    name: clientDoc.name,
    email: clientDoc.email ?? null,
    phone: clientDoc.phone ?? null,
  };
}

export async function GET(_req: Request, { params }: Params) {
  const ctx = await requireOrg();
  const { id } = await params;

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();

  // Team-scope the read for non-owners: a member can only fetch a booking owned
  // by a team they belong to. Owners (scope === undefined) see everything.
  const scope = await resolveBookingTeamScope(ctx);
  const query: Record<string, unknown> = { _id: id, workspaceId: ctx.workspace._id };
  if (scope !== undefined) query.teamId = { $in: scope };

  const booking = await Booking.findOne(query).lean();

  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const client = await buildClientBlock(booking.clientId, ctx.workspace._id);

  return NextResponse.json({ ...booking, client });
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

  // Team-scope the lookup for non-owners so a member cannot probe — via a
  // 403-vs-404 oracle — which booking ids exist on teams they can't see. A
  // cross-team id returns a uniform 404, matching GET. The canEditBooking check
  // below still distinguishes member-vs-lead and active-vs-inactive within a
  // team the caller CAN see.
  const scope = await resolveBookingTeamScope(ctx);
  const existingFilter: Record<string, unknown> = {
    _id: id,
    workspaceId: ctx.workspace._id,
  };
  if (scope !== undefined) existingFilter.teamId = { $in: scope };

  const existing = await Booking.findOne(existingFilter);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Edit authorization. Owners may edit any booking (incl. one whose team was
  // since deactivated). Non-owners must be a lead of the booking's still-active
  // team — plain members are view-only. Owners short-circuit without the extra
  // membership/team lookups.
  if (ctx.role !== "owner") {
    const memberships = await getTeamsForUser(ctx.workspace._id, ctx.userId);
    let team: { id: string; isActive: boolean } | null = null;
    if (existing.teamId) {
      const t = await Team.findOne({
        _id: existing.teamId,
        workspaceId: ctx.workspace._id,
      })
        .select({ _id: 1, isActive: 1 })
        .lean();
      if (t) team = { id: String(t._id), isActive: t.isActive };
    }
    const allowed = canEditBooking(
      { role: ctx.role, memberships },
      { teamId: existing.teamId ? String(existing.teamId) : null },
      team
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Team reassignment (optional). The target team must belong to the workspace,
  // be ACTIVE, and be writable by the caller (owner always; lead of that team).
  // Applied via setOp below so it persists in whichever update path runs.
  let teamReassignment: { from: string | null; to: mongoose.Types.ObjectId } | null = null;
  if (parsed.data.teamId && parsed.data.teamId !== String(existing.teamId ?? "")) {
    const target = await Team.findOne({
      _id: parsed.data.teamId,
      workspaceId: ctx.workspace._id,
    })
      .select({ _id: 1, isActive: 1 })
      .lean();
    if (!target) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    if (!target.isActive) {
      return NextResponse.json(
        { error: "Cannot assign a booking to a deactivated team" },
        { status: 400 }
      );
    }
    const memberships =
      ctx.role === "owner" ? [] : await getTeamsForUser(ctx.workspace._id, ctx.userId);
    if (
      !canWriteBookingForTeam(
        { role: ctx.role, memberships },
        { id: String(target._id), isActive: true }
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    teamReassignment = {
      from: existing.teamId ? String(existing.teamId) : null,
      to: target._id,
    };
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
    // Skip clientId + teamId here — both are validated and applied separately.
    if (k === "clientId" || k === "teamId") continue;
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

  // Apply the validated team reassignment into the same $set + activity diff.
  if (teamReassignment) {
    setOp.teamId = teamReassignment.to;
    diff.teamId = { before: teamReassignment.from, after: String(teamReassignment.to) };
  }

  const isClientChange = !!newClientId;

  if (Object.keys(setOp).length === 0 && !isClientChange) {
    const client = await buildClientBlock(
      existing.clientId as mongoose.Types.ObjectId | null | undefined,
      ctx.workspace._id
    );
    return NextResponse.json({ ...existing.toObject(), client });
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
            // Carry the post-patch team (a same-request team reassignment wins).
            teamId: teamReassignment ? teamReassignment.to : existing.teamId,
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

  const client = await buildClientBlock(
    updated?.clientId as mongoose.Types.ObjectId | null | undefined,
    ctx.workspace._id
  );

  return NextResponse.json({ ...updated, client });
}
