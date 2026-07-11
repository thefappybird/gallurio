/**
 * Email render harness — visual verification artifact generator.
 *
 * Runs under vitest (which already shims `server-only` and resolves `@/`).
 * Mocks `sendEmail` to capture rendered HTML, then writes every combination to
 * the temp dir so Playwright can screenshot them.
 *
 * Matrix:
 *   - Brands:  platform (gallurioBrand) and partner (resolveWorkspaceBrand with
 *              a warm accent #c05621 + logo URL to stress contrast checks).
 *   - CTA variants: with NEXT_PUBLIC_APP_URL set and unset (for emails that branch).
 *   - Locales:  en, fil, ms, id (partner-branded emails only; platform emails are
 *              English-only by convention).
 *   - Templates: all 9 distinct templates covered (see RENDERED_LOG below).
 *
 * Output: C:\Users\alexb\AppData\Local\Temp\gallurio-email-render\*.html
 * Screenshot step: scripts/screenshot-emails.ts (standalone Playwright script).
 *
 * Run:
 *   pnpm exec vitest run scripts/render-emails.test.ts
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock sendEmail BEFORE importing any sender (hoisting-safe approach).
// ---------------------------------------------------------------------------
const sendEmail = vi.fn().mockResolvedValue({ ok: true, id: "mock_id" });
vi.mock("@/lib/email/send", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

// ---------------------------------------------------------------------------
// Sender imports (after mock is registered)
// ---------------------------------------------------------------------------
import { sendInquiryNotification } from "@/lib/email/inquiryNotification";
import { sendInquiryClientConfirmation } from "@/lib/email/inquiryClientConfirmation";
import { sendTeamInviteEmail } from "@/lib/email/teamInvite";
import { sendNotificationEmail } from "@/lib/email/notifications";
import { sendBookingConfirmedClient, sendBookingConfirmedOwner } from "@/lib/email/booking/bookingConfirmed";
import { sendBookingCancelledClient } from "@/lib/email/booking/bookingCancelled";
import { sendInquiryDeclineClient } from "@/lib/email/booking/inquiryDecline";
import { sendPasswordResetEmail } from "@/lib/email/sendPasswordResetEmail";
import { renderBrandedEmail } from "@/lib/email/layout";
import { gallurioBrand, resolveWorkspaceBrand } from "@/lib/email/brand";
import { EMAIL_COPY } from "@/lib/email/messages";

// ---------------------------------------------------------------------------
// Artifact directory
// ---------------------------------------------------------------------------
const OUT_DIR = path.join(os.tmpdir(), "gallurio-email-render");

beforeEach(() => {
  sendEmail.mockClear();
  sendEmail.mockResolvedValue({ ok: true, id: "mock_id" });
});

// Track what was rendered for the final manifest file
const RENDERED_LOG: Array<{ file: string; template: string; brand: string; locale: string; cta: string }> = [];
const SKIPPED_LOG: string[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write an HTML artifact and log it. */
function writeHtml(
  filename: string,
  html: string,
  meta: { template: string; brand: string; locale: string; cta: string },
): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const filePath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filePath, html, "utf8");
  RENDERED_LOG.push({ file: filePath, ...meta });
}

/** Capture the html from the last sendEmail call. */
function capturedHtml(): string {
  const calls = sendEmail.mock.calls;
  if (!calls.length) throw new Error("sendEmail was not called");
  return (calls[calls.length - 1][0] as { html: string }).html;
}

// ---------------------------------------------------------------------------
// Fixture workspace brand — warm orange accent to stress contrast.
// logoUrl is a small public SVG so the img tag renders without 404.
// ---------------------------------------------------------------------------
const PARTNER_ACCENT = "#c05621"; // warm orange — stresses WCAG contrast check
const PARTNER_LOGO_URL = "https://placehold.co/120x32/c05621/ffffff?text=Studio+A";

const partnerBrand = resolveWorkspaceBrand({
  name: "Studio Aurora",
  publicPage: {
    header: { logoUrl: PARTNER_LOGO_URL },
    brandKit: { accentColor: PARTNER_ACCENT },
  },
  contact: { email: "hello@studio-aurora.test" },
});

// ---------------------------------------------------------------------------
// SESSION / BOOKING FIXTURE
// ---------------------------------------------------------------------------
const SESSIONS = [
  { startDate: "2026-08-15", startTime: "10:00", endTime: "18:00" },
];

// ===========================================================================
// 1. PLATFORM EMAILS (gallurioBrand, English only)
// ===========================================================================

describe("platform emails", () => {
  // -------------------------------------------------------------------------
  // 1a. Inquiry notification (owner) — both CTA variants
  // -------------------------------------------------------------------------
  it("inquiry notification — with CTA", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.gallurio.test";
    await sendInquiryNotification({
      workspaceName: "Studio Aurora",
      recipientEmail: "owner@studio.test",
      inquiryId: "inq_42",
      ownerEmail: "owner@studio.test",
      clientName: "Emma Carter",
      clientEmail: "emma@example.com",
      clientPhone: "+63 900 000 0000",
      preferredContact: "email",
      eventTitle: "Emma & Noah Wedding",
      eventType: "wedding",
      location: { label: "Tagaytay Highlands", address: "Tagaytay, Cavite, Philippines", placeId: "place_1", lat: 14.1154, lng: 120.9621 },
      description: "Looking for full-day coverage with a documentary style.",
      sessions: SESSIONS,
      isRecipientGated: false,
    });
    const html = capturedHtml();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Emma Carter");
    expect(html).toContain("/inquiry-redirect?inquiryId=inq_42");
    expect(html).toContain("@media (prefers-color-scheme: dark)");
    expect(html).toContain("min-height:44px");
    writeHtml("platform-inquiry-notification-en-cta.html", html, {
      template: "inquiry-notification",
      brand: "platform",
      locale: "en",
      cta: "with-cta",
    });
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("inquiry notification — no CTA", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    await sendInquiryNotification({
      workspaceName: "Studio Aurora",
      recipientEmail: "owner@studio.test",
      inquiryId: "inq_55",
      ownerEmail: "owner@studio.test",
      clientName: "Emma Carter",
      clientEmail: "emma@example.com",
      clientPhone: null,
      preferredContact: "phone",
      eventTitle: "Emma & Noah Wedding",
      eventType: "wedding",
      location: { label: null, address: null, placeId: null, lat: null, lng: null },
      description: "Short inquiry.",
      sessions: [],
      isRecipientGated: false,
    });
    const html = capturedHtml();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).not.toContain("/inquiries");
    writeHtml("platform-inquiry-notification-en-no-cta.html", html, {
      template: "inquiry-notification",
      brand: "platform",
      locale: "en",
      cta: "no-cta",
    });
  });

  // -------------------------------------------------------------------------
  // 1b. Booking confirmed (owner) — both CTA variants
  // -------------------------------------------------------------------------
  it("booking confirmed owner — with CTA", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.gallurio.test";
    await sendBookingConfirmedOwner({
      ownerEmail: "owner@studio.test",
      clientName: "Emma Carter",
      eventTitle: "Emma & Noah Wedding",
      bookingId: "bk_001",
    });
    const html = capturedHtml();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Booking confirmed");
    expect(html).toContain("/bookings?detail=bk_001");
    expect(html).toContain("@media (prefers-color-scheme: dark)");
    writeHtml("platform-booking-confirmed-owner-en-cta.html", html, {
      template: "booking-confirmed-owner",
      brand: "platform",
      locale: "en",
      cta: "with-cta",
    });
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("booking confirmed owner — no CTA", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    await sendBookingConfirmedOwner({
      ownerEmail: "owner@studio.test",
      clientName: "Emma Carter",
      eventTitle: "Emma & Noah Wedding",
      bookingId: "bk_002",
    });
    const html = capturedHtml();
    expect(html).toContain("Open your booking dashboard");
    writeHtml("platform-booking-confirmed-owner-en-no-cta.html", html, {
      template: "booking-confirmed-owner",
      brand: "platform",
      locale: "en",
      cta: "no-cta",
    });
  });

  // -------------------------------------------------------------------------
  // 1c. Notification email — both CTA variants
  // -------------------------------------------------------------------------
  it("notification email — with CTA", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.gallurio.test";
    await sendNotificationEmail({
      recipient: { email: "owner@studio.test", name: "Owner" },
      title: "New team member added",
      body: "Alex joined Studio Aurora.",
      href: "/team",
      type: "team.invitation",
    });
    const html = capturedHtml();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("New team member added");
    writeHtml("platform-notification-en-cta.html", html, {
      template: "notification",
      brand: "platform",
      locale: "en",
      cta: "with-cta",
    });
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("notification email — no CTA", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    await sendNotificationEmail({
      recipient: { email: "owner@studio.test" },
      title: "Your gallery was updated",
      body: "5 new photos were added to your gallery.",
      href: "/gallery",
      type: "gallery.updated" as never,
    });
    const html = capturedHtml();
    expect(html).toContain("Open the app to view this notification.");
    writeHtml("platform-notification-en-no-cta.html", html, {
      template: "notification",
      brand: "platform",
      locale: "en",
      cta: "no-cta",
    });
  });

  // -------------------------------------------------------------------------
  // 1d. Verification email (platform, English only per convention)
  // -------------------------------------------------------------------------
  it("verification email", () => {
    const copy = EMAIL_COPY.verification.en;
    const { html } = renderBrandedEmail({
      brand: gallurioBrand(),
      locale: "en",
      preheader: copy.intro,
      title: "Verify your email",
      blocks: [
        { type: "p", text: copy.greeting },
        { type: "p", text: copy.intro },
        { type: "p", text: copy.codeLabel },
        { type: "heading", text: "123456" },
        { type: "p", text: copy.expiry },
        { type: "spacer" },
        { type: "p", text: copy.ignore },
      ],
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("123456");
    expect(html).toContain("@media (prefers-color-scheme: dark)");
    writeHtml("platform-verification-en.html", html, {
      template: "verification",
      brand: "platform",
      locale: "en",
      cta: "no-cta",
    });
  });

  // -------------------------------------------------------------------------
  // 1e. Password reset (platform)
  // -------------------------------------------------------------------------
  it("password reset — en", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.gallurio.test";
    await sendPasswordResetEmail("user@test.com", "tok_abc123", "en");
    const html = capturedHtml();
    expect(html).toContain("Reset");
    expect(html).toContain("min-height:44px");
    writeHtml("platform-password-reset-en-cta.html", html, {
      template: "password-reset",
      brand: "platform",
      locale: "en",
      cta: "with-cta",
    });
    delete process.env.NEXT_PUBLIC_APP_URL;
  });
});

// ===========================================================================
// 2. PARTNER EMAILS — all 4 locales
// ===========================================================================

describe("partner emails — all locales", () => {
  const locales = ["en", "fil", "ms", "id"] as const;

  // -------------------------------------------------------------------------
  // 2a. Team invite (partner brand)
  // -------------------------------------------------------------------------
  for (const locale of locales) {
    it(`team invite — ${locale}`, async () => {
      await sendTeamInviteEmail({
        to: "staff@test.com",
        inviterName: "Aurelio Cruz",
        workspaceName: "Studio Aurora",
        teamNames: ["Photography", "Videography"],
        acceptUrl: "https://app.gallurio.test/accept-invite?token=abc",
        locale,
        brand: partnerBrand,
      });
      const html = capturedHtml();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain(PARTNER_ACCENT);
      // Logo img tag present
      expect(html).toContain("<img");
      expect(html).toContain(PARTNER_LOGO_URL);
      // CTA present (team invite always has one)
      expect(html).toContain("min-height:44px");
      expect(html).toContain("@media (prefers-color-scheme: dark)");
      writeHtml(`partner-team-invite-${locale}-cta.html`, html, {
        template: "team-invite",
        brand: "partner",
        locale,
        cta: "with-cta",
      });
    });
  }

  // -------------------------------------------------------------------------
  // 2b. Inquiry client confirmation (partner brand)
  // -------------------------------------------------------------------------
  for (const locale of locales) {
    // Use country code to drive locale resolution (emailLocale wraps localeForCountry)
    const countryByLocale: Record<typeof locale, string> = {
      en: "SG",
      fil: "PH",
      ms: "MY",
      id: "ID",
    };
    it(`inquiry client confirmation — ${locale}`, async () => {
      await sendInquiryClientConfirmation({
        workspaceName: "Studio Aurora",
        clientEmail: "client@test.com",
        clientName: "Maria Santos",
        ownerEmail: "owner@studio.test",
        brand: partnerBrand,
        country: countryByLocale[locale],
      });
      const html = capturedHtml();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain(PARTNER_ACCENT);
      expect(html).toContain("<img");
      writeHtml(`partner-inquiry-confirmation-${locale}-no-cta.html`, html, {
        template: "inquiry-confirmation",
        brand: "partner",
        locale,
        cta: "no-cta",
      });
    });
  }

  // -------------------------------------------------------------------------
  // 2c. Booking confirmed (client) — partner brand
  // -------------------------------------------------------------------------
  for (const locale of locales) {
    it(`booking confirmed client — ${locale}`, async () => {
      await sendBookingConfirmedClient({
        brand: partnerBrand,
        locale: locale === "en" ? "SG" : locale === "fil" ? "PH" : locale === "ms" ? "MY" : "ID",
        clientName: "Maria Santos",
        clientEmail: "client@test.com",
        businessName: "Studio Aurora",
        eventTitle: "Maria & Jose Wedding",
        sessions: SESSIONS,
        replyTo: "hello@studio-aurora.test",
      });
      const html = capturedHtml();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain(PARTNER_ACCENT);
      expect(html).toContain("<img");
      writeHtml(`partner-booking-confirmed-client-${locale}-no-cta.html`, html, {
        template: "booking-confirmed-client",
        brand: "partner",
        locale,
        cta: "no-cta",
      });
    });
  }

  // -------------------------------------------------------------------------
  // 2d. Booking cancelled (client) — partner brand
  // -------------------------------------------------------------------------
  for (const locale of locales) {
    it(`booking cancelled client — ${locale}`, async () => {
      await sendBookingCancelledClient({
        brand: partnerBrand,
        locale: locale === "en" ? "SG" : locale === "fil" ? "PH" : locale === "ms" ? "MY" : "ID",
        clientName: "Maria Santos",
        clientEmail: "client@test.com",
        businessName: "Studio Aurora",
        eventTitle: "Maria & Jose Wedding",
        sessions: SESSIONS,
        replyTo: "hello@studio-aurora.test",
      });
      const html = capturedHtml();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain(PARTNER_ACCENT);
      writeHtml(`partner-booking-cancelled-client-${locale}-no-cta.html`, html, {
        template: "booking-cancelled-client",
        brand: "partner",
        locale,
        cta: "no-cta",
      });
    });
  }

  // -------------------------------------------------------------------------
  // 2e. Inquiry decline (client) — partner brand
  // -------------------------------------------------------------------------
  for (const locale of locales) {
    it(`inquiry decline client — ${locale}`, async () => {
      await sendInquiryDeclineClient({
        brand: partnerBrand,
        locale: locale === "en" ? "SG" : locale === "fil" ? "PH" : locale === "ms" ? "MY" : "ID",
        clientName: "Maria Santos",
        clientEmail: "client@test.com",
        businessName: "Studio Aurora",
        replyTo: "hello@studio-aurora.test",
      });
      const html = capturedHtml();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain(PARTNER_ACCENT);
      writeHtml(`partner-inquiry-decline-${locale}-no-cta.html`, html, {
        template: "inquiry-decline",
        brand: "partner",
        locale,
        cta: "no-cta",
      });
    });
  }
});

// ===========================================================================
// Manifest
// ===========================================================================

afterAll(() => {
  const manifestPath = path.join(OUT_DIR, "manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ rendered: RENDERED_LOG, skipped: SKIPPED_LOG }, null, 2),
    "utf8",
  );
  console.log(`\n[render-harness] ${RENDERED_LOG.length} HTML artifacts → ${OUT_DIR}`);
  console.log(`[render-harness] manifest → ${manifestPath}`);
  if (SKIPPED_LOG.length) {
    console.log("[render-harness] skipped:", SKIPPED_LOG.join(", "));
  }
});
