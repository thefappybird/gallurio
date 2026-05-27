export type TodaySnap = { startDate: string; startTime: string };

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isToday(yyyyMmDd: string, now: Date = new Date()): boolean {
  return yyyyMmDd === todayIso(now);
}

function toMinutes(hhmm: string): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function formatHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addDaysToIso(yyyyMmDd: string, days: number): string {
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/**
 * Round up to the next :00 or :30 slot strictly after `now`.
 * If the result crosses midnight, returns tomorrow's 00:00.
 */
export function nextHalfHourFromNow(now: Date = new Date()): {
  startDate: string;
  startTime: string;
} {
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  // Round up to next 30-min boundary strictly after current time.
  const snappedMinutes = Math.floor(totalMinutes / 30) * 30 + 30;

  if (snappedMinutes >= 24 * 60) {
    // Crossed midnight — move to tomorrow 00:00.
    return {
      startDate: addDaysToIso(todayIso(now), 1),
      startTime: "00:00",
    };
  }

  return {
    startDate: todayIso(now),
    startTime: formatHHMM(snappedMinutes),
  };
}

/**
 * Compute new {startDate, startTime, endDate, endTime} when the user
 * transitions the start date to today, snapping start time to the next
 * 30-min slot after now. Preserves the original duration between start
 * and end (calendar-day diff + minute diff).
 *
 * If the snap pushes the start past midnight, startDate advances to
 * tomorrow and endDate shifts by the same number of extra days.
 */
export function applyTodaySnap(args: {
  prevStartDate: string;
  prevStartTime: string;
  prevEndDate: string;
  prevEndTime: string;
  now?: Date;
}): {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
} {
  const now = args.now ?? new Date();
  const { prevStartDate, prevStartTime, prevEndDate, prevEndTime } = args;

  const snapped = nextHalfHourFromNow(now);

  const DEFAULT_DURATION_MINUTES = 7 * 60; // 7 hours

  // If previous start/end are missing or unparseable, fall back to a 7-hour duration.
  const prevStartDateResolved = prevStartDate || snapped.startDate;
  const prevEndDateResolved = prevEndDate || prevStartDateResolved;
  const prevStartTimeResolved = prevStartTime || "00:00";
  const prevEndTimeResolved = prevEndTime || "00:00";

  const prevStartDt = new Date(`${prevStartDateResolved}T${prevStartTimeResolved}:00`);
  const prevEndDt = new Date(`${prevEndDateResolved}T${prevEndTimeResolved}:00`);
  const rawDurationMs = prevEndDt.getTime() - prevStartDt.getTime();

  // Use raw duration only when both dates parsed cleanly and duration is positive.
  const isValidDuration =
    !Number.isNaN(rawDurationMs) &&
    !Number.isNaN(prevStartDt.getTime()) &&
    !Number.isNaN(prevEndDt.getTime()) &&
    rawDurationMs > 0;

  const durationMs = isValidDuration ? rawDurationMs : DEFAULT_DURATION_MINUTES * 60000;

  const durationMinutes = Math.round(durationMs / 60000);
  const snappedMins = toMinutes(snapped.startTime) ?? 0;
  const newEndTotalMins = snappedMins + durationMinutes;
  const newEndDayOffset = Math.floor(newEndTotalMins / (24 * 60));
  const newEndMins = newEndTotalMins % (24 * 60);
  const newEndDate = addDaysToIso(snapped.startDate, newEndDayOffset);
  const newEndTime = formatHHMM(newEndMins);

  return {
    startDate: snapped.startDate,
    startTime: snapped.startTime,
    endDate: newEndDate,
    endTime: newEndTime,
  };
}
