import { NextResponse } from "next/server";
import { requireApiOrg } from "@/lib/auth/apiOrgContext";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client } from "@/lib/db/models";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET() {
  const auth = await requireApiOrg();
  if (!auth.ok) return auth.response;
  if (auth.ctx.role !== "owner") {
    return NextResponse.json({ error: "owner_only" }, { status: 403, headers: NO_STORE });
  }

  await connectDB();
  const workspaceId = auth.ctx.workspace._id;
  const [bookings, clients] = await Promise.all([
    Booking.find({ workspaceId, status: { $in: ["booked", "completed"] } })
      .select({ _id: 1, title: 1, clientId: 1, clientName: 1, firstSessionStart: 1, location: 1 })
      .sort({ firstSessionStart: -1, _id: -1 })
      .limit(100)
      .lean(),
    Client.find({ workspaceId, isActive: true })
      .select({ _id: 1, name: 1, email: 1 })
      .sort({ name: 1, _id: 1 })
      .limit(250)
      .lean(),
  ]);

  return NextResponse.json({
    bookings: bookings.map((booking) => ({
      id: String(booking._id),
      title: booking.title,
      clientId: String(booking.clientId),
      clientName: booking.clientName,
      date: booking.firstSessionStart ? new Date(booking.firstSessionStart).toISOString().slice(0, 10) : "",
      location: booking.location?.address || booking.location?.label || "",
    })),
    clients: clients.map((client) => ({
      id: String(client._id),
      name: client.name,
      email: client.email ?? null,
    })),
  }, { headers: NO_STORE });
}
