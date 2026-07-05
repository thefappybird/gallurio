import { describe, expect, it } from "vitest";
import { normalizePayments, centsEqual, isCompletionEligible } from "./payment-rules";

describe("normalizePayments", () => {
  it("defaults createdAt to now and forces paidAt to now when status is paid without paidAt", () => {
    const now = new Date("2026-07-05T00:00:00Z");
    const result = normalizePayments([{ price: 100, status: "paid" }], now);
    expect(result).toEqual([
      { price: 100, status: "paid", createdAt: now, paidAt: now },
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
      { price: 50, status: "unpaid", createdAt: past, paidAt: null },
    ]);
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
