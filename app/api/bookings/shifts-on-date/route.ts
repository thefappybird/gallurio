import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/lib/db/models";
import { dayBoundInTz, FALLBACK_TZ } from "@/lib/utils/timezone";

export const runtime = "nodejs";

/** Format a UTC Date as HH:MM in the given IANA timezone. */
function formatHHMM(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

/**
 * Returns shifts in the workspace that touch the given date. A shift "touches"
 * the date if any session's range overlaps [dayStart, dayEnd]. Returns the
 * shift-start and shift-end times (HH:MM, local) from the matching session so
 * the wizard can show conflict ranges without leaking full booking details.
 */
export async function GET(req: Request) {
  const ctx = await requireOrg();
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  // Exclude an entire booking — used by the wizard in edit mode so the user's
  // own current booking doesn't appear as a self-conflict.
  const excludeId = url.searchParams.get("excludeId");
  // Exclude a single session within a booking — used by drag-and-drop so a
  // session moving onto a sibling session of the SAME booking is still
  // flagged as a conflict. Format: "bookingId:sessionIndex".
  const excludeShiftKey = url.searchParams.get("excludeShiftKey");
  let excludeShift: { bookingId: string; sessionIndex: number } | null = null;
  if (excludeShiftKey) {
    const [bid, idxStr] = excludeShiftKey.split(":");
    const idx = Number(idxStr);
    if (bid && /^[a-f0-9]{24}$/i.test(bid) && Number.isInteger(idx) && idx >= 0) {
      excludeShift = { bookingId: bid, sessionIndex: idx };
    }
  }

  await connectDB();

  // Resolve workspace timezone — fall back to Manila (launch market) if not set.
  const tz: string = (ctx.workspace as { timezone?: string | null }).timezone || (() => {
    console.warn(`[shifts-on-date] workspace ${ctx.workspace._id} has no timezone set; defaulting to ${FALLBACK_TZ}`);
    return FALLBACK_TZ;
  })();

  // Day boundaries as UTC instants matching 00:00:00.000 and 23:59:59.999 in
  // the workspace's timezone, so a Manila workspace querying "2026-08-15" gets
  // the correct Manila-day window regardless of where Vercel runs.
  const dayStart = dayBoundInTz(dateParam, tz, 0, 0, 0, 0);
  const dayEnd = dayBoundInTz(dateParam, tz, 23, 59, 59, 999);

  // Any booking with a session (or legacy firstSessionStart/lastSessionEnd)
  // whose range overlaps [dayStart, dayEnd].
  const filter: Record<string, unknown> = {
    workspaceId: ctx.workspace._id,
    // Drafts are unapproved inquiry requests — they must not block availability
    // or surface as scheduling conflicts in the booking wizard.
    status: { $nin: ["cancelled", "draft"] },
    $or: [
      {
        sessions: {
          $elemMatch: {
            startAt: { $lte: dayEnd },
            endAt: { $gte: dayStart },
          },
        },
      },
      {
        firstSessionStart: { $lte: dayEnd },
        lastSessionEnd: { $gte: dayStart },
      },
    ],
  };
  if (excludeId && /^[a-f0-9]{24}$/i.test(excludeId)) {
    filter._id = { $ne: excludeId };
  }

  const bookings = await Booking.find(filter)
    .select({ _id: 1, title: 1, sessions: 1, firstSessionStart: 1, lastSessionEnd: 1 })
    .sort({ firstSessionStart: 1 })
    .limit(20)
    .lean();

  type RawBooking = typeof bookings[number] & {
    firstSessionStart?: Date;
    lastSessionEnd?: Date;
  };

  const shifts = (bookings as RawBooking[]).flatMap((b) => {
    const bookingId = b._id.toString();
    const sessions = b.sessions as { startAt: Date; endAt: Date }[] | undefined;
    const matchingEntries = (sessions ?? [])
      .map((s, i) => ({ session: s, sessionIndex: i }))
      .filter(({ session }) => session.startAt <= dayEnd && session.endAt >= dayStart);

    // Fall back to denormalized bounds for legacy bookings missing sessions[].
    if (matchingEntries.length === 0) {
      // Modern bookings: sessions[] is the source of truth. If no specific session
      // matches the queried date, this booking genuinely has no shift on that day
      // — the Mongo $or's bounds clause matched only because the booking's overall
      // date range (firstSessionStart..lastSessionEnd) spans the date. Skip the
      // legacy all-day sentinel to avoid false conflicts.
      if (sessions && sessions.length > 0) return [];
      // Legacy fallback: bookings without a sessions[] array fall back to the
      // denormalized bounds and are treated as occupying the entire day.
      if (!b.firstSessionStart || !b.lastSessionEnd) return [];
      if (excludeShift && excludeShift.bookingId === bookingId && excludeShift.sessionIndex === 0) {
        return [];
      }
      const startDate = new Date(b.firstSessionStart);
      const endDate = new Date(b.lastSessionEnd);
      // Multi-day booking queried mid-span: the overall window (e.g. Jul 1 09:00
      // → Jul 3 18:00) is not the correct shift for the queried day. Return an
      // all-day sentinel so conflict checks always treat this as overlapping.
      const startTzStr = formatHHMM(startDate, tz);
      const endTzStr = formatHHMM(endDate, tz);
      // Compare calendar dates in the workspace TZ to detect multi-day span.
      const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
      const isMultiDay = dateFmt.format(startDate) !== dateFmt.format(endDate);
      return [
        {
          id: bookingId,
          bookingId,
          sessionIndex: 0,
          title: b.title,
          shiftStart: isMultiDay ? "00:00" : startTzStr,
          shiftEnd: isMultiDay ? "23:59" : endTzStr,
        },
      ];
    }

    return matchingEntries
      .filter(({ sessionIndex }) =>
        !(excludeShift && excludeShift.bookingId === bookingId && excludeShift.sessionIndex === sessionIndex)
      )
      .map(({ session, sessionIndex }) => ({
        id: bookingId,
        bookingId,
        sessionIndex,
        title: b.title,
        shiftStart: formatHHMM(new Date(session.startAt), tz),
        shiftEnd: formatHHMM(new Date(session.endAt), tz),
      }));
  });

  return NextResponse.json({ shifts });
}
