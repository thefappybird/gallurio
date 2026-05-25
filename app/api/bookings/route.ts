import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client, ActivityLog } from "@/lib/db/models";
import { bookingCreateSchema } from "@/lib/validators/booking";
import { recordBookingForClient } from "@/lib/db/clientTransactions";

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

  let clientId;
  let clientName: string;

  if (client.mode === "existing") {
    const existing = await Client.findOne({
      _id: client.clientId,
      workspaceId: ctx.workspace._id,
    }).lean();
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    clientId = existing._id;
    clientName = existing.name;
  } else {
    const created = await Client.create({
      workspaceId: ctx.workspace._id,
      name: client.name,
      email: client.email ?? null,
      phone: client.phone ?? null,
      source: "manual",
    });
    clientId = created._id;
    clientName = created.name;
  }

  // Compute denormalized bounds explicitly — Booking.create() runs pre("save")
  // but being explicit makes it safe even if hooks ever get skipped.
  const sessionStarts = sessions.map((s) => s.startAt.getTime());
  const sessionEnds = sessions.map((s) => s.endAt.getTime());
  const firstSessionStart = new Date(Math.min(...sessionStarts));
  const lastSessionEnd = new Date(Math.max(...sessionEnds));

  // Wrap Booking.create and recordBookingForClient in a single transaction so
  // that a failure in either write leaves no partial state in the database.
  const session = await mongoose.startSession();
  let bookingId: mongoose.Types.ObjectId;

  try {
    await session.withTransaction(async () => {
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
