/**
 * Timezone-aware session validation helpers.
 *
 * The Zod schema in lib/validators/booking.ts performs a cheap UTC-day check as
 * a baseline sanity guard. This module provides the authoritative tz-aware check
 * that route handlers call after parse — where the workspace timezone is known.
 */

export const FALLBACK_TZ = "Asia/Manila";

const dateFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

/**
 * Verify that every session's startAt and endAt fall on the same calendar day
 * in the given IANA timezone.
 *
 * Returns `{ ok: true }` when all sessions pass, or
 * `{ ok: false, sessionIndex: number }` pointing at the first offending session.
 *
 * @example
 *   const result = sessionsAreSameDayInTz(parsed.sessions, workspace.timezone ?? FALLBACK_TZ);
 *   if (!result.ok) {
 *     return NextResponse.json(
 *       { error: `Session ${result.sessionIndex} crosses midnight in the workspace timezone` },
 *       { status: 400 }
 *     );
 *   }
 */
export function sessionsAreSameDayInTz(
  sessions: { startAt: Date; endAt: Date }[],
  timeZone: string
): { ok: true } | { ok: false; sessionIndex: number } {
  const fmt = dateFormatter(timeZone);

  for (let i = 0; i < sessions.length; i++) {
    const { startAt, endAt } = sessions[i];
    const startDay = fmt.format(startAt);
    const endDay = fmt.format(endAt);
    if (startDay !== endDay) {
      return { ok: false, sessionIndex: i };
    }
  }

  return { ok: true };
}
