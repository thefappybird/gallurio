import { beforeAll, describe, expect, it } from "vitest";
import {
  utcMidnight,
  visitorHash,
  isBotUserAgent,
  classifySource,
} from "./pageview";

beforeAll(() => {
  process.env.PAGEVIEW_SALT_SECRET = "test-secret";
});

describe("utcMidnight", () => {
  it("zeroes the UTC time of day", () => {
    expect(utcMidnight(new Date("2026-06-01T13:45:30Z")).toISOString()).toBe(
      "2026-06-01T00:00:00.000Z"
    );
  });
});

describe("visitorHash", () => {
  it("is stable within a UTC day, varies by ip/ua, and rotates across days", () => {
    const morning = new Date("2026-06-01T08:00:00Z");
    const evening = new Date("2026-06-01T22:00:00Z");
    const nextDay = new Date("2026-06-02T02:00:00Z");

    const base = visitorHash("1.2.3.4", "UA", morning);
    expect(visitorHash("1.2.3.4", "UA", evening)).toBe(base); // same day → same hash
    expect(visitorHash("9.9.9.9", "UA", morning)).not.toBe(base); // different ip
    expect(visitorHash("1.2.3.4", "OTHER", morning)).not.toBe(base); // different ua
    expect(visitorHash("1.2.3.4", "UA", nextDay)).not.toBe(base); // salt rotated
  });
});

describe("isBotUserAgent", () => {
  it("flags bots, missing, and too-short UAs but allows a real browser UA", () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent("curl/8.0")).toBe(true);
    expect(isBotUserAgent("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
      )
    ).toBe(false);
  });
});

describe("classifySource", () => {
  it("prefers utm, then external referrer host (dot/$-safe), else direct", () => {
    expect(classifySource(null, "instagram", "site.com")).toBe("instagram");
    expect(classifySource("https://www.google.com/", null, "site.com")).toBe("www_google_com");
    expect(classifySource("https://site.com/page", null, "site.com")).toBe("direct");
    expect(classifySource(null, null, "site.com")).toBe("direct");
    expect(classifySource("not-a-url", null, "site.com")).toBe("direct");
    // No "." or "$" can leak into the key (would break Map / $inc dotted paths).
    expect(classifySource(null, "weird.$source", "site.com")).not.toMatch(/[.$]/);
  });
});
