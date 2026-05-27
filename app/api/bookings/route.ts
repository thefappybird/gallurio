import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client, ActivityLog } from "@/lib/db/models";
import { bookingCreateSchema } from "@/lib/validators/booking";
import { recordBookingForClient } from "@/lib/db/clientTransactions";
import { sessionsAreSameDayInTz, FALLBACK_TZ } from "@/lib/bookings/session-validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = await requireOrg();

  const json = await req.json().catch(() => ({}));
  const parsed = bookingCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  await connectDB();

  const { client, title, eventType, status, sessions, location, amount, notes } =
    parsed.data;

  // Authoritative timezone-aware midnight check.
  // The Zod UTC-day check above is a cheap baseline; this is the definitive guard.
  const tzCheck = sessionsAreSameDayInTz(
    sessions,
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

  // Validate existing-client ownership BEFORE starting the transaction so we
  // can return a clean 404 without wasting a session.
  if (client.mode === "existing") {
    const existing = await Client.findOne({
      _id: client.clientId,
      workspaceId: ctx.workspace._id,
    }).lean();
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
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
          throw new Error("Client not found");
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
              source: "manual",
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
            clientId,
            clientName,
            title,
            eventType,
            status,
            sessions,
            firstSessionStart,
            lastSessionEnd,
            location: { address: location.address },
            amount: {
              total: amount.total,
              deposit: amount.deposit,
              currency: amount.currency,
            },
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
        },
        source: "manual",
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  return NextResponse.json({ id: bookingId!.toString() }, { status: 201 });
}
