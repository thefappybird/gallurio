import { describe, expect, it } from "vitest";
import {
  coerceCurrency,
  coerceDate,
  coerceMoney,
  inferStatus,
  isAmbiguousDateColumn,
} from "./import-normalize";

describe("coerceMoney", () => {
  it("strips the decoration a spreadsheet puts around a number", () => {
    expect(coerceMoney("50000")).toEqual({ ok: true, value: "50000" });
    expect(coerceMoney("PHP 50,000.00")).toEqual({ ok: true, value: "50000" });
    expect(coerceMoney("₱50,000")).toEqual({ ok: true, value: "50000" });
    expect(coerceMoney("$1,234.56")).toEqual({ ok: true, value: "1234.56" });
    expect(coerceMoney("50 000")).toEqual({ ok: true, value: "50000" });
    expect(coerceMoney("Rp 1.500.000")).toEqual({ ok: true, value: "1500000" });
  });

  it("treats a blank cell as nothing to import, not as zero", () => {
    expect(coerceMoney("")).toEqual({ ok: true, value: "" });
    expect(coerceMoney("   ")).toEqual({ ok: true, value: "" });
  });

  it("rejects what it cannot read rather than guessing a number", () => {
    // The schema only accepts non-negative amounts, and "(1,200)" is
    // accountant's notation for a negative. Silently importing 1200 would
    // invert a refund.
    expect(coerceMoney("(1,200)").ok).toBe(false);
    expect(coerceMoney("-500").ok).toBe(false);
    expect(coerceMoney("to be confirmed").ok).toBe(false);
  });
});

describe("coerceDate", () => {
  const TZ = "Asia/Manila"; // UTC+8, no DST

  it("passes a full ISO instant straight through", () => {
    const r = coerceDate("2026-06-15T09:00:00.000Z", TZ, "MDY");
    expect(r).toEqual({ ok: true, value: "2026-06-15T09:00:00.000Z" });
  });

  it("reads a bare date as wall time in the workspace timezone, not the browser's", () => {
    // 2026-06-15 00:00 in Manila is 2026-06-14T16:00Z. Parsing it as local time
    // lands the booking on the wrong day for anyone outside UTC+8.
    const r = coerceDate("2026-06-15", TZ, "MDY");
    expect(r).toEqual({ ok: true, value: "2026-06-14T16:00:00.000Z" });
  });

  it("reads a date and time written the way a spreadsheet writes it", () => {
    expect(coerceDate("2026-06-15 09:00", TZ, "MDY")).toEqual({
      ok: true,
      value: "2026-06-15T01:00:00.000Z",
    });
    expect(coerceDate("June 15, 2026 9:00 AM", TZ, "MDY")).toEqual({
      ok: true,
      value: "2026-06-15T01:00:00.000Z",
    });
    expect(coerceDate("15 June 2026", TZ, "MDY")).toEqual({
      ok: true,
      value: "2026-06-14T16:00:00.000Z",
    });
  });

  it("honours the declared day/month order for a slash date", () => {
    expect(coerceDate("06/07/2026", TZ, "MDY")).toEqual({
      ok: true,
      value: "2026-06-06T16:00:00.000Z", // June 7
    });
    expect(coerceDate("06/07/2026", TZ, "DMY")).toEqual({
      ok: true,
      value: "2026-07-05T16:00:00.000Z", // July 6
    });
  });

  it("ignores the declared order when only one reading is possible", () => {
    // 15 cannot be a month, so DMY is the only valid reading regardless.
    expect(coerceDate("15/06/2026", TZ, "MDY")).toEqual({
      ok: true,
      value: "2026-06-14T16:00:00.000Z",
    });
  });

  it("reads an Excel serial date, which is what a real date cell becomes", () => {
    // 46188 = 2026-06-15 under the 1900 epoch Excel uses.
    expect(coerceDate("46188", TZ, "MDY")).toEqual({
      ok: true,
      value: "2026-06-14T16:00:00.000Z",
    });
  });

  it("rejects an unreadable cell instead of inventing a date", () => {
    expect(coerceDate("sometime next spring", TZ, "MDY").ok).toBe(false);
    expect(coerceDate("31/02/2026", TZ, "DMY").ok).toBe(false);
  });

  it("treats a blank cell as absent", () => {
    expect(coerceDate("", TZ, "MDY")).toEqual({ ok: true, value: "" });
  });
});

describe("coerceCurrency", () => {
  it("accepts a code in any casing", () => {
    expect(coerceCurrency("php")).toEqual({ ok: true, value: "PHP" });
    expect(coerceCurrency(" USD ")).toEqual({ ok: true, value: "USD" });
  });

  it("reads the symbol or name a sheet is more likely to carry", () => {
    expect(coerceCurrency("₱")).toEqual({ ok: true, value: "PHP" });
    expect(coerceCurrency("Peso")).toEqual({ ok: true, value: "PHP" });
    expect(coerceCurrency("$")).toEqual({ ok: true, value: "USD" });
    expect(coerceCurrency("Rp")).toEqual({ ok: true, value: "IDR" });
  });

  it("rejects a currency we cannot settle transactions in", () => {
    expect(coerceCurrency("EUR").ok).toBe(false);
    expect(coerceCurrency("bananas").ok).toBe(false);
  });

  it("treats a blank cell as absent so the workspace default applies", () => {
    expect(coerceCurrency("")).toEqual({ ok: true, value: "" });
  });
});

describe("isAmbiguousDateColumn", () => {
  it("is ambiguous only when no value in the column settles the order", () => {
    // Every value reads both ways, so the user has to say which.
    expect(isAmbiguousDateColumn(["06/07/2026", "01/02/2026"])).toBe(true);
    // 15 cannot be a month, so the whole column is decided.
    expect(isAmbiguousDateColumn(["06/07/2026", "15/06/2026"])).toBe(false);
    // ISO and named months are never ambiguous.
    expect(isAmbiguousDateColumn(["2026-06-15", "June 7, 2026"])).toBe(false);
    expect(isAmbiguousDateColumn([])).toBe(false);
  });
});

describe("inferStatus", () => {
  const NOW = new Date("2026-06-20T00:00:00.000Z");
  const future = { endAt: new Date("2026-07-01T00:00:00.000Z"), now: NOW };
  const past = { endAt: new Date("2026-06-01T00:00:00.000Z"), now: NOW };

  it("marks a booking that has not happened yet as booked", () => {
    expect(inferStatus({ ...future, amountTotal: 0, amountDeposit: 0 })).toBe("booked");
    // Fully paid in advance is still not completed — the shoot has not happened.
    expect(
      inferStatus({ ...future, amountTotal: 50000, amountDeposit: 50000 })
    ).toBe("booked");
  });

  it("marks a settled past booking as completed", () => {
    expect(
      inferStatus({ ...past, amountTotal: 50000, amountDeposit: 50000 })
    ).toBe("completed");
    // Deposit plus paid payments has to reach the total, not just the deposit.
    expect(
      inferStatus({
        ...past,
        amountTotal: 50000,
        amountDeposit: 10000,
        payments: [{ price: 40000, status: "paid" }],
      })
    ).toBe("completed");
    // A booking with no money attached is settled by definition.
    expect(inferStatus({ ...past, amountTotal: 0, amountDeposit: 0 })).toBe("completed");
  });

  it("leaves an unpaid past booking as booked rather than making a row the route will reject", () => {
    // route.ts refuses a completed booking that is not fully paid, so inferring
    // "completed" here would manufacture the exact failure this feature exists
    // to remove.
    expect(
      inferStatus({ ...past, amountTotal: 50000, amountDeposit: 10000 })
    ).toBe("booked");
    expect(
      inferStatus({
        ...past,
        amountTotal: 50000,
        amountDeposit: 10000,
        payments: [{ price: 40000, status: "unpaid" }],
      })
    ).toBe("booked");
  });
});
