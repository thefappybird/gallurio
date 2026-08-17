/**
 * getFxRate reads daily reference rates from Open Exchange Rates using the
 * existing OPENEXCHANGERATES_APP_ID key. The free plan only serves a USD-based
 * table, so non-USD pairs are cross-rated off it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function stubRates(rates: Record<string, number>) {
  const fetchMock = vi.fn(
    async () => ({ ok: true, json: async () => ({ base: "USD", rates }) }) as Response
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("OPENEXCHANGERATES_APP_ID", "test-app-id");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getFxRate", () => {
  it("reads rates from the Open Exchange Rates response shape", async () => {
    stubRates({ USD: 1, PHP: 58 });
    const { getFxRate } = await import("./fxRates");
    expect(await getFxRate("USD", "PHP")).toBe(58);
  });

  it("cross-rates a non-USD pair from the USD-based table", async () => {
    stubRates({ USD: 1, PHP: 58, AED: 3.67 });
    const { getFxRate } = await import("./fxRates");
    expect(await getFxRate("PHP", "AED")).toBeCloseTo(3.67 / 58, 6);
  });

  it("fetches the table once and serves later calls from cache", async () => {
    const fetchMock = stubRates({ USD: 1, PHP: 58, AED: 3.67 });
    const { getFxRate } = await import("./fxRates");
    await getFxRate("PHP", "USD");
    await getFxRate("PHP", "AED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null without calling the API when no app id is configured", async () => {
    vi.stubEnv("OPENEXCHANGERATES_APP_ID", "");
    const fetchMock = stubRates({ USD: 1, PHP: 58 });
    const { getFxRate } = await import("./fxRates");
    expect(await getFxRate("PHP", "USD")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when the API call fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429 }) as Response));
    const { getFxRate } = await import("./fxRates");
    expect(await getFxRate("PHP", "USD")).toBeNull();
  });
});
