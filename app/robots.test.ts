import { describe, it, expect } from "vitest";
import robots from "./robots";

describe("robots()", () => {
  it("allows /w/ and disallows app shell and api routes", () => {
    const result = robots();

    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules).toHaveLength(1);
    const rule = rules[0];

    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/w/");
    expect(rule.disallow).toEqual(["/en/", "/fil/", "/ms/", "/id/", "/ar/", "/api/"]);
  });

  it("includes /sitemap.xml in the sitemap field", () => {
    const result = robots();
    expect(typeof result.sitemap).toBe("string");
    expect((result.sitemap as string).endsWith("/sitemap.xml")).toBe(true);
  });
});
