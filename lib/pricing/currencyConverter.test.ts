/**
 * Rate maps for rolling multi-currency records up into one workspace currency.
 * Amounts stay stored in the currency they were entered in; only the totals we
 * add together are converted.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo } from "@/test-utils/mongo";

const getFxRateMock = vi.fn();
vi.mock("./fxRates", () => ({ getFxRate: (...args: unknown[]) => getFxRateMock(...args) }));

beforeEach(() => {
  getFxRateMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildRateMap", () => {
  it("maps the target currency to 1 without asking for a rate", async () => {
    const { buildRateMap } = await import("./currencyConverter");

    const map = await buildRateMap("PHP", ["PHP"]);

    expect(map).toEqual({ PHP: 1 });
    expect(getFxRateMock).not.toHaveBeenCalled();
  });

  it("is all-or-nothing: any unresolved currency drops the whole map to target-only", async () => {
    getFxRateMock.mockImplementation(async (from: string) =>
      from === "USD" ? null : from === "AED" ? 15.8 : null
    );
    const { buildRateMap, isSingleCurrency } = await import("./currencyConverter");

    const map = await buildRateMap("PHP", ["PHP", "USD", "AED"]);

    expect(map).toEqual({ PHP: 1 });
    expect(isSingleCurrency(map)).toBe(true);
  });

  it("resolves every foreign currency when all rates succeed", async () => {
    getFxRateMock.mockImplementation(async (from: string) => (from === "USD" ? 58 : null));
    const { buildRateMap } = await import("./currencyConverter");

    const map = await buildRateMap("PHP", ["PHP", "USD", "USD"]);

    expect(map).toEqual({ PHP: 1, USD: 58 });
    expect(getFxRateMock).toHaveBeenCalledTimes(1);
  });
});

describe("isSingleCurrency", () => {
  it("is true only when nothing needs converting", async () => {
    const { isSingleCurrency } = await import("./currencyConverter");

    expect(isSingleCurrency({})).toBe(true);
    expect(isSingleCurrency({ PHP: 1 })).toBe(true);
    expect(isSingleCurrency({ PHP: 1, USD: 58 })).toBe(false);
  });
});

describe("convertAmount", () => {
  it("converts a known currency and passes through an unknown one", async () => {
    const { convertAmount } = await import("./currencyConverter");
    const rates = { PHP: 1, USD: 58 };

    expect(convertAmount(10, "USD", rates)).toBe(580);
    expect(convertAmount(500, "PHP", rates)).toBe(500);
    expect(convertAmount(500, undefined, rates)).toBe(500);
    expect(convertAmount(500, "XYZ", rates)).toBe(500);
  });
});

describe("convertedAmountExpr", () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  }, 120_000);

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  it("sums mixed-currency documents in the target currency", async () => {
    const { convertedAmountExpr } = await import("./currencyConverter");
    const collection = mongoose.connection.db!.collection("fx_expr_fixtures");
    await collection.insertMany([
      { amount: 1000, currency: "PHP" },
      { amount: 10, currency: "USD" },
      { amount: 500 }, // legacy row with no currency — already workspace currency
      { amount: 10, currency: "usd" }, // stored lowercase — no schema enum guarantees case
    ]);

    const [row] = await collection
      .aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: convertedAmountExpr("$amount", "$currency", { PHP: 1, USD: 58 }) },
          },
        },
      ])
      .toArray();

    expect(row.total).toBe(1000 + 10 * 58 + 500 + 10 * 58);
  });
});
