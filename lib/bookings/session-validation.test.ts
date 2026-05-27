import { describe, it, expect } from "vitest";
import { sessionsAreSameDayInTz, FALLBACK_TZ } from "./session-validation";

// Helper: build a session from ISO wall-clock strings in a given timezone.
// We use UTC strings here and rely on the formatter to convert — the key is
// that the Intl formatter resolves the calendar day in the named tz.
function makeSession(startIso: string, endIso: string) {
  return { startAt: new Date(startIso), endAt: new Date(endIso) };
}

describe("sessionsAreSameDayInTz", () => {
  describe("Philippines / UTC+8", () => {
    const TZ = "Asia/Manila";

    it("accepts a daytime session that is the same UTC day and same wall-clock day", () => {
      // 09:00–17:00 PHT = 01:00–09:00 UTC same day
      const result = sessionsAreSameDayInTz(
        [makeSession("2026-08-15T01:00:00Z", "2026-08-15T09:00:00Z")],
        TZ
      );
      expect(result).toEqual({ ok: true });
    });

    it("rejects a cross-midnight session that looks same-day in UTC (21:00 → 02:00 PHT)", () => {
      // 21:00 PHT = 13:00 UTC on Aug 15
      // 02:00 PHT the next day = 18:00 UTC on Aug 15
      // UTC-day check wrongly passes; tz-aware check must reject.
      const result = sessionsAreSameDayInTz(
        [makeSession("2026-08-15T13:00:00Z", "2026-08-15T18:00:00Z")],
        TZ
      );
      expect(result).toEqual({ ok: false, sessionIndex: 0 });
    });

    it("accepts a session ending exactly at midnight (23:59 → 00:00 next day in UTC, same PHT day)", () => {
      // 07:59–08:00 UTC = 15:59–16:00 PHT — same day in both
      const result = sessionsAreSameDayInTz(
        [makeSession("2026-08-15T07:59:00Z", "2026-08-15T08:00:00Z")],
        TZ
      );
      expect(result).toEqual({ ok: true });
    });

    it("rejects the second session in an array and returns the correct index", () => {
      const sessions = [
        makeSession("2026-08-15T01:00:00Z", "2026-08-15T09:00:00Z"), // ok
        makeSession("2026-08-15T13:00:00Z", "2026-08-15T18:00:00Z"), // crosses midnight PHT
      ];
      const result = sessionsAreSameDayInTz(sessions, TZ);
      expect(result).toEqual({ ok: false, sessionIndex: 1 });
    });
  });

  describe("UTC- timezone (e.g. UTC-5 / America/New_York)", () => {
    const TZ = "America/New_York";

    it("accepts a 09:00–17:00 wall-clock session", () => {
      // 09:00 EST = 14:00 UTC; 17:00 EST = 22:00 UTC — both UTC Aug 15
      const result = sessionsAreSameDayInTz(
        [makeSession("2026-08-15T14:00:00Z", "2026-08-15T22:00:00Z")],
        TZ
      );
      expect(result).toEqual({ ok: true });
    });

    it("rejects a session that crosses midnight in EST even though UTC days differ", () => {
      // 22:00 EST = 03:00 UTC next day
      // 03:00 UTC Aug 16 → 22:00 EST Aug 15
      // 05:00 UTC Aug 16 → 01:00 EST Aug 16 (next day)
      const result = sessionsAreSameDayInTz(
        [makeSession("2026-08-16T03:00:00Z", "2026-08-16T05:00:00Z")],
        TZ
      );
      expect(result).toEqual({ ok: false, sessionIndex: 0 });
    });
  });

  describe("fallback / edge cases", () => {
    it("accepts an empty sessions array (vacuous truth)", () => {
      expect(sessionsAreSameDayInTz([], FALLBACK_TZ)).toEqual({ ok: true });
    });

    it("accepts a zero-length session (startAt equals endAt)", () => {
      const d = new Date("2026-08-15T10:00:00Z");
      expect(sessionsAreSameDayInTz([{ startAt: d, endAt: d }], FALLBACK_TZ)).toEqual({
        ok: true,
      });
    });

    it("falls back gracefully to Asia/Manila for the FALLBACK_TZ constant", () => {
      expect(FALLBACK_TZ).toBe("Asia/Manila");
    });
  });
});
