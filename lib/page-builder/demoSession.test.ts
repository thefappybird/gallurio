import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEMO_PROMO_CLAIMED_EVENT,
  getOrCreateDemoSessionId,
  isDemoPromoClaimed,
  markDemoPromoClaimed,
} from "./demoSession";

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

  it("dispatches DEMO_PROMO_CLAIMED_EVENT so same-tab listeners react", () => {
    const listener = vi.fn();
    window.addEventListener(DEMO_PROMO_CLAIMED_EVENT, listener);
    markDemoPromoClaimed();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(DEMO_PROMO_CLAIMED_EVENT, listener);
  });
});
