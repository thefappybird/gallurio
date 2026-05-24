/**
 * Pure helpers for multi-session booking edits.
 *
 * These functions are intentionally side-effect free: they take sessions and
 * return new session arrays without touching the database. The caller is
 * responsible for PATCHing the booking with the result.
 *
 * MVP note: no auto-merge of adjacent sessions with identical times — keeps
 * the algorithm small and predictable. User can clean up via the wizard (v2).
 */

export type Session = { startAt: Date; endAt: Date };

// ─── Day-boundary helpers ─────────────────────────────────────────────────────

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Count calendar days in the range [startAt, endAt] inclusive. */
export function countDays(session: Session): number {
  const start = startOfDay(session.startAt);
  const end = startOfDay(session.endAt);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/** Count calendar days strictly before `today` in the session. */
export function countPastDays(session: Session, today: Date): number {
  const todayStart = startOfDay(today);
  const sessionStart = startOfDay(session.startAt);
  if (sessionStart >= todayStart) return 0;
  const sessionEnd = startOfDay(session.endAt);
  const lastPast = sessionEnd < todayStart ? sessionEnd : new Date(todayStart.getTime() - 86_400_000);
  return Math.round((lastPast.getTime() - sessionStart.getTime()) / 86_400_000) + 1;
}

// ─── splitDayOut ─────────────────────────────────────────────────────────────

/**
 * Splits a single day out of a session with new start/end times.
 *
 * Returns up to 3 sessions:
 *   - A "before" portion (days before `day` at original times), if any.
 *   - The touched day with the new start/end times.
 *   - An "after" portion (days after `day` at original times), if any.
 *
 * `day` must be a date within [session.startAt, session.endAt].
 * If `day` equals the only day, the result is exactly one session with the
 * new times.
 */
export function splitDayOut(
  session: Session,
  day: Date,
  newStart: Date,
  newEnd: Date
): Session[] {
  const sessionFirstDay = startOfDay(session.startAt);
  const sessionLastDay = startOfDay(session.endAt);
  const targetDay = startOfDay(day);

  const result: Session[] = [];

  // Before portion: [firstDay, targetDay - 1] at original times.
  const beforeLastMs = targetDay.getTime() - 86_400_000;
  if (beforeLastMs >= sessionFirstDay.getTime()) {
    const beforeEnd = new Date(beforeLastMs);
    beforeEnd.setHours(
      session.endAt.getHours(),
      session.endAt.getMinutes(),
      session.endAt.getSeconds(),
      0
    );
    result.push({ startAt: new Date(session.startAt), endAt: beforeEnd });
  }

  // The touched day.
  result.push({ startAt: newStart, endAt: newEnd });

  // After portion: [targetDay + 1, lastDay] at original times.
  const afterFirstMs = targetDay.getTime() + 86_400_000;
  if (afterFirstMs <= sessionLastDay.getTime()) {
    const afterStart = new Date(afterFirstMs);
    afterStart.setHours(
      session.startAt.getHours(),
      session.startAt.getMinutes(),
      session.startAt.getSeconds(),
      0
    );
    result.push({ startAt: afterStart, endAt: new Date(session.endAt) });
  }

  return result;
}

// ─── shiftSession ─────────────────────────────────────────────────────────────

/**
 * Shifts an entire session by `shiftMs` milliseconds, respecting past days.
 *
 * - If the whole session is in the future: return `[shifted session]`.
 * - If part of the session is in the past (today straddles it): return
 *   `[past portion at original times, shifted future portion]`.
 * - If the whole session is in the past: shifting makes no sense — return
 *   the session unchanged (caller should guard against this).
 */
export function shiftSession(
  session: Session,
  shiftMs: number,
  today: Date
): Session[] {
  const todayStart = startOfDay(today);
  const sessionStart = startOfDay(session.startAt);
  const sessionEnd = startOfDay(session.endAt);

  // All future — shift the whole thing.
  if (sessionStart >= todayStart) {
    return [
      {
        startAt: new Date(session.startAt.getTime() + shiftMs),
        endAt: new Date(session.endAt.getTime() + shiftMs),
      },
    ];
  }

  // All past — return unchanged.
  if (sessionEnd < todayStart) {
    return [{ startAt: new Date(session.startAt), endAt: new Date(session.endAt) }];
  }

  // Straddles today: keep past days, shift future days.
  const pastEnd = new Date(todayStart.getTime() - 86_400_000);
  pastEnd.setHours(
    session.endAt.getHours(),
    session.endAt.getMinutes(),
    session.endAt.getSeconds(),
    0
  );

  const futureStart = new Date(todayStart);
  futureStart.setHours(
    session.startAt.getHours(),
    session.startAt.getMinutes(),
    session.startAt.getSeconds(),
    0
  );

  return [
    // Past portion: original times up to yesterday.
    { startAt: new Date(session.startAt), endAt: pastEnd },
    // Future portion: today onwards, shifted.
    {
      startAt: new Date(futureStart.getTime() + shiftMs),
      endAt: new Date(session.endAt.getTime() + shiftMs),
    },
  ];
}

// ─── shiftSessionTimes ────────────────────────────────────────────────────────

/**
 * Applies new shift times (hours/minutes only) to a session, respecting past days.
 *
 * - All future: replace times on both endpoints and return `[updated session]`.
 * - Straddles today: keep past days at original times, apply new times to the
 *   future portion.
 * - All past: return unchanged.
 */
export function shiftSessionTimes(
  session: Session,
  newStartTime: Date,
  newEndTime: Date,
  today: Date
): Session[] {
  const todayStart = startOfDay(today);
  const sessionStart = startOfDay(session.startAt);
  const sessionEnd = startOfDay(session.endAt);

  function applyTime(dayBase: Date, timeSource: Date): Date {
    const d = new Date(dayBase);
    d.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0);
    return d;
  }

  // All future — replace times throughout.
  if (sessionStart >= todayStart) {
    return [
      {
        startAt: applyTime(session.startAt, newStartTime),
        endAt: applyTime(session.endAt, newEndTime),
      },
    ];
  }

  // All past — return unchanged.
  if (sessionEnd < todayStart) {
    return [{ startAt: new Date(session.startAt), endAt: new Date(session.endAt) }];
  }

  // Straddles today.
  const pastEnd = new Date(todayStart.getTime() - 86_400_000);
  pastEnd.setHours(
    session.endAt.getHours(),
    session.endAt.getMinutes(),
    session.endAt.getSeconds(),
    0
  );

  const futureStart = new Date(todayStart);
  futureStart.setHours(
    newStartTime.getHours(),
    newStartTime.getMinutes(),
    0,
    0
  );

  return [
    { startAt: new Date(session.startAt), endAt: pastEnd },
    {
      startAt: futureStart,
      endAt: applyTime(session.endAt, newEndTime),
    },
  ];
}
