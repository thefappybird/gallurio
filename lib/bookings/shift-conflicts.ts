import { Booking } from "@/lib/db/models";
import { dayBoundInTz } from "@/lib/utils/timezone";

export type ShiftHit = {
  id: string;
  bookingId: string;
  sessionIndex: number;
  title: string;
  shiftStart: string;
  shiftEnd: string;
};

/** Format a UTC Date as HH:MM in the given IANA timezone. */
export function formatHHMM(date: Date, timeZone: string): string {
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

type GetShiftsOptions = {
  /** Exclude an entire booking — used by the wizard in edit mode so the
   *  user's own current booking doesn't appear as a self-conflict. */
  excludeId?: string | null;
  /** Exclude a single session within a booking — used by drag-and-drop so a
   *  session moving onto a sibling session of the SAME booking is still
   *  flagged as a conflict. Format: "bookingId:sessionIndex". */
  excludeShiftKey?: string | null;
  /** Restrict results to bookings belonging to these team IDs (non-owners).
   *  `undefined` means no restriction (owners see everything). */
  teamScope?: string[] | undefined;
};

/**
 * Returns shifts in the workspace that touch the given local date. A shift
 * "touches" the date if any session's range overlaps [dayStart, dayEnd] in the
 * workspace's timezone.
 *
 * Returns the shift-start and shift-end times (HH:MM, local) from the matching
 * session so callers can show conflict ranges without leaking full booking
 * details.
 */
export async function getShiftsOnDate(
  workspaceId: unknown,
  dateStr: string,
  tz: string,
  opts: GetShiftsOptions = {}
): Promise<ShiftHit[]> {
  const { excludeId, excludeShiftKey, teamScope } = opts;

  // Parse excludeShiftKey → { bookingId, sessionIndex } or null.
  let excludeShift: { bookingId: string; sessionIndex: number } | null = null;
  if (excludeShiftKey) {
    const [bid, idxStr] = excludeShiftKey.split(":");
    const idx = Number(idxStr);
    if (bid && /^[a-f0-9]{24}$/i.test(bid) && Number.isInteger(idx) && idx >= 0) {
      excludeShift = { bookingId: bid, sessionIndex: idx };
    }
  }

  // Day boundaries as UTC instants matching 00:00:00.000 and 23:59:59.999 in
  // the workspace's timezone.
  const dayStart = dayBoundInTz(dateStr, tz, 0, 0, 0, 0);
  const dayEnd = dayBoundInTz(dateStr, tz, 23, 59, 59, 999);

  const filter: Record<string, unknown> = {
    workspaceId,
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
  if (teamScope !== undefined) {
    filter.teamId = { $in: teamScope };
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

  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (bookings as RawBooking[]).flatMap((b) => {
    const bookingId = b._id.toString();
    const sessions = b.sessions as { startAt: Date; endAt: Date }[] | undefined;
    const matchingEntries = (sessions ?? [])
      .map((s, i) => ({ session: s, sessionIndex: i }))
      .filter(({ session }) => session.startAt <= dayEnd && session.endAt >= dayStart);

    // Fall back to denormalized bounds for legacy bookings missing sessions[].
    if (matchingEntries.length === 0) {
      // Modern bookings: sessions[] is the source of truth. If no specific
      // session matches the queried date, this booking genuinely has no shift
      // on that day — skip to avoid false conflicts.
      if (sessions && sessions.length > 0) return [];
      // Legacy fallback: bookings without a sessions[] array fall back to the
      // denormalized bounds and are treated as occupying the entire day.
      if (!b.firstSessionStart || !b.lastSessionEnd) return [];
      if (excludeShift && excludeShift.bookingId === bookingId && excludeShift.sessionIndex === 0) {
        return [];
      }
      const startDate = new Date(b.firstSessionStart);
      const endDate = new Date(b.lastSessionEnd);
      // Multi-day booking queried mid-span: return an all-day sentinel so
      // conflict checks always treat this as overlapping.
      const startTzStr = formatHHMM(startDate, tz);
      const endTzStr = formatHHMM(endDate, tz);
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
      .filter(
        ({ sessionIndex }) =>
          !(
            excludeShift &&
            excludeShift.bookingId === bookingId &&
            excludeShift.sessionIndex === sessionIndex
          )
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
}
