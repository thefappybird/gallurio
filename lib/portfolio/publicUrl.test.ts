import { describe, it, expect, afterEach } from "vitest";
import {
  portfolioBaseDomain,
  portfolioGalleryUrl,
  portfolioPublicUrl,
  portfolioUrlParts,
} from "./publicUrl";

const originalEnv = { ...process.env };
afterEach(() => {
  Object.assign(process.env, originalEnv);
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
});

describe("portfolioBaseDomain", () => {
  it("returns null when NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN is not set", () => {
    delete process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN;
    expect(portfolioBaseDomain()).toBeNull();
  });

  it("returns null when the var is whitespace only", () => {
    process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN = "   ";
    expect(portfolioBaseDomain()).toBeNull();
  });

  it("returns the trimmed domain when set", () => {
    process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN = "  gallurio.com  ";
    expect(portfolioBaseDomain()).toBe("gallurio.com");
  });
});

describe("portfolioPublicUrl", () => {
  it("builds a path-based URL in dev (no base domain set)", () => {
    delete process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(portfolioPublicUrl("acme")).toBe("http://localhost:3000/w/acme");
  });

  it("builds a subdomain URL in production (base domain set)", () => {
    process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN = "gallurio.com";
    expect(portfolioPublicUrl("acme")).toBe("https://acme.gallurio.com");
  });
});

describe("portfolioUrlParts", () => {
  it("returns path mode parts when no base domain is set", () => {
    delete process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    const parts = portfolioUrlParts("acme");
    expect(parts.mode).toBe("path");
    expect(parts.prefix).toBe("http://localhost:3000/w/");
    expect(parts.slug).toBe("acme");
    expect(parts.suffix).toBe("");
    expect(parts.full).toBe("http://localhost:3000/w/acme");
  });

  it("returns subdomain mode parts when base domain is set", () => {
    process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN = "gallurio.com";
    const parts = portfolioUrlParts("acme");
    expect(parts.mode).toBe("subdomain");
    expect(parts.prefix).toBe("");
    expect(parts.slug).toBe("acme");
    expect(parts.suffix).toBe(".gallurio.com");
    expect(parts.full).toBe("https://acme.gallurio.com");
  });
});

describe("portfolioGalleryUrl", () => {
  it("uses the internal path route when subdomains are disabled", () => {
    delete process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(portfolioGalleryUrl("acme")).toBe("http://localhost:3000/w/acme/gallery");
  });

  it("uses the clean /gallery route on a tenant subdomain", () => {
    process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN = "gallurio.com";
    expect(portfolioGalleryUrl("acme")).toBe("https://acme.gallurio.com/gallery");
  });
});
