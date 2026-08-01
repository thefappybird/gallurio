import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client } from "@/lib/db/models";
import { serializeCsv, escapeSpreadsheetText } from "@/lib/utils/csv-serialize";
import { resolveBookingTeamScope } from "@/lib/auth/bookingTeamScope";
import { FALLBACK_TZ, localDayStart, dayBoundInTz } from "@/lib/utils/timezone";
import { Team } from "@/lib/db/models";
import { rowsToXlsxBuffer } from "@/lib/utils/xlsx";

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
  // Appended after the legacy block for the same reason. clientId/clientPhone/
  // locationLat/locationLng are importable; the rest are export-only context.
  "clientId",
  "clientPhone",
  "locationLat",
  "locationLng",
  "teamName",
  "invoiceNumber",
  "payments",
  "createdAt",
] as const;

/**
 * Columns whose content is authored by users and could therefore start with a
 * formula trigger. Numeric and enum columns are deliberately excluded — a
 * leading "-" there is a negative number, not an attack.
 */
const TEXT_COLUMNS = new Set([
  "clientName",
  "clientEmail",
  "clientPhone",
  "title",
  "locationAddress",
  "notes",
  "teamName",
  "invoiceNumber",
]);

function guard(column: string, value: unknown): string | number {
  if (typeof value === "number") return value;
  const text = value == null ? "" : String(value);
  return TEXT_COLUMNS.has(column) ? escapeSpreadsheetText(text) : text;
}

export async function GET(req: Request) {
  const ctx = await requireOrg();
  await connectDB();
  const scope = await resolveBookingTeamScope(ctx);

  const params = new URL(req.url).searchParams;
  const formatParam = params.get("format");
  if (formatParam !== null && formatParam !== "csv" && formatParam !== "xlsx") {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }
  const format = formatParam ?? "csv";
  const status = params.get("status");
  const q = params.get("q");
  // Opt-out convention: absent (or anything but "0") means the filter is ON.
  const includeCancelled = params.get("includeCancelled") !== "0";
  const showPast = params.get("showPast") !== "0";
  const from = params.get("from");
  const to = params.get("to");

  const filter: Record<string, unknown> = { workspaceId: ctx.workspace._id };
  if (scope !== undefined) filter.teamId = { $in: scope };

  // Narrowing to one team. A team id from a query string is untrusted twice
  // over: it has to belong to this workspace AND, for a non-owner, sit inside
  // the scope resolved above — otherwise this would read another team's
  // bookings by guessing an id. Both failures answer identically.
  const teamIdParam = params.get("teamId");
  if (teamIdParam) {
    const team = mongoose.isValidObjectId(teamIdParam)
      ? await Team.findOne({ _id: teamIdParam, workspaceId: ctx.workspace._id })
          .select({ _id: 1 })
          .lean()
      : null;
    if (!team || (scope !== undefined && !scope.includes(teamIdParam))) {
      return NextResponse.json({ error: "invalid_team" }, { status: 400 });
    }
    filter.teamId = team._id;
  }

  if (status) {
    filter.status = status;
  } else {
    // Always exclude drafts (unapproved inquiries); exclude cancelled unless requested.
    filter.status = includeCancelled ? { $ne: "draft" } : { $nin: ["draft", "cancelled"] };
  }

  if (q && q.trim()) {
    const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    filter.$or = [{ title: rx }, { clientName: rx }, { "location.address": rx }];
  }

  if (from || to) {
    // A bare YYYY-MM-DD parses as midnight UTC, so a to-date would exclude
    // everything on the day the user picked. The picker deals in whole days,
    // so both ends are widened to whole days in the workspace timezone.
    const tz = (ctx.workspace as { timezone?: string | null }).timezone ?? FALLBACK_TZ;
    const isBareDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
    const range: Record<string, Date> = {};
    if (from) range.$gte = isBareDate(from) ? dayBoundInTz(from, tz, 0, 0, 0, 0) : new Date(from);
    if (to) range.$lte = isBareDate(to) ? dayBoundInTz(to, tz, 23, 59, 59, 999) : new Date(to);
    if (Object.values(range).some((d) => Number.isNaN(d.getTime()))) {
      return NextResponse.json({ error: "invalid_date_range" }, { status: 400 });
    }
    filter.firstSessionStart = range;
  }

  // Mirrors the table's past filter (see listBookings) so the export matches
  // what's on screen: "past" is lastSessionEnd < midnight today in workspace tz.
  if (!showPast) {
    const tz = (ctx.workspace as { timezone?: string | null }).timezone ?? FALLBACK_TZ;
    filter.lastSessionEnd = { $gte: localDayStart(tz, new Date()) };
  }

  const EXPORT_ROW_LIMIT = 10_000;
  const total = await Booking.countDocuments(filter);
  if (total > EXPORT_ROW_LIMIT) {
    return NextResponse.json(
      { error: "export_too_large" },
      { status: 413 }
    );
  }

  const bookings = await Booking.find(filter)
    .sort({ firstSessionStart: 1, _id: 1 })
    .lean();

  // Build contact lookup from referenced clients — bookings store clientId only.
  const clientIds = Array.from(
    new Set(bookings.map((b) => b.clientId?.toString()).filter(Boolean))
  );
  const contactByClientId = new Map<string, { email: string; phone: string }>();
  if (clientIds.length > 0) {
    const clients = await Client.find({
      _id: { $in: clientIds },
      workspaceId: ctx.workspace._id,
    })
      .select({ _id: 1, email: 1, phone: 1 })
      .lean();
    for (const c of clients) {
      contactByClientId.set(c._id.toString(), {
        email: c.email ?? "",
        phone: c.phone ?? "",
      });
    }
  }

  // Team names are display-only context; scoped by workspaceId like every other read.
  const teamIds = Array.from(
    new Set(bookings.map((b) => b.teamId?.toString()).filter(Boolean))
  );
  const teamNameById = new Map<string, string>();
  if (teamIds.length > 0) {
    const teams = await Team.find({
      _id: { $in: teamIds },
      workspaceId: ctx.workspace._id,
    })
      .select({ _id: 1, name: 1 })
      .lean();
    for (const t of teams) teamNameById.set(t._id.toString(), t.name ?? "");
  }

  // Each booking emits one row per session, sharing one booking_id. The
  // importer regroups on that id, so a multi-session booking round-trips
  // intact rather than splitting into one booking per session.
  const rows: (string | number)[][] = [];
  for (const b of bookings) {
    const sessions = b.sessions as { startAt: Date; endAt: Date }[];
    const contact = contactByClientId.get(b.clientId?.toString() ?? "");
    const bookingId = b._id.toString();
    // Export-only: payments drive ledger invariants, so the importer never
    // writes them back. JSON in one cell keeps a variable-length array in a
    // flat grid without exploding the column count.
    const payments = b.payments?.length ? JSON.stringify(b.payments) : "";

    sessions.forEach((session, idx) => {
      const values: Record<string, unknown> = {
        clientName: b.clientName ?? "",
        clientEmail: contact?.email ?? "",
        startAt: session.startAt ? new Date(session.startAt).toISOString() : "",
        endAt: session.endAt ? new Date(session.endAt).toISOString() : "",
        title: b.title ?? "",
        eventType: b.eventType ?? "",
        status: b.status ?? "",
        amountTotal: b.amount?.total ?? "",
        amountDeposit: b.amount?.deposit ?? "",
        currency: b.amount?.currency ?? "",
        locationAddress: b.location?.address ?? "",
        notes: b.notes ?? "",
        booking_id: bookingId,
        session_index: idx,
        clientId: b.clientId?.toString() ?? "",
        clientPhone: contact?.phone ?? "",
        locationLat: b.location?.lat ?? "",
        locationLng: b.location?.lng ?? "",
        teamName: teamNameById.get(b.teamId?.toString() ?? "") ?? "",
        invoiceNumber: b.invoiceNumber ?? "",
        payments,
        createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : "",
      };
      rows.push(CSV_HEADERS.map((h) => guard(h, values[h])));
    });
  }

  const datestamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const buffer = await rowsToXlsxBuffer(CSV_HEADERS, rows);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="bookings-${datestamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = serializeCsv(CSV_HEADERS, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings-${datestamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
