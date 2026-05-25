import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/lib/db/models";

export const runtime = "nodejs";

const FALLBACK_TZ = "Asia/Manila";

/**
 * Returns the UTC instant corresponding to HH:MM:SS.mmm on `dateStr`
 * (YYYY-MM-DD) in `timeZone`, by parsing the Intl-formatted parts.
 */
function dayBoundInTz(
  dateStr: string,
  timeZone: string,
  h: number,
  min: number,
  sec: number,
  ms: number
): Date {
  // Build a wall-clock string in the target TZ and parse it as UTC offset
  // using Intl to avoid reliance on the server's local clock.
  const [year, month, day] = dateStr.split("-").map(Number);
  // Approximate: start with a UTC midnight for that date, then shift by TZ offset.
  // We use the "en-CA" locale trick to get a stable ISO-like output from Intl.
  const probe = new Date(Date.UTC(year, month - 1, day, h, min, sec, ms));
  // Ask Intl what the local time is at `probe` in the target TZ so we can
  // compute the offset and adjust.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(probe);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const localH = get("hour");
  const localMin = get("minute");
  const localSec = get("second");
  // Offset between what we want (h:min:sec) and what Intl reported at probe.
  // Subtract to shift the UTC value so Intl would report the desired wall time.
  const diffMs =
    (h - localH) * 3_600_000 +
    (min - localMin) * 60_000 +
    (sec - localSec) * 1_000 +
    ms;
  return new Date(probe.getTime() + diffMs);
}

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
  // Exclude a booking from the results — used in edit mode so the wizard
  // doesn't flag the user's own current booking as a conflict.
  const excludeId = url.searchParams.get("excludeId");

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
    status: { $ne: "cancelled" },
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
    const sessions = b.sessions as { startAt: Date; endAt: Date }[] | undefined;
    const matchingSession = sessions?.find(
      (s) => s.startAt <= dayEnd && s.endAt >= dayStart
    );

    // Fall back to denormalized bounds for legacy bookings missing sessions[].
    if (!matchingSession) {
      if (!b.firstSessionStart || !b.lastSessionEnd) return [];
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
          id: b._id.toString(),
          title: b.title,
          shiftStart: isMultiDay ? "00:00" : startTzStr,
          shiftEnd: isMultiDay ? "23:59" : endTzStr,
        },
      ];
    }

    const startDate = new Date(matchingSession.startAt);
    const endDate = new Date(matchingSession.endAt);
    return [
      {
        id: b._id.toString(),
        title: b.title,
        shiftStart: formatHHMM(startDate, tz),
        shiftEnd: formatHHMM(endDate, tz),
      },
    ];
  });

  return NextResponse.json({ shifts });
}
