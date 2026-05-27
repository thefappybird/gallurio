export type SessionInput = { startAt: Date; endAt: Date };

export type Candle = {
  start: Date;
  end: Date;
  dayKey: string; // YYYY-MM-DD of the shift-day (the evening side for overnight)
};

export type CandleSplitResult = {
  candles: Candle[];
  totalShiftDays: number;
  pastShiftDays: number;
  rangeStart: Date; // first calendar day touched
  rangeEnd: Date;   // last calendar day touched
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function splitSessionIntoCandles(
  session: SessionInput,
  today: Date
): CandleSplitResult {
  const sessionStart = new Date(session.startAt);
  const sessionEnd = new Date(session.endAt);

  const shiftStartHour = sessionStart.getHours();
  const shiftStartMin = sessionStart.getMinutes();
  const shiftEndHour = sessionEnd.getHours();
  const shiftEndMin = sessionEnd.getMinutes();

  const isOvernight =
    shiftEndHour < shiftStartHour ||
    (shiftEndHour === shiftStartHour && shiftEndMin < shiftStartMin);

  const firstDay = startOfDay(sessionStart);
  // For overnight sessions the trailing morning belongs to the previous
  // evening's shift, so the last shift-day starts one calendar day before
  // sessionEnd's date.
  const lastShiftDay = isOvernight
    ? startOfDay(new Date(sessionEnd.getTime() - 24 * 60 * 60 * 1000))
    : startOfDay(sessionEnd);

  const rangeStart = firstDay;
  // rangeEnd is the last calendar day touched: for overnight that is
  // lastShiftDay + 1 (the morning side); for daytime it is lastShiftDay.
  const rangeEnd = isOvernight
    ? new Date(lastShiftDay.getTime() + 24 * 60 * 60 * 1000)
    : lastShiftDay;

  const candles: Candle[] = [];
  const cursor = new Date(firstDay);
  let pastShiftDays = 0;

  while (cursor <= lastShiftDay) {
    const candleStart = new Date(cursor);
    candleStart.setHours(shiftStartHour, shiftStartMin, 0, 0);

    let candleEnd: Date;
    if (isOvernight) {
      const nextDay = new Date(cursor);
      nextDay.setDate(nextDay.getDate() + 1);
      candleEnd = new Date(nextDay);
      candleEnd.setHours(shiftEndHour, shiftEndMin, 0, 0);
    } else {
      candleEnd = new Date(cursor);
      candleEnd.setHours(shiftEndHour, shiftEndMin, 0, 0);
    }

    if (cursor < today) {
      pastShiftDays++;
    }

    candles.push({
      start: candleStart,
      end: candleEnd,
      dayKey: dayKey(cursor),
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    candles,
    totalShiftDays: candles.length,
    pastShiftDays,
    rangeStart,
    rangeEnd,
  };
}
