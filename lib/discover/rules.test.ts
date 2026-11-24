import { describe, it, expect } from "vitest";
import { listingSet } from "@/lib/discover/rules";

const now = new Date("2026-11-24T00:00:00.000Z");

describe("listingSet", () => {
  it("sets listedAt when unset listing turns on while published", () => {
    expect(listingSet({ listedAt: null }, { listed: true, published: true }, now)).toEqual({
      "discover.listed": true,
      "discover.listedAt": now,
    });
  });

  it("does not set listedAt when listing turns on while unpublished", () => {
    expect(listingSet({ listedAt: null }, { listed: true, published: false }, now)).toEqual({
      "discover.listed": true,
    });
  });

  it("never replaces an existing listedAt", () => {
    const earlier = new Date("2026-01-01T00:00:00.000Z");
    expect(listingSet({ listed: true, listedAt: earlier }, { listed: true, published: true }, now)).toEqual({
      "discover.listed": true,
    });
  });

  it("keeps listedAt untouched when listing turns off", () => {
    const earlier = new Date("2026-01-01T00:00:00.000Z");
    expect(listingSet({ listed: true, listedAt: earlier }, { listed: false, published: true }, now)).toEqual({
      "discover.listed": false,
    });
  });
});
