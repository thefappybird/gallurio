import { wallTimeInTzToUtc } from "@/lib/utils/timezone";

// ponytail: extracted helper so isPast computation can be unit-tested
export function areAllSessionsPast(
  sessions: { startDate: string; endTime: string }[],
  tz: string,
  now?: Date
): boolean {
  if (sessions.length === 0) return false;
  const ref = now ?? new Date();
  return sessions.every(
    (s) => new Date(wallTimeInTzToUtc(s.startDate, s.endTime, tz)) < ref
  );
}
