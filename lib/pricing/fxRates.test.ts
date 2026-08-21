/**
 * getFxRate reads the daily reference-rate table persisted in Mongo
 * (lib/db/models/FxRateTable.ts), normally populated once a day by the
 * fx-rates cron. Open Exchange Rates itself is only touched here as a
 * fallback when today's table is missing.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { FxRateTable, FxFetchLock } from "@/lib/db/models/FxRateTable";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));

function stubRates(rates: Record<string, number>) {
  const fetchMock = vi.fn(
    async () => ({ ok: true, json: async () => ({ base: "USD", rates }) }) as Response
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubFailure() {
  const fetchMock = vi.fn(async () => ({ ok: false, status: 429 }) as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

beforeAll(async () => {
  await startInMemoryMongo();
}, 120_000);

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("OPENEXCHANGERATES_APP_ID", "test-app-id");
  await clearCollections();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getFxRate", () => {
  it("cold start: fetches from Open Exchange Rates and upserts today's doc", async () => {
    const fetchMock = stubRates({ USD: 1, PHP: 58 });
    const { getFxRate } = await import("./fxRates");

    expect(await getFxRate("USD", "PHP")).toBe(58);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const doc = await FxRateTable.findById(todayUtc()).lean();
    expect(doc?.rates?.PHP).toBe(58);
  });

  it("cross-rates a non-USD pair from the USD-based table", async () => {
    stubRates({ USD: 1, PHP: 58, AED: 3.67 });
    const { getFxRate } = await import("./fxRates");
    expect(await getFxRate("PHP", "AED")).toBeCloseTo(3.67 / 58, 6);
  });

  it("a second call the same day reads the stored doc and does not re-fetch", async () => {
    await FxRateTable.create({
      _id: todayUtc(),
      base: "USD",
      rates: { USD: 1, PHP: 58 },
      fetchedAt: new Date(),
    });
    const fetchMock = stubRates({ USD: 1, PHP: 99 });
    const { getFxRate } = await import("./fxRates");

    expect(await getFxRate("USD", "PHP")).toBe(58);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves a stale stored table when the fallback fetch fails", async () => {
    await FxRateTable.create({
      _id: "2000-01-01",
      base: "USD",
      rates: { USD: 1, PHP: 44 },
      fetchedAt: new Date("2000-01-01"),
    });
    stubFailure();
    const { getFxRate } = await import("./fxRates");

    expect(await getFxRate("USD", "PHP")).toBe(44);
  });

  it("returns null when there is no stored table at all and the fetch fails", async () => {
    stubFailure();
    const { getFxRate } = await import("./fxRates");
    expect(await getFxRate("USD", "PHP")).toBeNull();
  });

  it("only one of two concurrent callers fetches when today's table is missing", async () => {
    const fetchMock = stubRates({ USD: 1, PHP: 58 });
    const { getFxRate } = await import("./fxRates");

    await Promise.all([getFxRate("USD", "PHP"), getFxRate("USD", "PHP")]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const lock = await FxFetchLock.findById("fx-fetch-lock").lean();
    expect(lock).toBeTruthy();
  });
});

describe("resolveFxFreeze", () => {
  it("returns a freeze snapshot when a rate is available", async () => {
    stubRates({ USD: 1, PHP: 58 });
    const { resolveFxFreeze } = await import("./fxRates");
    expect(await resolveFxFreeze("USD", "PHP")).toEqual({ rate: 58, target: "PHP" });
  });

  it("never throws even when the underlying fetch blows up", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network exploded");
      })
    );
    const { resolveFxFreeze } = await import("./fxRates");
    await expect(resolveFxFreeze("USD", "PHP")).resolves.toBeNull();
  });
});
