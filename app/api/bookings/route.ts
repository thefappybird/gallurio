import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getTeamsForUser } from "@/lib/auth/teamContext";
import { canWriteBookingForTeam } from "@/lib/auth/canEditBooking";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client, ActivityLog, Team } from "@/lib/db/models";
import { bookingCreateSchema } from "@/lib/validators/booking";
import { recordBookingForClient, syncBookingPaymentsForClient } from "@/lib/db/clientTransactions";
import { sessionsAreSameDayInTz, FALLBACK_TZ } from "@/lib/bookings/session-validation";
import { normalizePayments, isCompletionEligible } from "@/lib/bookings/payment-rules";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = await requireOrg();

  const json = await req.json().catch(() => ({}));
  const parsed = bookingCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400 }
    );
  }

  await connectDB();

  const { client, teamId, title, eventType, status, sessions, location, amount, notes, payments } =
    parsed.data;

  const normalizedPayments = normalizePayments(payments);
  if (status === "completed" && !isCompletionEligible(normalizedPayments, amount)) {
    return NextResponse.json({ error: "completion_requires_full_payment" }, { status: 422 });
  }

  // Resolve + authorize the target team before any writes. New bookings may only
  // target an ACTIVE team in this workspace that the caller may write to (owner
  // always; lead of that team). Members are view-only (see canWriteBookingForTeam).
  const team = await Team.findOne({ _id: teamId, workspaceId: ctx.workspace._id })
    .select({ _id: 1, isActive: 1 })
    .lean();
  if (!team) {
    return NextResponse.json({ error: "team_not_found" }, { status: 404 });
  }
  // Treat a missing isActive (legacy teams created before the field existed) as
  // active — only an EXPLICIT false counts as deactivated. (.lean() doesn't apply
  // the schema default.)
  if (team.isActive === false) {
    return NextResponse.json(
      { error: "team_deactivated" },
      { status: 400 }
    );
  }
  const memberships =
    ctx.role === "owner" ? [] : await getTeamsForUser(ctx.workspace._id, ctx.userId);
  if (
    !canWriteBookingForTeam(
      { role: ctx.role, memberships },
      { id: String(team._id), isActive: true }
    )
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Authoritative timezone-aware midnight check.
  // The Zod UTC-day check above is a cheap baseline; this is the definitive guard.
  const tzCheck = sessionsAreSameDayInTz(
    sessions,
    ctx.workspace.timezone ?? FALLBACK_TZ
  );
  if (!tzCheck.ok) {
    return NextResponse.json(
      { error: "session_crosses_midnight", params: { index: tzCheck.sessionIndex } },
      { status: 400 }
    );
  }

  // Validate existing-client ownership BEFORE starting the transaction so we
  // can return a clean 404 without wasting a session.
  if (client.mode === "existing") {
    const existing = await Client.findOne({
      _id: client.clientId,
      workspaceId: ctx.workspace._id,
    }).lean();
    if (!existing) {
      return NextResponse.json({ error: "client_not_found_workspace" }, { status: 404 });
    }
  }

  // Compute denormalized bounds explicitly — Booking.create() runs pre("save")
  // but being explicit makes it safe even if hooks ever get skipped.
  const sessionStarts = sessions.map((s) => s.startAt.getTime());
  const sessionEnds = sessions.map((s) => s.endAt.getTime());
  const firstSessionStart = new Date(Math.min(...sessionStarts));
  const lastSessionEnd = new Date(Math.max(...sessionEnds));

  // All writes — including client creation for new clients — happen inside one
  // transaction so that a failure in any step leaves no orphan documents.
  const session = await mongoose.startSession();
  let bookingId: mongoose.Types.ObjectId;

  try {
    await session.withTransaction(async () => {
      let clientId: mongoose.Types.ObjectId;
      let clientName: string;

      if (client.mode === "existing") {
        // Re-read inside the transaction to lock the document in the session.
        const existing = await Client.findOne(
          { _id: client.clientId, workspaceId: ctx.workspace._id },
          null,
          { session }
        ).lean();
        if (!existing) {
          throw new Error("client_not_found_workspace");
        }
        clientId = existing._id;
        clientName = existing.name;
      } else {
        const [created] = await Client.create(
          [
            {
              workspaceId: ctx.workspace._id,
              name: client.name,
              email: client.email ?? null,
              phone: client.phone ?? null,
              source: client.source,
              tags: client.tags,
              notes: client.notes,
            },
          ],
          { session }
        );
        clientId = created._id;
        clientName = created.name;
      }

      const [booking] = await Booking.create(
        [
          {
            workspaceId: ctx.workspace._id,
            teamId: team._id,
            clientId,
            clientName,
            title,
            eventType,
            status,
            sessions,
            firstSessionStart,
            lastSessionEnd,
            location: {
              address: location.address,
              lat: location.lat,
              lng: location.lng,
            },
            amount: {
              total: amount.total,
              deposit: amount.deposit,
              currency: amount.currency,
            },
            payments: normalizedPayments,
            notes,
          },
        ],
        { session }
      );

      bookingId = booking._id;

      await ActivityLog.create(
        [
          {
            workspaceId: ctx.workspace._id,
            actorUserId: ctx.userId,
            entity: "booking",
            entityId: booking._id,
            action: "created",
          },
        ],
        { session }
      );

      await recordBookingForClient({
        workspaceId: ctx.workspace._id,
        clientId,
        booking: {
          _id: booking._id,
          amount: booking.amount!,
          firstSessionStart: booking.firstSessionStart,
          teamId: booking.teamId,
        },
        source: "manual",
        session,
      });
      await syncBookingPaymentsForClient({
        workspaceId: ctx.workspace._id,
        clientId,
        booking: {
          _id: booking._id,
          teamId: booking.teamId,
          amount: { currency: booking.amount!.currency },
          payments: booking.payments ?? [],
        },
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  return NextResponse.json({ id: bookingId!.toString() }, { status: 201 });
}
