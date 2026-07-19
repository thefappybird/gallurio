import { describe, expect, it } from "vitest";
import { normalizePayments, centsEqual, isCompletionEligible, remainingBalance } from "./payment-rules";

describe("normalizePayments", () => {
  it("defaults createdAt to now and forces paidAt to now when status is paid without paidAt", () => {
    const now = new Date("2026-07-05T00:00:00Z");
    const result = normalizePayments([{ price: 100, status: "paid" }], now);
    expect(result).toEqual([
      { price: 100, status: "paid", createdAt: now, paidAt: now, title: "", method: "cash" },
    ]);
  });

  it("forces paidAt to null when status is unpaid, even if a paidAt was supplied", () => {
    const now = new Date("2026-07-05T00:00:00Z");
    const past = new Date("2026-01-01T00:00:00Z");
    const result = normalizePayments(
      [{ price: 50, status: "unpaid", paidAt: past, createdAt: past }],
      now
    );
    expect(result).toEqual([
      { price: 50, status: "unpaid", createdAt: past, paidAt: null, title: "", method: "cash" },
    ]);
  });

  it("passes through a supplied title and defaults a missing title to an empty string", () => {
    const now = new Date("2026-07-05T00:00:00Z");
    const result = normalizePayments(
      [{ price: 100, status: "unpaid", title: "Deposit" }, { price: 50, status: "unpaid" }],
      now
    );
    expect(result[0].title).toBe("Deposit");
    expect(result[1].title).toBe("");
  });

  it("defaults a missing payment method to cash and preserves a selected method", () => {
    const result = normalizePayments([{ price: 100, status: "paid", method: "card" }, { price: 50, status: "paid" }]);
    expect(result.map((payment) => payment.method)).toEqual(["card", "cash"]);
  });
});

describe("centsEqual", () => {
  it("treats values within half a cent as equal", () => {
    expect(centsEqual(100, 100.004)).toBe(true);
  });

  it("treats values a full cent apart as not equal", () => {
    expect(centsEqual(100, 100.01)).toBe(false);
  });
});

describe("isCompletionEligible", () => {
  it("is eligible with no payments when deposit already equals total", () => {
    expect(isCompletionEligible([], { total: 25_000, deposit: 25_000 })).toBe(true);
  });

  it("is not eligible when any payment row is unpaid", () => {
    expect(
      isCompletionEligible(
        [{ price: 50_000, status: "paid" }, { price: 25_000, status: "unpaid" }],
        { total: 75_000, deposit: 0 }
      )
    ).toBe(false);
  });

  it("is not eligible when sum is off by a full cent", () => {
    expect(
      isCompletionEligible([{ price: 74_999.99, status: "paid" }], { total: 75_000, deposit: 0 })
    ).toBe(false);
  });

  it("is eligible when deposit + paid sum matches total to the cent", () => {
    expect(
      isCompletionEligible([{ price: 50_000, status: "paid" }], { total: 75_000, deposit: 25_000 })
    ).toBe(true);
  });
});

describe("remainingBalance", () => {
  it("returns the amount left after deposit and existing payments", () => {
    expect(
      remainingBalance([{ price: 20_000 }], { total: 75_000, deposit: 25_000 })
    ).toBe(30_000);
  });

  it("excludes the payment at excludeIndex from the sum (editing that payment in place)", () => {
    expect(
      remainingBalance(
        [{ price: 20_000 }, { price: 30_000 }],
        { total: 75_000, deposit: 25_000 },
        1
      )
    ).toBe(30_000);
  });

  it("returns zero when deposit + payments exactly cover the total", () => {
    expect(
      remainingBalance([{ price: 50_000 }], { total: 75_000, deposit: 25_000 })
    ).toBe(0);
  });
});
