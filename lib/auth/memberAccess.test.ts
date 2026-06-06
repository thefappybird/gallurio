import { describe, expect, it } from "vitest";
import {
  isMemberBlocked,
  landingPathForRole,
  MEMBER_BLOCKED_PREFIXES,
  stripLocale,
} from "./memberAccess";

// ---------------------------------------------------------------------------
// stripLocale
// ---------------------------------------------------------------------------
describe("stripLocale", () => {
  it("leaves bare English paths unchanged (en is the default, no prefix)", () => {
    expect(stripLocale("/dashboard")).toBe("/dashboard");
    expect(stripLocale("/bookings")).toBe("/bookings");
    expect(stripLocale("/clients/123")).toBe("/clients/123");
  });

  it("strips a leading /fil prefix", () => {
    expect(stripLocale("/fil/dashboard")).toBe("/dashboard");
    expect(stripLocale("/fil/bookings")).toBe("/bookings");
    expect(stripLocale("/fil")).toBe("/");
  });

  it("strips a leading /ms prefix", () => {
    expect(stripLocale("/ms/dashboard")).toBe("/dashboard");
    expect(stripLocale("/ms")).toBe("/");
  });

  it("strips a leading /id prefix", () => {
    expect(stripLocale("/id/settings/account")).toBe("/settings/account");
  });

  it("strips a leading /th prefix", () => {
    expect(stripLocale("/th/gallery")).toBe("/gallery");
  });

  it("strips /en prefix even though en URLs are not emitted with it (regex covers all locales)", () => {
    // The LOCALE_PREFIX_RE is derived from routing.locales which includes "en".
    // next-intl never generates /en/... URLs in production (localePrefix:
    // "as-needed"), but if such a path arrives the proxy strips it correctly.
    expect(stripLocale("/en/dashboard")).toBe("/dashboard");
  });

  it("returns '/' when path is exactly a locale prefix with no trailing slash", () => {
    expect(stripLocale("/fil")).toBe("/");
    expect(stripLocale("/ms")).toBe("/");
  });

  it("leaves '/' unchanged", () => {
    expect(stripLocale("/")).toBe("/");
  });
});

// ---------------------------------------------------------------------------
// isMemberBlocked
// ---------------------------------------------------------------------------
describe("isMemberBlocked", () => {
  // --- Routes that SHOULD be blocked ---

  it("blocks /dashboard (exact)", () => {
    expect(isMemberBlocked("/dashboard")).toBe(true);
  });

  it("blocks /dashboard/anything (nested)", () => {
    expect(isMemberBlocked("/dashboard/anything")).toBe(true);
    expect(isMemberBlocked("/dashboard/analytics/overview")).toBe(true);
  });

  it("blocks /teams (exact)", () => {
    expect(isMemberBlocked("/teams")).toBe(true);
  });

  it("blocks /inquiries and /portfolio", () => {
    expect(isMemberBlocked("/inquiries")).toBe(true);
    expect(isMemberBlocked("/inquiries/abc123")).toBe(true);
    expect(isMemberBlocked("/portfolio")).toBe(true);
    expect(isMemberBlocked("/portfolio/preview")).toBe(true);
  });

  it("blocks /teams/* (nested)", () => {
    expect(isMemberBlocked("/teams/abc123")).toBe(true);
  });

  it("blocks /gallery", () => {
    expect(isMemberBlocked("/gallery")).toBe(true);
    expect(isMemberBlocked("/gallery/collections")).toBe(true);
  });

  it("blocks /page-builder", () => {
    expect(isMemberBlocked("/page-builder")).toBe(true);
    expect(isMemberBlocked("/page-builder/wizard")).toBe(true);
  });

  it("blocks locale-prefixed /fil/dashboard", () => {
    expect(isMemberBlocked("/fil/dashboard")).toBe(true);
    expect(isMemberBlocked("/fil/dashboard/stats")).toBe(true);
  });

  it("blocks locale-prefixed /ms/teams", () => {
    expect(isMemberBlocked("/ms/teams")).toBe(true);
  });

  it("blocks locale-prefixed /fil/inquiries and /id/portfolio", () => {
    expect(isMemberBlocked("/fil/inquiries")).toBe(true);
    expect(isMemberBlocked("/id/portfolio")).toBe(true);
  });

  it("blocks locale-prefixed /id/gallery", () => {
    expect(isMemberBlocked("/id/gallery")).toBe(true);
  });

  it("blocks locale-prefixed /th/page-builder", () => {
    expect(isMemberBlocked("/th/page-builder")).toBe(true);
  });

  // --- Routes that should NOT be blocked ---

  it("does NOT block /bookings", () => {
    expect(isMemberBlocked("/bookings")).toBe(false);
    expect(isMemberBlocked("/bookings/123")).toBe(false);
  });

  it("does NOT block /clients (tab-gated at page level)", () => {
    expect(isMemberBlocked("/clients")).toBe(false);
    expect(isMemberBlocked("/clients/123")).toBe(false);
  });

  it("does NOT block /settings (tab-gated at page level)", () => {
    expect(isMemberBlocked("/settings")).toBe(false);
    expect(isMemberBlocked("/settings/account")).toBe(false);
    expect(isMemberBlocked("/settings/workspace")).toBe(false);
  });

  it("does NOT block '/' (root)", () => {
    expect(isMemberBlocked("/")).toBe(false);
  });

  // --- Prefix boundary checks ---
  // A path that merely starts with a blocked prefix string but doesn't match
  // at a path-segment boundary must NOT be blocked.

  it("does NOT block /dashboardish (false prefix match)", () => {
    expect(isMemberBlocked("/dashboardish")).toBe(false);
  });

  it("does NOT block /teams-report (false prefix match)", () => {
    expect(isMemberBlocked("/teams-report")).toBe(false);
  });

  it("does NOT block /galleryx (false prefix match)", () => {
    expect(isMemberBlocked("/galleryx")).toBe(false);
  });

  it("does NOT block /page-builderX (false prefix match)", () => {
    expect(isMemberBlocked("/page-builderX")).toBe(false);
  });

  it("does NOT block locale-prefixed /fil/dashboardish", () => {
    expect(isMemberBlocked("/fil/dashboardish")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// landingPathForRole
// ---------------------------------------------------------------------------
describe("landingPathForRole", () => {
  it("returns /dashboard for org:admin", () => {
    expect(landingPathForRole("org:admin")).toBe("/dashboard");
  });

  it("returns /bookings for org:member", () => {
    expect(landingPathForRole("org:member")).toBe("/bookings");
  });

  it("returns /bookings for null (no org role)", () => {
    expect(landingPathForRole(null)).toBe("/bookings");
  });

  it("returns /bookings for undefined (no org role)", () => {
    expect(landingPathForRole(undefined)).toBe("/bookings");
  });

  it("returns /bookings for an unrecognised role string", () => {
    expect(landingPathForRole("org:billing")).toBe("/bookings");
  });
});

// ---------------------------------------------------------------------------
// MEMBER_BLOCKED_PREFIXES export sanity check
// ---------------------------------------------------------------------------
describe("MEMBER_BLOCKED_PREFIXES", () => {
  it("exports the canonical list of blocked prefixes", () => {
    expect(MEMBER_BLOCKED_PREFIXES).toContain("/dashboard");
    expect(MEMBER_BLOCKED_PREFIXES).toContain("/inquiries");
    expect(MEMBER_BLOCKED_PREFIXES).toContain("/portfolio");
    expect(MEMBER_BLOCKED_PREFIXES).toContain("/teams");
    expect(MEMBER_BLOCKED_PREFIXES).toContain("/gallery");
    expect(MEMBER_BLOCKED_PREFIXES).toContain("/page-builder");
    // /clients and /settings must NOT be in the list
    expect(MEMBER_BLOCKED_PREFIXES).not.toContain("/clients");
    expect(MEMBER_BLOCKED_PREFIXES).not.toContain("/settings");
  });
});
