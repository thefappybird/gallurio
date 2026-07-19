import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import {
  checkAuthRateLimit,
  __resetAuthRateLimitForTests,
} from "./authRateLimit";

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
afterEach(async () => {
  await clearCollections();
  await __resetAuthRateLimitForTests();
});

const NOW = Date.now();

describe("checkAuthRateLimit — email dimension (5 / 15 min)", () => {
  it("allows the first 5 attempts", async () => {
    for (let i = 0; i < 5; i++) {
      const result = await checkAuthRateLimit({ email: "user@test.com" }, NOW + i);
      expect(result.ok).toBe(true);
    }
  });

  it("blocks the 6th attempt", async () => {
    for (let i = 0; i < 5; i++) {
      await checkAuthRateLimit({ email: "blocked@test.com" }, NOW + i);
    }
    const result = await checkAuthRateLimit({ email: "blocked@test.com" }, NOW + 5);
    expect(result.ok).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after the window expires", async () => {
    for (let i = 0; i < 5; i++) {
      await checkAuthRateLimit({ email: "window@test.com" }, NOW + i);
    }
    // Advance 15 minutes + 1 second into the next window.
    const nextWindow = NOW + 15 * 60 * 1000 + 1000;
    const result = await checkAuthRateLimit({ email: "window@test.com" }, nextWindow);
    expect(result.ok).toBe(true);
  });

  it("isolates counters by email address", async () => {
    for (let i = 0; i < 5; i++) {
      await checkAuthRateLimit({ email: "alice@test.com" }, NOW + i);
    }
    // alice is blocked; bob should still be allowed.
    const bobResult = await checkAuthRateLimit({ email: "bob@test.com" }, NOW + 10);
    expect(bobResult.ok).toBe(true);
  });
});

describe("checkAuthRateLimit — IP dimension (20 / 15 min)", () => {
  it("allows the first 20 attempts", async () => {
    for (let i = 0; i < 20; i++) {
      const result = await checkAuthRateLimit({ ip: "192.0.2.1" }, NOW + i);
      expect(result.ok).toBe(true);
    }
  });

  it("blocks the 21st attempt", async () => {
    for (let i = 0; i < 20; i++) {
      await checkAuthRateLimit({ ip: "192.0.2.2" }, NOW + i);
    }
    const result = await checkAuthRateLimit({ ip: "192.0.2.2" }, NOW + 20);
    expect(result.ok).toBe(false);
  });
});

describe("checkAuthRateLimit — combined email + IP", () => {
  it("blocks when email limit is hit regardless of IP headroom", async () => {
    for (let i = 0; i < 5; i++) {
      await checkAuthRateLimit({ email: "combo@test.com", ip: "10.0.0.1" }, NOW + i);
    }
    const result = await checkAuthRateLimit(
      { email: "combo@test.com", ip: "10.0.0.1" },
      NOW + 5,
    );
    expect(result.ok).toBe(false);
  });

  it("blocks when IP limit is hit regardless of email headroom", async () => {
    // Fill the IP bucket from many different emails.
    for (let i = 0; i < 20; i++) {
      await checkAuthRateLimit({ email: `user${i}@test.com`, ip: "10.0.0.2" }, NOW + i);
    }
    // Fresh email, same IP.
    const result = await checkAuthRateLimit(
      { email: "fresh@test.com", ip: "10.0.0.2" },
      NOW + 20,
    );
    expect(result.ok).toBe(false);
  });

  it("enforces email and IP limits independently (both tracked)", async () => {
    // 3 attempts from different IPs on the same email.
    for (let i = 0; i < 3; i++) {
      await checkAuthRateLimit({ email: "shared@test.com", ip: `10.0.0.${i + 10}` }, NOW + i);
    }
    // 2 more from the same email — total 5.
    for (let i = 3; i < 5; i++) {
      await checkAuthRateLimit({ email: "shared@test.com", ip: `10.0.0.${i + 10}` }, NOW + i);
    }
    // 6th attempt on that email should be blocked.
    const result = await checkAuthRateLimit(
      { email: "shared@test.com", ip: "10.0.0.99" },
      NOW + 5,
    );
    expect(result.ok).toBe(false);
  });
});

describe("checkAuthRateLimit — idempotency / atomicity", () => {
  it("parallel increments do not double-count below the limit", async () => {
    // Fire 5 concurrent requests.
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        checkAuthRateLimit({ email: "parallel@test.com" }, NOW + i),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });
});
