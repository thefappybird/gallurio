import type { Candle } from "./candle-split";

export type DisplayCandle = Candle & {
  /** When true, this is the morning-side half of a midnight-split candle. */
  isMorningContinuation?: boolean;
  /** When true, this is the evening-side half (it ends visually at midnight). */
  isEveningHead?: boolean;
};

/**
 * For rbc time-grid views (week, day), an event spanning midnight renders as a
 * single block in the start-day's column — the next day's morning grid stays
 * empty. Split each midnight-crossing candle into two display halves so both
 * columns show the bleed visually.
 */
export function splitCandleAtMidnight(candle: Candle): DisplayCandle[] {
  const startDay = new Date(
    candle.start.getFullYear(),
    candle.start.getMonth(),
    candle.start.getDate()
  );
  const endDay = new Date(
    candle.end.getFullYear(),
    candle.end.getMonth(),
    candle.end.getDate()
  );

  if (startDay.getTime() === endDay.getTime()) {
    // same calendar day — no split needed
    return [candle];
  }

  const midnightAfterStart = new Date(startDay);
  midnightAfterStart.setDate(midnightAfterStart.getDate() + 1);

  // evening side: candle.start → 23:59:59.999 of startDay (just before midnight)
  const eveningEnd = new Date(midnightAfterStart.getTime() - 1);
  // morning side: 00:00:00 of next day → candle.end
  const morningStart = new Date(midnightAfterStart);

  return [
    { ...candle, end: eveningEnd, isEveningHead: true },
    { ...candle, start: morningStart, isMorningContinuation: true },
  ];
}
