import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client, ActivityLog } from "@/lib/db/models";
import { bookingCreateSchema } from "@/lib/validators/booking";

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

  const booking = await Booking.create({
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
  });

  await ActivityLog.create({
    workspaceId: ctx.workspace._id,
    actorUserId: ctx.userId,
    entity: "booking",
    entityId: booking._id,
    action: "created",
  });

  return NextResponse.json({ id: booking._id.toString() }, { status: 201 });
}
