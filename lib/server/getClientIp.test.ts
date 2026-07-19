import { describe, expect, it } from "vitest";
import { getClientIp } from "./getClientIp";

describe("getClientIp", () => {
  it("prefers cf-connecting-ip over x-forwarded-for", () => {
    const headers = new Headers({
      "cf-connecting-ip": "1.1.1.1",
      "x-forwarded-for": "9.9.9.9",
    });
    expect(getClientIp(headers)).toBe("1.1.1.1");
  });

  it("two different cf-connecting-ip values yield distinct results", () => {
    const a = new Headers({ "cf-connecting-ip": "1.1.1.1" });
    const b = new Headers({ "cf-connecting-ip": "2.2.2.2" });
    expect(getClientIp(a)).not.toBe(getClientIp(b));
  });

  it("falls back to x-forwarded-for's first hop when cf-connecting-ip is absent", () => {
    const headers = new Headers({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" });
    expect(getClientIp(headers)).toBe("3.3.3.3");
  });

  it("returns 'unknown' when no IP headers are present (safe fallback)", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
