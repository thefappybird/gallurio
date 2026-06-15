import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/lib/db/models";
import { wallTimeInTzToUtc } from "@/lib/utils/timezone";
import { formatHHMM } from "@/lib/bookings/shift-conflicts";
import { isoDateInTz } from "@/app/[locale]/(app)/bookings/_components/_helpers/calendar-helpers";

export type InquiryConflictInput = {
  _id: string;
  sessions: Array<{
    startDate: string; // YYYY-MM-DD
    startTime: string; // HH:MM wall-clock
    endTime: string;   // HH:MM wall-clock
  }>;
};

/** Convert "HH:MM" to minutes since midnight. Returns null on invalid input. */
function toMins(hhmm: string): number | null {
  const parts = hhmm.split(":");
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** True when [aStart, aEnd) overlaps any shift in the list. Adjacent bounds do NOT overlap. */
function hasOverlap(
  shifts: { shiftStart: string; shiftEnd: string }[],
  aStart: number,
  aEnd: number
): boolean {
  return shifts.some((s) => {
    const bStart = toMins(s.shiftStart);
    const bEnd = toMins(s.shiftEnd);
    return bStart !== null && bEnd !== null && aStart < bEnd && bStart < aEnd;
  });
}

/**
 * Returns the set of inquiry IDs whose requested sessions conflict with
 * at least one existing (non-cancelled, non-draft) booking in the workspace.
 *
 * Uses ONE Booking query across the full date span of all inquiry sessions.
 */
export async function computeInquiryConflicts(
  workspaceId: unknown,
  inquiries: InquiryConflictInput[],
  tz: string
): Promise<Set<string>> {
  const result = new Set<string>();
  if (inquiries.length === 0) return result;

  // Collect all startDates across all inquiry sessions.
  const allDates: string[] = [];
  for (const inq of inquiries) {
    for (const s of inq.sessions) {
      if (s.startDate) allDates.push(s.startDate);
    }
  }
  if (allDates.length === 0) return result;

  allDates.sort();
  const minDate = allDates[0];
  const maxDate = allDates[allDates.length - 1];

  // Convert day boundaries to UTC for the Booking query range.
  const utcDayStart = new Date(wallTimeInTzToUtc(minDate, "00:00", tz));
  const utcDayEnd = new Date(wallTimeInTzToUtc(maxDate, "23:59", tz));

  await connectDB();

  const bookings = await Booking.find({
    workspaceId,
    status: { $nin: ["cancelled", "draft"] },
    firstSessionStart: { $lte: utcDayEnd },
    lastSessionEnd: { $gte: utcDayStart },
  })
    .select("sessions")
    .lean();

  // Build a map from local date (YYYY-MM-DD in tz) → shift-time pairs.
  const shiftsByDate = new Map<string, { shiftStart: string; shiftEnd: string }[]>();

  for (const booking of bookings) {
    const sessions = booking.sessions as { startAt: Date; endAt: Date }[] | undefined;
    if (!sessions) continue;

    for (const session of sessions) {
      const startAt = new Date(session.startAt);
      const endAt = new Date(session.endAt);

      const startLocalDate = isoDateInTz(startAt, tz);
      const endLocalDate = isoDateInTz(endAt, tz);
      const shiftStart = formatHHMM(startAt, tz);
      const shiftEnd = formatHHMM(endAt, tz);

      // Add the session to its start date.
      const startEntry = shiftsByDate.get(startLocalDate) ?? [];
      startEntry.push({ shiftStart, shiftEnd });
      shiftsByDate.set(startLocalDate, startEntry);

      // If the session spans midnight into a different local date, also add
      // a sentinel entry for that end date covering 00:00 → shiftEnd.
      if (endLocalDate !== startLocalDate) {
        const endEntry = shiftsByDate.get(endLocalDate) ?? [];
        endEntry.push({ shiftStart: "00:00", shiftEnd });
        shiftsByDate.set(endLocalDate, endEntry);
      }
    }
  }

  // Check each inquiry's sessions against the shifts map.
  for (const inq of inquiries) {
    for (const session of inq.sessions) {
      const shifts = shiftsByDate.get(session.startDate) ?? [];
      const aStart = toMins(session.startTime);
      const aEnd = toMins(session.endTime);
      if (aStart === null || aEnd === null) continue;
      if (hasOverlap(shifts, aStart, aEnd)) {
        result.add(inq._id);
        break;
      }
    }
  }

  return result;
}
