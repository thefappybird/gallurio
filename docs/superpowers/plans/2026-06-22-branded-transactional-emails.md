# Branded Transactional Emails + Booking-Lifecycle Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Gallurio email one shared, accessible, localized template with two brand contexts (platform Gallurio / partner business), add the booking-lifecycle email + notification layer, make in-app notifications actor-silent, and take over the WorkOS verification email.

**Architecture:** A single hand-rolled `renderBrandedEmail({ brand, ... })` builds table-based inline-styled HTML+text for both brand contexts. Existing senders refactor onto it; new lifecycle senders hook the existing (already-implemented) status transitions. Notifications fan out to the assigned team via a shared recipient resolver and deliver silently to the actor. WorkOS verification is taken over via a signed webhook that renders with the same template.

**Tech Stack:** Next.js 16 (App Router, Node runtime route handlers), React 19, Mongoose 8, Resend (raw HTTPS API), next-intl, Vitest, `@workos-inc/node`.

**Spec:** `docs/superpowers/specs/2026-06-22-branded-transactional-emails-design.md`
**Shared codebase-memory project:** `D-Portfolio-Projects-gallurio-.claude-worktrees-branded-emails` (query this instead of broad file reads).

## Global Constraints

- **No new email dependency** — do NOT add `@react-email`/`mjml`. Hand-rolled HTML strings only.
- Emails can't use CSS vars/Tailwind/SVG — inline styles + hex; logo is the PNG `${NEXT_PUBLIC_APP_URL}/brand/email-mark.png`.
- Locales: `en`, `fil`, `ms`, `id` only (never `th`). Locale from workspace country via `localeForCountry(country)` (`lib/i18n/localeForCountry.ts`).
- Email sends are **best-effort, post-transaction** — log and continue; never roll back booking/inquiry state.
- **Tenant isolation**: every query filters by `workspaceId`; never trust client-supplied `workspaceId`.
- User-facing copy must **never name the auth provider** ("WorkOS").
- Webhook: **Node runtime**, verify HMAC on the **raw body** before parsing, **ack 200** after verification even when a handler fails.
- Escape all user-supplied values with the shared `escapeHtml`.
- Every change ships tests. Before done: `pnpm typecheck`, `pnpm lint`, affected `pnpm test` pass. Verify UI-ish output at 375px + light/dark via the render harness (Phase 4).
- `sendEmail` signature is fixed: `sendEmail({ to, subject, html, text, replyTo? }) => Promise<SendEmailResult>`.
- Run tests with `pnpm test --run <fragment>` (targeted), not the full suite, during development.
- Commit after every green task.

---

## File Structure

**New**
- `lib/email/escapeHtml.ts` — single HTML-escape util.
- `lib/email/brand.ts` — `Brand` type, `gallurioBrand()`, `resolveWorkspaceBrand()`, `ctaTextColor()`.
- `lib/email/layout.ts` — `renderBrandedEmail()` (the template).
- `lib/email/messages.ts` — per-email locale copy map + `emailLocale()`.
- `lib/email/booking/bookingConfirmed.ts`, `bookingCancelled.ts`, `inquiryDecline.ts` — lifecycle senders.
- `lib/notifications/recipients.ts` — `resolveTeamRecipients()`, `resolveStatusChangeRecipients()`.
- `app/api/webhooks/workos/route.ts` — verification webhook.
- `scripts/render-emails.ts` — render-to-file harness for screenshots.
- Tests colocated: `*.test.ts(x)`.

**Modified**
- `lib/email/teamInvite.ts`, `inquiryNotification.ts`, `inquiryClientConfirmation.ts`, `sendPasswordResetEmail.ts`, `notifications.ts` — refactor onto template.
- `lib/notifications/send.ts` — actor-silent branch.
- `lib/notifications/types.ts` + `lib/db/models/Notification.ts` — `silent` flag.
- `lib/notifications/messages.ts` — status-aware booking copy.
- `components/notifications/NotificationProvider.tsx` — ignore silent items for counter/animation.
- `app/[locale]/(app)/inquiries/_actions.ts` — approve notification + `declineInquiryAction` + archive orphan fix.
- `app/api/bookings/[id]/route.ts` — use recipient helper; client cancel email; status-aware.
- `app/[locale]/(auth)/_actions.ts` — reset email onto template; resend-verification fix.
- `messages/{en,fil,ms,id}.json` — `app.notifications.types.*` booking status copy.
- `.env.example` — `WORKOS_WEBHOOK_SECRET`.
- `REUSABLE_CODE.md` — register the template, brand resolver, recipients helper.

---

# Phase 0 — Email foundation

### Task 1: Shared `escapeHtml`

**Files:** Create `lib/email/escapeHtml.ts`; Test `lib/email/escapeHtml.test.ts`.

**Interfaces:** Produces `escapeHtml(value: unknown): string`.

- [ ] **Step 1 — failing test** (`lib/email/escapeHtml.test.ts`):
```ts
import { describe, it, expect } from "vitest";
import { escapeHtml } from "./escapeHtml";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x" & 'y'>`)).toBe(
      "&lt;a href=&quot;x&quot; &amp; &#39;y&#39;&gt;",
    );
  });
  it("coerces non-strings and handles null/undefined", () => {
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});
```
- [ ] **Step 2 — run, expect FAIL:** `pnpm test --run escapeHtml` → "escapeHtml is not a function".
- [ ] **Step 3 — implement** (`lib/email/escapeHtml.ts`):
```ts
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```
- [ ] **Step 4 — run, expect PASS:** `pnpm test --run escapeHtml`.
- [ ] **Step 5 — commit:** `git add lib/email/escapeHtml.ts lib/email/escapeHtml.test.ts && git commit -m "feat(email): shared escapeHtml util"`

---

### Task 2: Brand resolver

**Files:** Create `lib/email/brand.ts`; Test `lib/email/brand.test.ts`.

**Interfaces:**
- Consumes: `Workspace` lean doc (fields `name`, `publicPage.header.logoUrl`, `publicPage.brandKit.accentColor`, `contact.email`).
- Produces:
```ts
export type Brand = {
  kind: "platform" | "partner";
  name: string;
  logoUrl?: string;
  accentHex: string;       // 6-digit hex, validated
  replyTo?: string;
  poweredByGallurio: boolean;
};
export function gallurioBrand(): Brand;
export function resolveWorkspaceBrand(ws: WorkspaceBrandInput): Brand;
export function ctaTextColor(accentHex: string): "#ffffff" | "#1a1a1a";
type WorkspaceBrandInput = {
  name?: string;
  publicPage?: { header?: { logoUrl?: string }; brandKit?: { accentColor?: string } };
  contact?: { email?: string };
};
```

- [ ] **Step 1 — failing test** (`lib/email/brand.test.ts`):
```ts
import { describe, it, expect } from "vitest";
import { gallurioBrand, resolveWorkspaceBrand, ctaTextColor } from "./brand";

const GALLURIO_TEAL = "#0d8fa1";

describe("brand", () => {
  it("gallurioBrand is the fixed platform brand", () => {
    const b = gallurioBrand();
    expect(b.kind).toBe("platform");
    expect(b.name).toBe("Gallurio");
    expect(b.accentHex).toBe(GALLURIO_TEAL);
    expect(b.poweredByGallurio).toBe(false);
  });
  it("resolveWorkspaceBrand uses workspace fields with fallbacks", () => {
    const b = resolveWorkspaceBrand({
      name: "Aperture Studio",
      publicPage: { header: { logoUrl: "https://imagedelivery.net/x/y/public" }, brandKit: { accentColor: "#2f5d56" } },
      contact: { email: "hi@aperture.test" },
    });
    expect(b).toMatchObject({
      kind: "partner", name: "Aperture Studio",
      logoUrl: "https://imagedelivery.net/x/y/public",
      accentHex: "#2f5d56", replyTo: "hi@aperture.test", poweredByGallurio: true,
    });
  });
  it("falls back to teal accent and undefined logo when missing/invalid", () => {
    const b = resolveWorkspaceBrand({ name: "No Brand", publicPage: { brandKit: { accentColor: "not-a-hex" } } });
    expect(b.accentHex).toBe(GALLURIO_TEAL);
    expect(b.logoUrl).toBeUndefined();
    expect(b.name).toBe("No Brand");
  });
  it("ctaTextColor picks readable text by luminance", () => {
    expect(ctaTextColor("#0d8fa1")).toBe("#ffffff"); // dark teal -> white
    expect(ctaTextColor("#ffe08a")).toBe("#1a1a1a"); // light yellow -> dark
  });
});
```
- [ ] **Step 2 — run, expect FAIL:** `pnpm test --run brand`.
- [ ] **Step 3 — implement** (`lib/email/brand.ts`):
```ts
const GALLURIO_TEAL = "#0d8fa1";
const HEX6 = /^#[0-9a-fA-F]{6}$/;

export type Brand = {
  kind: "platform" | "partner";
  name: string;
  logoUrl?: string;
  accentHex: string;
  replyTo?: string;
  poweredByGallurio: boolean;
};

type WorkspaceBrandInput = {
  name?: string;
  publicPage?: { header?: { logoUrl?: string }; brandKit?: { accentColor?: string } };
  contact?: { email?: string };
};

export function gallurioBrand(): Brand {
  return { kind: "platform", name: "Gallurio", accentHex: GALLURIO_TEAL, poweredByGallurio: false };
}

export function resolveWorkspaceBrand(ws: WorkspaceBrandInput): Brand {
  const accent = ws.publicPage?.brandKit?.accentColor;
  const logoUrl = ws.publicPage?.header?.logoUrl;
  return {
    kind: "partner",
    name: ws.name?.trim() || "Gallurio",
    logoUrl: logoUrl && logoUrl.trim() ? logoUrl : undefined,
    accentHex: accent && HEX6.test(accent) ? accent : GALLURIO_TEAL,
    replyTo: ws.contact?.email || undefined,
    poweredByGallurio: true,
  };
}

export function ctaTextColor(accentHex: string): "#ffffff" | "#1a1a1a" {
  const hex = HEX6.test(accentHex) ? accentHex : GALLURIO_TEAL;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // Relative luminance (sRGB, simple gamma) — readable-text threshold.
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5 ? "#1a1a1a" : "#ffffff";
}
```
- [ ] **Step 4 — run, expect PASS:** `pnpm test --run brand`.
- [ ] **Step 5 — commit:** `git commit -am "feat(email): two-context brand resolver"`

---

### Task 3: Email copy/locale map

**Files:** Create `lib/email/messages.ts`; Test `lib/email/messages.test.ts`.

**Interfaces:**
- Consumes: `localeForCountry` (`lib/i18n/localeForCountry.ts`).
- Produces: `emailLocale(country?: string|null): "en"|"fil"|"ms"|"id"` (re-export wrapper) and `EMAIL_COPY` — a typed map `EMAIL_COPY[key][locale] = { …strings }`. Keys this phase: `teamInvite`, `inquiryConfirmation`. (Later tasks append `bookingConfirmedClient`, `bookingCancelledClient`, `inquiryDecline`, `passwordReset`, `verification`.)

- [ ] **Step 1 — failing test** (`lib/email/messages.test.ts`):
```ts
import { describe, it, expect } from "vitest";
import { EMAIL_COPY, emailLocale } from "./messages";

describe("email messages", () => {
  it("maps workspace country to a supported locale", () => {
    expect(emailLocale("PH")).toBe("fil");
    expect(emailLocale("xx")).toBe("en");
    expect(emailLocale(null)).toBe("en");
  });
  it("every copy key has all four locales", () => {
    for (const key of Object.keys(EMAIL_COPY)) {
      for (const loc of ["en", "fil", "ms", "id"] as const) {
        expect(EMAIL_COPY[key][loc], `${key}.${loc}`).toBeTruthy();
      }
    }
  });
});
```
- [ ] **Step 2 — run, expect FAIL:** `pnpm test --run "email messages"`.
- [ ] **Step 3 — implement** `lib/email/messages.ts`: re-export `emailLocale = localeForCountry`; define `EMAIL_COPY` with `teamInvite` and `inquiryConfirmation` keys, each holding `{ en, fil, ms, id }` objects of the literal strings currently in `teamInvite.ts` (port its inline map verbatim) and `inquiryClientConfirmation.ts` (translate its English strings into fil/ms/id). Use ICU-free interpolation via functions where a name is injected, e.g. `subject: (ws: string) => \`...\``. Keep keys minimal and typed with `as const satisfies Record<...>`.
- [ ] **Step 4 — run, expect PASS:** `pnpm test --run "email messages"`.
- [ ] **Step 5 — commit:** `git commit -am "feat(email): localized email copy map (en/fil/ms/id)"`

---

### Task 4: `renderBrandedEmail` template

**Files:** Create `lib/email/layout.ts`; Test `lib/email/layout.test.ts`.

**Interfaces:** Produces:
```ts
export type EmailBlock =
  | { type: "p"; text: string }                       // text is pre-escaped? NO — layout escapes
  | { type: "heading"; text: string }
  | { type: "rows"; rows: Array<{ label: string; value: string }> }
  | { type: "spacer" };
export type RenderEmailOpts = {
  brand: Brand;
  locale: "en" | "fil" | "ms" | "id";
  preheader: string;
  title: string;
  subtitle?: string;
  blocks: EmailBlock[];
  cta?: { label: string; url: string };
  secondaryCta?: { label: string; url: string };
  supportLine?: string;
};
export function renderBrandedEmail(opts: RenderEmailOpts): { html: string; text: string };
```
The template **escapes all caller text** internally (callers pass raw strings). URLs in CTAs are attribute-escaped.

- [ ] **Step 1 — failing test** (`lib/email/layout.test.ts`):
```ts
import { describe, it, expect } from "vitest";
import { renderBrandedEmail } from "./layout";
import { gallurioBrand, resolveWorkspaceBrand } from "./brand";

describe("renderBrandedEmail", () => {
  const base = { locale: "en" as const, preheader: "pre", title: "Hello", blocks: [{ type: "p" as const, text: "Hi <there>" }] };

  it("escapes user text and renders both html and text", () => {
    const { html, text } = renderBrandedEmail({ brand: gallurioBrand(), ...base });
    expect(html).toContain("Hi &lt;there&gt;");
    expect(html).not.toContain("Hi <there>");
    expect(text).toContain("Hi <there>"); // plain text keeps raw
    expect(html).toContain("Gallurio");
  });
  it("renders primary + secondary CTA with escaped url", () => {
    const { html } = renderBrandedEmail({ brand: gallurioBrand(), ...base,
      cta: { label: "Go", url: "https://x.test/a?b=1&c=2" },
      secondaryCta: { label: "More", url: "https://x.test/m" } });
    expect(html).toContain("https://x.test/a?b=1&amp;c=2");
    expect(html).toContain(">Go<");
    expect(html).toContain(">More<");
  });
  it("partner brand shows business name + Powered by Gallurio", () => {
    const brand = resolveWorkspaceBrand({ name: "Aperture", contact: { email: "h@a.test" } });
    const { html } = renderBrandedEmail({ brand, ...base });
    expect(html).toContain("Aperture");
    expect(html).toMatch(/Powered by\s*Gallurio/i);
  });
  it("includes a dark-mode style block and the preheader", () => {
    const { html } = renderBrandedEmail({ brand: gallurioBrand(), ...base });
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain("pre");
  });
});
```
- [ ] **Step 2 — run, expect FAIL:** `pnpm test --run renderBrandedEmail`.
- [ ] **Step 3 — implement** `lib/email/layout.ts`. Build a 600px table layout, inline styles, hex tokens from the spec (light `#f8f8f8`/`#424242`/`#e6e6e6`; footer charcoal `#353535`). Use `escapeHtml` on every caller string and an `escapeAttr` (same util) on URLs. Header: if `brand.logoUrl`, render `<img src=escaped height=28 alt=name>` else the brand name as styled text; platform → teal header strip, partner → light strip with accent only on CTA. CTA button: bulletproof `<table><tr><td bgcolor=accent><a style="color:ctaTextColor(accent)">`. Footer: platform = tagline + `support@gallurio.com` + `© <year> Gallurio…`; partner = business name + `Powered by <a>Gallurio</a>`. Hidden preheader `<div style="display:none;max-height:0;overflow:hidden">`. Add a `<style>@media (prefers-color-scheme: dark){…}</style>` block (bg `#353535`, text `#eaeaea`, teal `#2fb3d9`). Build `text` by concatenating block text (raw), CTA `label: url`, and footer. Compute year from `new Date().getFullYear()` — **note:** in tests this is fine; nothing forbids `new Date()` here (the Date restriction is workflow-script-only).
- [ ] **Step 4 — run, expect PASS:** `pnpm test --run renderBrandedEmail`.
- [ ] **Step 5 — commit:** `git commit -am "feat(email): renderBrandedEmail shared template (platform + partner)"`
- [ ] **Step 6 — register reuse:** add `lib/email/layout.ts`, `lib/email/brand.ts`, `lib/email/escapeHtml.ts` to `REUSABLE_CODE.md`; commit.

---

# Phase 1 — Refactor existing senders onto the template + i18n

Each task: replace the bespoke HTML in the sender with a `renderBrandedEmail` call, pass the correct `Brand`, pull copy from `EMAIL_COPY`, keep the existing exported signature and best-effort semantics, update/extend the sender's test to assert on rendered content (not exact HTML). Delete that file's local `escapeHtml` and import the shared one.

### Task 5: Team invite (partner brand) + i18n
**Files:** Modify `lib/email/teamInvite.ts` (+ its test).
- [ ] Resolve `Brand` for the invite. Team invites are partner-branded but `sendTeamInviteEmail` currently only receives `workspaceName`/`inviterName` (no full workspace). **Decision:** extend `TeamInviteEmailInput` with optional `brand?: Brand` and `accentHex`/`logoUrl` resolved at the call site (`teams/_invite-action.ts`), falling back to a name-only partner brand built from `workspaceName` when absent. Pass `locale` through `emailLocale`.
- [ ] Body blocks: greeting `p`, "{inviter} invited you to join {workspace}" `p`, optional team list `rows`, CTA `{ label: accept, url: acceptUrl }`, expiry `p`.
- [ ] Test: assert html contains workspace name, accept URL, and the localized CTA label for `fil`.
- [ ] Run `pnpm test --run teamInvite` → PASS. Commit.

### Task 6: Inquiry owner notification (platform)
**Files:** Modify `lib/email/inquiryNotification.ts` (+ test).
- [ ] Use `gallurioBrand()`. Map the existing fields into blocks: heading "New inquiry", `rows` for client/contact/event/location/sessions (escaped), CTA `{ label: "Review & approve", url: ${APP_URL}/inquiries/{id} }` (omit CTA when `NEXT_PUBLIC_APP_URL` unset, per current behavior). `replyTo` stays the client email.
- [ ] Test: asserts rows contain escaped client name and the inquiry deep-link. Run `pnpm test --run inquiryNotification` → PASS. Commit.

### Task 7: Inquiry client confirmation (partner) + i18n
**Files:** Modify `lib/email/inquiryClientConfirmation.ts` (+ test).
- [ ] Partner brand from the workspace. Current input only has `workspaceName`/`ownerEmail`; extend `InquiryClientConfirmationData` with the partner brand fields (resolved at the call site in `lib/server/inquirySubmission.ts`) or pass the whole `brand`. Locale via `emailLocale(workspace.country)`. Copy from `EMAIL_COPY.inquiryConfirmation`. `replyTo` = ownerEmail.
- [ ] Test: html contains business name + localized "we received your inquiry" for `ms`. Run `pnpm test --run inquiryClientConfirmation` → PASS. Commit.

### Task 8: Password reset (platform)
**Files:** Modify `lib/email/sendPasswordResetEmail.ts` and the inline reset email in `app/[locale]/(auth)/_actions.ts:~411`.
- [ ] Both render via `gallurioBrand()` template: `p` intro, CTA `{ label: "Reset password", url: resetUrl }`, `p` "link expires / ignore if not you". Add `EMAIL_COPY.passwordReset` (4 locales); pick locale from the request `locale` param where available, else `en`.
- [ ] Collapse the two reset code paths to call `sendPasswordResetEmail` (DRY) where feasible.
- [ ] Test: html contains the reset URL and localized CTA. Run `pnpm test --run sendPasswordResetEmail` → PASS. Commit.

### Task 9: Generic notification email (platform)
**Files:** Modify `lib/email/notifications.ts` (+ test).
- [ ] Render via `gallurioBrand()` template: title = `opts.title`, `p` = `opts.body`, CTA `{ label: "View", url: ${APP_URL}${opts.href} }`. Keep the team-vs-generic subject logic. (Status-aware booking copy is enriched in Task 16.)
- [ ] Test: html contains title/body/href. Run `pnpm test --run "email/notifications"` → PASS. Commit.

### Task 10: Remove dead code
**Files:** Delete `lib/email/resend.ts`; remove any remaining per-file `escapeHtml`/`htmlEscape`.
- [ ] `rg "htmlEscape|function escapeHtml" lib/email app` → only `lib/email/escapeHtml.ts` remains; repoint imports.
- [ ] Run `pnpm typecheck` clean. Commit `chore(email): drop unused Resend SDK import + duplicate escapeHtml`.

---

# Phase 2 — Booking-lifecycle emails + notifications

### Task 11: Extract shared recipient resolver
**Files:** Create `lib/notifications/recipients.ts` (+ test); Modify `app/api/bookings/[id]/route.ts`.

**Interfaces:** Produces
```ts
export async function resolveTeamRecipients(workspaceId: string, teamId: string | mongoose.Types.ObjectId): Promise<NotificationRecipient[]>;
export async function resolveStatusChangeRecipients(args: { workspaceId: string; teamId?: string | mongoose.Types.ObjectId | null; ownerUserId: string; ownerEmail?: string | null; }): Promise<NotificationRecipient[]>;
```
- [ ] **Step 1 — failing test** (in-memory Mongo): seed `TeamMembership` + `User`, assert `resolveTeamRecipients` returns deduped `{workosUserId,email,name?}` scoped by `workspaceId`+`teamId`; assert `resolveStatusChangeRecipients` merges team members + owner (deduped).
- [ ] **Step 2 — run, expect FAIL.**
- [ ] **Step 3 — implement** by lifting the exact `TeamMembership.find({workspaceId,teamId}) → User.find({workosUserId:{$in}})` logic from `route.ts:438-507`. `resolveStatusChangeRecipients` builds the same `Map` (team members + owner) used today.
- [ ] **Step 4 — run, expect PASS.**
- [ ] **Step 5 — refactor `route.ts`** to call these helpers (replace both inline blocks). Run `pnpm test --run "bookings/\[id\]"` and `pnpm test --run recipients` → PASS.
- [ ] **Step 6 — commit** + register helper in `REUSABLE_CODE.md`.

### Task 12: Actor-silent notifications
**Files:** Modify `lib/db/models/Notification.ts`, `lib/notifications/types.ts`, `lib/notifications/send.ts`, `components/notifications/NotificationProvider.tsx` (+ tests).
- [ ] **Step 1 — failing test** (`lib/notifications/send.test.ts`): with `recipients` including the actor (`triggeredByWorkosUserId`), assert the actor's persisted `Notification` has `read: true, silent: true` and **no** `notification:new` loud emit (mock `getIO`), while a non-actor recipient gets `read: false, silent: false` + a loud emit.
- [ ] **Step 2 — run, expect FAIL.**
- [ ] **Step 3 — implement:**
  - `Notification.ts`: add `silent: { type: Boolean, default: false }`.
  - `types.ts`: add `silent?: boolean` to the serialized payload type.
  - `send.ts`: **stop filtering the actor out.** For each recipient, set `isActor = r.workosUserId === opts.triggeredByWorkosUserId`; persist `read: isActor`, `readAt: isActor ? new Date() : null`, `silent: isActor`. On emit: for actors either skip `io.emit` or emit with `read:true, silent:true` in the payload (choose skip-emit for simplicity — actor sees it on next fetch). Email: continue to **skip the actor** (only call `sendNotificationEmail` when `!isActor`).
  - `NotificationProvider.tsx`: in the `notification:new` handler, if `notification.silent || notification.read` do not increment `unreadCount` (defensive; actor isn't emitted anyway). On initial fetch, exclude `silent && read` from the unread count if the API counts them.
- [ ] **Step 4 — run, expect PASS** (`pnpm test --run "notifications/send"`).
- [ ] **Step 5 — commit** `feat(notifications): actor-silent delivery (loud only for non-actors)`.

### Task 13: Booking confirmed emails + approve-path team notification
**Files:** Create `lib/email/booking/bookingConfirmed.ts` (+ test); Modify `app/[locale]/(app)/inquiries/_actions.ts`.
- [ ] **Senders:** `sendBookingConfirmedClient({ brand, locale, clientName, clientEmail, businessName, eventTitle, sessions, replyTo })` (partner) and `sendBookingConfirmedOwner({ locale, ownerEmail, clientName, eventTitle, bookingId })` (platform, `gallurioBrand()`, CTA → `/bookings?detail={id}`). Add `EMAIL_COPY.bookingConfirmedClient`. Best-effort.
- [ ] **Test:** client html shows business name + event title (escaped) + localized confirm copy; owner html shows the booking deep-link.
- [ ] **Hook** in `approveInquiryBookingAction` **after** the transaction commits (after line ~176, before `return`): load the booking's `Client` (email/name) and the `Workspace` brand fields; resolve `Brand` via `resolveWorkspaceBrand`; `void sendBookingConfirmedClient(...)` (guard on client email) and `void sendBookingConfirmedOwner(...)`. Then fire the **team notification**: if the booking has a `teamId`, `resolveTeamRecipients` + `sendNotification({ type: "booking.team_assigned", … vars:{ clientName } })`; **if team-less, notify the owner** instead. All `.catch()` non-fatal.
- [ ] **Test** the action: mock the senders + `sendNotification`; assert they're called with the booked booking id and team recipients (or owner fallback).
- [ ] Run `pnpm test --run "bookingConfirmed"` and `pnpm test --run "inquiries/_actions"` → PASS. Commit.

### Task 14: Booking cancelled emails + status-aware enrich
**Files:** Create `lib/email/booking/bookingCancelled.ts` (+ test); Modify `app/api/bookings/[id]/route.ts`.
- [ ] **Senders:** `sendBookingCancelledClient(...)` (partner) + `sendBookingCancelledOwner(...)` (platform). Add `EMAIL_COPY.bookingCancelledClient`.
- [ ] **Hook:** in the PATCH route, when `newStatus === "cancelled"` (and previous was `booked`/`completed`, not already cancelled), after the existing `status_changed` notification, load the booking's `Client` + workspace brand and `void sendBookingCancelledClient(...)` (guard email) + `void sendBookingCancelledOwner(...)`; the owner already gets the in-app notification, so the owner email is the explicit confirmation per spec. Non-fatal.
- [ ] **Test:** PATCH booked→cancelled triggers both senders with the client + owner; PATCH booked→booked (restore) does not.
- [ ] Run `pnpm test --run "bookingCancelled"` + route test → PASS. Commit.

### Task 15: Decline inquiry action + archive orphan fix
**Files:** Create `lib/email/booking/inquiryDecline.ts` (+ test); Modify `app/[locale]/(app)/inquiries/_actions.ts`.
- [ ] **Sender:** `sendInquiryDeclineClient({ brand, locale, clientName, clientEmail, businessName, replyTo })` (partner). Add `EMAIL_COPY.inquiryDecline` (polite "unable to take this on").
- [ ] **New action `declineInquiryAction(inquiryId)`** mirroring `archiveInquiryAction` but: in a transaction set inquiry `archived` **and** set the orphan draft booking (`inquiry.draftBookingId`) `status: "cancelled"` (guard `status: "draft"`); write `ActivityLog` `{ from, to: "archived", via: "decline" }`; after commit, load `Client` + brand and `void sendInquiryDeclineClient(...)` (guard email). Returns `InquiryActionResult`.
- [ ] **Fix `archiveInquiryAction`**: also cancel the orphan draft booking (same guarded update) — no email (silent dismiss).
- [ ] **Test:** decline sets inquiry archived + draft booking cancelled + calls the decline sender; archive cancels the draft booking + does NOT email.
- [ ] Wire `declineInquiryAction` into the inquiry UI's existing dismiss/3-dot menu as a second "Decline & notify" item (follow the existing action-button pattern; localize the label in all 4 `messages/*.json` under the inquiries namespace).
- [ ] Run `pnpm test --run "inquiries/_actions"` → PASS. Commit.

### Task 16: Status-aware notification email copy
**Files:** Modify `lib/notifications/messages.ts` + `messages/{en,fil,ms,id}.json`.
- [ ] Give `booking.status_changed` a status-aware title/body using `vars.newStatus` (e.g. "Booking cancelled" / "Booking completed"), replacing the generic "New notification". Add the ICU keys under `app.notifications.types.booking.status_changed` in all four locales.
- [ ] **Test:** `buildNotificationContent("booking.status_changed", "en", id, "booking", { newStatus: "cancelled" })` → title mentions cancelled. Run `pnpm test --run notifications/messages` → PASS. Commit.

---

# Phase 3 — WorkOS verification email takeover

### Task 17: Webhook route with signature verification
**Files:** Create `app/api/webhooks/workos/route.ts` (+ test); Modify `.env.example`.
- [ ] **Step 1 — failing test:** POST with a body and a valid/invalid signature header; assert invalid → 400 and the handler is not invoked; valid → 200. Mock the `@workos-inc/node` `Webhooks.constructEvent` (or equivalent — confirm the real API; spec open item #2).
- [ ] **Step 2 — run, expect FAIL.**
- [ ] **Step 3 — implement:** `export const runtime = "nodejs"`. Read the **raw** body (`await req.text()`), verify with `WORKOS_WEBHOOK_SECRET` via the WorkOS Webhooks helper (timestamp tolerance). On failure return 400. On success, dispatch by `event.event`; **always return 200** after verification even if the handler throws (wrap handler in try/catch, log on error).
- [ ] **Step 4 — run, expect PASS.** Add `WORKOS_WEBHOOK_SECRET` to `.env.example`. Commit.

### Task 18: `email_verification.created` handler
**Files:** Modify `app/api/webhooks/workos/route.ts` (+ test); add `EMAIL_COPY.verification`.
- [ ] **Step 1 — failing test:** given an `email_verification.created` event (carrying `id`, `user_id`, `email`), the handler calls the WorkOS Get-Email-Verification API (mocked) for the `code`, renders via `renderBrandedEmail(gallurioBrand())`, and calls `sendEmail` with the verification code + the user's email. Locale resolved from the user's workspace country (else `en`).
- [ ] **Step 2 — run, expect FAIL.**
- [ ] **Step 3 — implement** the handler: fetch the code via `workos.userManagement.getEmailVerification(id)` (confirm method name — spec open item #3), build a platform email (`p` intro, large code or CTA), `await sendEmail(...)`; swallow/log errors (route still 200).
- [ ] **Step 4 — run, expect PASS.** Commit.

### Task 19: Resend-verification fix + dashboard notes
**Files:** Modify `app/[locale]/(auth)/_actions.ts`; docs.
- [ ] Verify live (spec open item #1) whether `sendVerificationEmail` re-emits the event after WorkOS defaults are disabled. If yes — no code change beyond a comment. If no — make `resendVerificationEmailAction` fetch the code and call our render+send directly (reuse the Task 18 handler logic via a shared `sendVerificationEmailBranded(userId|email)` helper).
- [ ] Confirm the release-checklist §4g dashboard steps (disable WorkOS default verification email, WorkOS Branding, own Google OAuth credentials) are present (they are) — no code.
- [ ] Add a test for the chosen resend path. Run, commit.

---

# Phase 4 — Verification & polish

### Task 20: Render harness + screenshots
**Files:** Create `scripts/render-emails.ts`.
- [ ] Script renders every email (both brands, both CTA variants) to `*.html` files under a temp dir, for each locale. Open in a headless browser (Playwright CLI) at desktop + **375px**, light + dark (`prefers-color-scheme`), screenshot each. Eyeball: logo/contrast on partner accent, dark-mode legibility, button tap size.
- [ ] Record the artifact paths in the PR description. (No commit of screenshots.)

### Task 21: Consolidate + gates
- [ ] Locale parity: all new `app.notifications.*` and inquiry-decline keys exist in `en/fil/ms/id` (release checklist §7).
- [ ] `pnpm typecheck` clean; `pnpm lint` 0 errors; `pnpm test` full pass (pre-merge sweep only).
- [ ] Run the `security-auditor` agent over the new webhook + lifecycle hooks (auth/tenancy/webhook surface).
- [ ] Update `REUSABLE_CODE.md` final state. Commit.

---

## Self-review notes
- **Spec coverage:** template (T4), two brands (T2), i18n (T3,5,7,8,16), refactor all senders (T5-10), WorkOS takeover (T17-19), booking lifecycle emails (T13-15), team fan-out on approve (T13), status-aware cancel email (T14,16), actor-silent (T12), recipients DRY (T11), dashboard config (T19 + checklist §4g), render/375px/dark verification (T20). Covered.
- **Open items** (verify live, do not block planning): WorkOS resend-email re-emit (T19), webhook signature API (T17), Get-verification payload/method (T18), logo field naming (T7/T13 use `logoUrl`), approve team-less fallback (T13 handles it).
- **Excluded (no trigger):** quote/negotiation emails; booking "completed" client email.
