import { afterEach, describe, expect, it } from "vitest";
import { rateLimit, __resetRateLimitForTests } from "./rateLimit";

afterEach(() => {
  __resetRateLimitForTests();
});

describe("rateLimit", () => {
  it("allows up to the limit then rejects the next hit", () => {
    const t = 1_000_000;
    const now = () => t;
    const opts = { limit: 5, windowMs: 10 * 60_000, now };

    for (let i = 0; i < 5; i += 1) {
      const r = rateLimit("ip-a", opts);
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(5 - (i + 1));
    }

    const sixth = rateLimit("ip-a", opts);
    expect(sixth.ok).toBe(false);
    expect(sixth.remaining).toBe(0);
  });

  it("isolates counters per key", () => {
    const now = () => 1_000_000;
    const opts = { limit: 2, windowMs: 60_000, now };

    expect(rateLimit("ip-a", opts).ok).toBe(true);
    expect(rateLimit("ip-a", opts).ok).toBe(true);
    expect(rateLimit("ip-a", opts).ok).toBe(false);

    // Different key is unaffected.
    expect(rateLimit("ip-b", opts).ok).toBe(true);
  });

  it("frees the window as time passes (sliding window)", () => {
    let t = 0;
    const now = () => t;
    const opts = { limit: 2, windowMs: 1_000, now };

    expect(rateLimit("ip", opts).ok).toBe(true); // hit at t=0
    t = 500;
    expect(rateLimit("ip", opts).ok).toBe(true); // hit at t=500
    t = 600;
    expect(rateLimit("ip", opts).ok).toBe(false); // window full (0 and 500)

    // Advance past the first hit's expiry (t=0 + 1000 = 1000).
    t = 1_001;
    // Now only the t=500 hit remains in-window → allowed again.
    expect(rateLimit("ip", opts).ok).toBe(true);
  });

  it("does not let a hammering client push its own reset time forward", () => {
    let t = 0;
    const now = () => t;
    const opts = { limit: 1, windowMs: 1_000, now };

    expect(rateLimit("ip", opts).ok).toBe(true); // t=0
    const rejectedAt500 = (() => {
      t = 500;
      return rateLimit("ip", opts);
    })();
    expect(rejectedAt500.ok).toBe(false);
    // Reset stays anchored to the original allowed hit (0 + 1000), not 500+1000.
    expect(rejectedAt500.resetAt).toBe(1_000);

    t = 1_001;
    expect(rateLimit("ip", opts).ok).toBe(true);
  });
});
