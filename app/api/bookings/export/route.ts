import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client } from "@/lib/db/models";
import { serializeCsv } from "@/lib/utils/csv-serialize";

export const runtime = "nodejs";

const CSV_HEADERS = [
  "clientName",
  "clientEmail",
  "startAt",
  "endAt",
  "title",
  "eventType",
  "status",
  "amountTotal",
  "amountDeposit",
  "currency",
  "locationAddress",
  "notes",
  // booking_id and session_index are appended last so existing column positions are undisturbed
  "booking_id",
  "session_index",
] as const;

export async function GET(req: Request) {
  const ctx = await requireOrg();
  await connectDB();

  const params = new URL(req.url).searchParams;
  const status = params.get("status");
  const q = params.get("q");
  const includeCancelled = params.get("includeCancelled") === "1";
  const from = params.get("from");
  const to = params.get("to");

  const filter: Record<string, unknown> = { workspaceId: ctx.workspace._id };

  if (status) {
    filter.status = status;
  } else if (!includeCancelled) {
    filter.status = { $ne: "cancelled" };
  }

  if (q && q.trim()) {
    const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    filter.$or = [{ title: rx }, { clientName: rx }, { "location.address": rx }];
  }

  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) range.$lte = new Date(to);
    filter.firstSessionStart = range;
  }

  const bookings = await Booking.find(filter)
    .sort({ firstSessionStart: 1, _id: 1 })
    .limit(10_000)
    .lean();

  // Build email lookup from referenced clients — bookings store clientId, not email.
  const clientIds = Array.from(
    new Set(bookings.map((b) => b.clientId?.toString()).filter(Boolean))
  );
  const emailByClientId = new Map<string, string>();
  if (clientIds.length > 0) {
    const clients = await Client.find({
      _id: { $in: clientIds },
      workspaceId: ctx.workspace._id,
    })
      .select({ _id: 1, email: 1 })
      .lean();
    for (const c of clients) {
      emailByClientId.set(c._id.toString(), c.email ?? "");
    }
  }

  // Each booking emits one row per session so all date ranges are preserved on
  // round-trip. Importing such a CSV creates one single-session booking per row
  // (the original multi-session grouping is lost — known limitation).
  const rows: (string | number)[][] = [];
  for (const b of bookings) {
    const sessions = b.sessions as { startAt: Date; endAt: Date }[];
    const clientEmail = emailByClientId.get(b.clientId?.toString() ?? "") ?? "";
    const bookingId = b._id.toString();

    sessions.forEach((session, idx) => {
      rows.push([
        b.clientName ?? "",
        clientEmail,
        session.startAt ? new Date(session.startAt).toISOString() : "",
        session.endAt ? new Date(session.endAt).toISOString() : "",
        b.title ?? "",
        b.eventType ?? "",
        b.status ?? "",
        b.amount?.total ?? "",
        b.amount?.deposit ?? "",
        b.amount?.currency ?? "",
        b.location?.address ?? "",
        b.notes ?? "",
        bookingId,
        idx,
      ]);
    });
  }

  const csv = serializeCsv(CSV_HEADERS, rows);
  const datestamp = new Date().toISOString().slice(0, 10);
  const filename = `bookings-${datestamp}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
