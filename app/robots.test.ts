import { describe, it, expect } from "vitest";
import robots from "./robots";

function ruleFor(result: ReturnType<typeof robots>, agent: string) {
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  const rule = rules.find((r) => {
    const ua = r.userAgent;
    return Array.isArray(ua) ? ua.includes(agent) : ua === agent;
  });
  if (!rule) throw new Error(`no rule for user agent ${agent}`);
  return rule;
}

function disallowList(result: ReturnType<typeof robots>, agent: string) {
  const { disallow } = ruleFor(result, agent);
  return Array.isArray(disallow) ? disallow : disallow ? [disallow] : [];
}

describe("robots()", () => {
  it("disallows an app segment at both its unprefixed and locale-prefixed paths", () => {
    const disallow = disallowList(robots(), "*");

    expect(disallow).toContain("/dashboard");
    expect(disallow).toContain("/fil/dashboard");
  });

  it("keeps every locale's marketing pages crawlable", () => {
    const disallow = disallowList(robots(), "*");

    expect(disallow).not.toContain("/fil/");
    expect(disallow).not.toContain("/th/");
  });

  it("names AI crawlers and gives them the same access as everyone else", () => {
    const result = robots();

    for (const agent of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
      expect(disallowList(result, agent)).toContain("/dashboard");
      expect(ruleFor(result, agent).allow).toContain("/w/");
    }
  });

  it("re-opens the public portfolio demo that the /portfolio rule would shadow", () => {
    const rule = ruleFor(robots(), "*");

    expect(rule.disallow).toContain("/portfolio");
    expect(rule.allow).toContain("/portfolio-maker-demo");
  });

  it("includes /sitemap.xml in the sitemap field", () => {
    const result = robots();
    expect(typeof result.sitemap).toBe("string");
    expect((result.sitemap as string).endsWith("/sitemap.xml")).toBe(true);
  });
});
