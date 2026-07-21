import { beforeEach, describe, expect, it } from "vitest";
import { getOrCreateDemoSessionId, isDemoPromoClaimed, markDemoPromoClaimed } from "./demoSession";

describe("getOrCreateDemoSessionId", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is stable across calls", () => {
    const first = getOrCreateDemoSessionId();
    const second = getOrCreateDemoSessionId();
    expect(second).toBe(first);
  });
});

describe("demo promo claimed flag", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips: unclaimed until marked, then claimed", () => {
    expect(isDemoPromoClaimed()).toBe(false);
    markDemoPromoClaimed();
    expect(isDemoPromoClaimed()).toBe(true);
  });
});
