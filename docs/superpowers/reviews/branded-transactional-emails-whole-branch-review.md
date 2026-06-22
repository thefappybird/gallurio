# Whole-Branch Merge-Gate Review — `enhance/branded-transactional-emails`

**Verdict: APPROVE FOR MERGE.**

Zero Critical and zero Important findings at the integration/seam level. All 9 seam
concerns are confirmed sound. The remaining items are Minor / acknowledged-non-blocking
and do not gate the merge.

---

## Scope reviewed + method

This is the **final whole-branch integration review** — not a re-review of the 21
already-reviewed tasks. Focus was on cross-cutting seams that per-task reviews can miss.

- Read the per-task ledger (`.superpowers/sdd/progress.md`) for established invariants.
- Pulled the surface with `git diff dev...HEAD --stat` (67 files, +5243/-519).
- Read every seam-critical file end-to-end:
  - Template core: `lib/email/layout.ts`, `lib/email/brand.ts`, `lib/email/escapeHtml.ts`, `lib/email/messages.ts`, `lib/email/send.ts`.
  - All migrated senders: `teamInvite.ts`, `inquiryNotification.ts`, `inquiryClientConfirmation.ts`, `sendPasswordResetEmail.ts`, `notifications.ts`, `booking/bookingConfirmed.ts`, `booking/bookingCancelled.ts`, `booking/inquiryDecline.ts`.
  - All new/changed call sites: `inquiries/_actions.ts` (approve/archive/decline), `api/bookings/[id]/route.ts` (PATCH cancel hook), `api/webhooks/workos/route.ts`, `teams/_invite-action.ts`, `lib/server/inquirySubmission.ts`.
  - Notification plumbing: `lib/notifications/send.ts`, `types.ts`, `messages.ts`, `recipients.ts`, `components/notifications/NotificationProvider.tsx`.
  - UI: `inquiry-actions.tsx`. i18n: full diff of `en/fil/ms/id`.
- Grep sweeps for raw HTML (`<strong>`/`<b>`/`dangerouslySetInnerHTML`), duplicate
  `escapeHtml`, leftover `resend.ts` imports, committed image/screenshot artifacts.
- Did NOT re-run tests/build (per instructions; tsc clean, lint 0 errors / 68 pre-existing
  warnings, 3244 pass / 5 pre-existing fail already established).

---

## Strengths

- **Single escape boundary.** Every interpolation in `layout.ts` routes through `e()` →
  `escapeHtml`. Senders pass *plain* `EMAIL_COPY` strings as block `text`/`title`; none
  build raw HTML. XSS tests (`<b>Bad</b>`, `<strong>`) assert the markup is absent from output.
- **`accentHex` is defense-in-depth correct.** Validated by `HEX6` regex in `brand.ts`
  before it ever reaches a `bgcolor`/`style` attribute — the right control for CSS-context
  injection (escaping alone wouldn't stop it).
- **Concurrency-flag pattern applied uniformly** (`promotedThisCall`, `archived`, `declined`):
  the flag is set *inside* the transaction right after the `matchedCount > 0` check, and BOTH
  the post-commit side-effects AND the success return are gated on it. A concurrent loser
  returns without double-sending.
- **Best-effort discipline is uniform.** Post-commit emails/notifications are `void …catch(() => {})`
  or wrapped IIFEs; `sendEmail` itself never throws; the webhook always returns 200 after
  signature verification; the PATCH cancel block can't 500 the response.
- **Tenant isolation is consistent.** Every new read/write filters by `workspaceId` resolved
  from session (`ctx.workspace._id` / `ownerContext`). No client-supplied `workspaceId` is
  trusted. The webhook trusts only `req.text()` + signature header and sends the code solely
  to the WorkOS-fetched `verification.email`.
- **Brand routing is correct.** Client-facing senders take a resolved partner `Brand`
  (`resolveWorkspaceBrand`, "Powered by Gallurio" footer); owner/platform senders hardcode
  `gallurioBrand()` + `locale: "en"`. No leakage either direction.
- **PII-aware logging in `send.ts`** (full body only in `NODE_ENV=development`, envelope-only
  otherwise); no API keys/tokens/codes logged anywhere.

---

## Findings

### Critical
_None._

### Important
_None._

### Minor

| Severity | file:line | issue | fix |
|---|---|---|---|
| Minor | `app/api/bookings/[id]/route.ts:474,480` | `booking.status_changed` notification is dispatched with `locale: "en"` hardcoded, even though the ICU `select` copy now exists in all 4 locales. In-app users may prefer a non-English UI. | Optional: thread the recipient/workspace locale through `sendNotification`. Consistent with the branch's "platform/team notifications English-only" convention and `team_assigned` (also `"en"`), so non-blocking. |
| Minor | `lib/email/send.ts:60` | `fetch` to Resend has no `AbortController`/timeout (hardening checklist wants timeouts on external calls). | Add an `AbortController` timeout. **Pre-existing** — `send.ts` is unchanged on this branch (`git diff dev...HEAD -- lib/email/send.ts` is empty); not introduced here. |
| Minor | `lib/notifications/send.ts:52` | `console.log` of `notification:new -> user:<id>` on every emit (recipient userId, not a secret). | Optional: drop or gate behind a debug flag. Pre-existing pattern; no secret exposure. |

---

## Confirmation of the 9 seam concerns

1. **Security invariant end-to-end — CONFIRMED.** `EMAIL_COPY` is plain text (header comment
   enforces it). Every sender passes copy as block `text`/`title`; `renderBrandedEmail` escapes
   all interpolations via `e()`. Subjects are plain-text headers (not used as markup), so the
   unescaped subject strings are safe. Spot-checked team invite, inquiry notification, client
   confirmation, password reset, booking confirmed/cancelled (client+owner), decline, webhook
   verification — no bypass, no raw HTML, no reintroduced `<strong>`. Grep for
   `<strong>/<b>/dangerouslySetInnerHTML` in `lib/email` hits only test assertions.

2. **Tenant isolation across all new call sites — CONFIRMED.** `inquiries/_actions.ts`
   (approve/archive/decline) scopes every `Inquiry`/`Booking`/`Client`/`ActivityLog` op by
   `workspaceId = ctx.workspace._id`. The PATCH cancel hook re-reads the client with
   `{ _id, workspaceId: ctx.workspace._id }`. `resolveTeamRecipients` scopes
   `TeamMembership` by `{ workspaceId, teamId }`; the follow-on `User.find` is keyed on those
   already-scoped `workosUserId`s (User is the global identity collection — acceptable boundary).
   The webhook never reads a client-supplied `workspaceId`/email; recipient = WorkOS-fetched
   `getEmailVerification(data.id).email`.

3. **Best-effort discipline uniform — CONFIRMED.** All post-commit/post-transaction emails +
   notifications are `void …catch` / wrapped IIFE with try/catch; none block, roll back, or
   500. `sendEmail` returns result objects and never throws. Webhook returns 200 after verify
   even on handler failure. PATCH cancel block is `void …catch(() => {})`.

4. **Concurrency-flag pattern consistent — CONFIRMED.** `promotedThisCall`
   (approveInquiryBookingAction), `archived` (archiveInquiryAction), `declined`
   (declineInquiryAction) are all set inside the txn after the matched-count guard and gate
   both side-effects and the return value. A concurrent loser never double-sends.

5. **Brand routing correctness — CONFIRMED.** Client-facing = `resolveWorkspaceBrand` partner
   brand (logo + "Powered by Gallurio", localized via `emailLocale(country)`). Owner/platform =
   `gallurioBrand()` + `locale: "en"` + Gallurio footer. Verified across all senders; no cross-leak.

6. **i18n integrity — CONFIRMED.** `decline`/`declinedToast` present in all 4 locales;
   `booking.status_changed` ICU `select` (cancelled/completed/booked/other) is brace-balanced
   in all 4. No `th`. `EMAIL_COPY` covers all 7 email types × 4 locales (verification's 4 locales
   exist to satisfy the type; "en" is always used per convention).

7. **DRY/seams — CONFIRMED.** The shared `renderBrandedEmail` + `resolveWorkspaceBrand` +
   `resolveTeamRecipients`/`resolveStatusChangeRecipients` are reused across all senders/call
   sites (no re-implementation). `lib/email/escapeHtml.ts` is the single escaper (grep confirms
   no duplicate `function escapeHtml` in source; only the plan doc references the old per-file copies).
   REUSABLE_CODE.md updated (+entries per ledger).

8. **Dead code / leftovers — CONFIRMED CLEAN.** `lib/email/resend.ts` fully deleted; no source
   imports it (only doc references remain). No orphaned imports in the senders. Only committed
   binary is `public/brand/email-mark.png` (intentional brand asset); no screenshot artifacts
   committed (the Playwright spec writes to `os.tmpdir()`). No secret logging.

9. **Compiles-but-wrong-at-the-seam — NONE FOUND.** Sender param shapes match call sites
   (e.g. `BookingCancelledClientParams.sessions` string-tuple vs the PATCH route's
   `Intl.DateTimeFormat` conversion in workspace tz; decline action's `{ ok }|{ error }` vs
   `inquiry-actions.tsx`). Webhook `switch(event.event)` correctly routes
   `email_verification.created` to the handler. Notification emit payload is typed
   `SerializedNotificationPayload`, matching the frontend `SerializedNotification` and the
   `!silent && !read` unread gate. `vars` (clientName/actorName/newStatus) are forwarded into
   `buildNotificationContent`'s `t(..., vars)` calls.

---

## Acknowledged non-blocking (per ledger, not findings)

- Platform/verification emails are `locale: "en"` by design (no locale signal pre-workspace).
- Booking sessions formatted in workspace timezone (Asia/Manila fallback) for emails.
- Duplicate screenshot runner script (`scripts/screenshot-emails.ts` vs `.spec.ts`).
- 5 pre-existing dev test failures (sealed-cookie `ensureUser` mock lacks `memberships: []`;
  app-sidebar; settings panel) — byte-identical on `dev`, untouched by this branch.
- Resend is webhook-only for verification resend (Task 19, user decision).
- `send.ts` lacks a fetch timeout — pre-existing, file unchanged on branch.
