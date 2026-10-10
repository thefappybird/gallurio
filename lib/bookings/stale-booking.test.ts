import { describe, expect, it } from "vitest";
import { StaleBookingError, isNewerUpdatedAt, throwIfStale } from "./stale-booking";

function res(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

describe("throwIfStale", () => {
  it("throws StaleBookingError carrying the server booking on 409 stale", async () => {
    const booking = { _id: "b1", updatedAt: "2026-01-01T00:00:00.000Z" };
    await expect(throwIfStale(res(409, { error: "stale", booking }))).rejects.toMatchObject({
      name: "StaleBookingError",
      booking,
    });
  });

  it("ignores other 409s and leaves the body readable", async () => {
    const r = res(409, { error: "conflict", conflicts: [] });
    await expect(throwIfStale(r)).resolves.toBeUndefined();
    expect(await r.json()).toEqual({ error: "conflict", conflicts: [] });
  });

  it("is an Error subclass", () => {
    expect(new StaleBookingError(null)).toBeInstanceOf(Error);
  });
});

describe("isNewerUpdatedAt", () => {
  it("is true only when both parse and remote is strictly later", () => {
    expect(isNewerUpdatedAt("2026-01-02T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(true);
    expect(isNewerUpdatedAt("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(false);
    expect(isNewerUpdatedAt("2025-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(false);
    expect(isNewerUpdatedAt(undefined, "2026-01-01T00:00:00.000Z")).toBe(false);
    expect(isNewerUpdatedAt("2026-01-01T00:00:00.000Z", undefined)).toBe(false);
  });
});
