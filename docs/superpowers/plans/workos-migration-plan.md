# Plan: Polish the Clerk → WorkOS AuthKit Migration Spec

## Context

The migration design spec at `docs/superpowers/specs/2026-06-10-clerk-to-workos-authkit-migration-design.md` is marked "approved," but it was written on 2026-06-10 — **before** the current `feat/portfolio-enhancements` branch landed the portfolio drafts system and the expanded inquiry submission/inbox flow. The spec also has ~8 underspecified spots (CAPTCHA provider, OAuth `state` encoding, role layering, active-workspace fallback, invite email-mismatch, "optional" webhook ambiguity, distributed rate-limiting, `getAuthUser` shape).

Goal this session (per user): **polish the spec only** — reconcile it with the current branch reality, bake in the four locked decisions below, resolve the open gaps, and update the file-impact map. **No code, no dependency install, no implementation plan yet.** The migration itself will be implemented later on a fresh branch off `dev`.

The exploration confirmed the spec's core assumptions are **accurate**: `requireOrg()` resolves `session.orgId → Workspace.findOne({clerkOrgId})`, `User.clerkUserId` is the user key, the Clerk webhook syncs user/org/membership events, and the public portfolio + inquiry-submission paths are **slug-based and never touch Clerk**. The migration's blast radius on portfolio/inquiries is therefore small because `requireOrg()`'s signature is preserved.

## Locked decisions (from user, 2026-06-13)

1. **Scope:** polish spec only (no code/plan this session).
2. **Bot protection:** Cloudflare Turnstile + per-IP **and** per-email rate limiting on sign-in / sign-up / password-reset.
3. **Default active workspace** (when `gw_active_ws` cookie missing/invalid): add `User.memberships[].lastAccessedAt`, stamped on workspace switch; fall back to most-recently-accessed membership.
4. **Role layering:** workspace **owner = lead-level access on every team**; staff get whatever team role they're assigned. (Confirms existing owner-superuser behavior, e.g. the bookings API's `getTeamsForUser` staff check.)

## What to edit (all in the single spec file; same filename, add a revision entry dated 2026-06-13)

### A. Reconcile with current branch reality (new/updated subsections)
- **New subsection under §4 or §12 — "Insulated surfaces (no auth changes required)":** explicitly list the portfolio/inquiries code that is shielded because it calls `requireOrg()`/`ownerContext()` (signatures preserved) or resolves tenant by slug:
  - `app/[locale]/(app)/portfolio/_draftActions.ts` (create/update/delete/list/get/publish/seedTemplate) — calls `requireOrg()`, owner-only. No change.
  - `app/[locale]/(app)/portfolio/_actions.ts` (saveZone/publish/brandKit/contact/header/formLocale/themes) — `requireOrg()`. No change.
  - `app/[locale]/(app)/portfolio/page.tsx`, `EditorShell.tsx` — `requireOrg()` gate. No change.
  - `app/[locale]/(app)/inquiries/page.tsx`, `_actions.ts` (`approveInquiryBookingAction`), `lib/db/queries/inquiries.ts` — `requireOrg()`. No change.
  - **Public/auth-free (regression targets, not impacted):** `app/(public)/w/[orgSlug]/**`, `lib/db/queries/publicPage.ts::findPublishedWorkspaceBySlug`, `app/api/inquiries/route.ts`, `lib/server/inquirySubmission.ts`, `app/api/public/w/[orgSlug]/collections/[id]/route.ts`.
- **Clarify §5 "Identity model & schema changes":** state that **only auth-identity fields change** (`clerkUserId → workosUserId`, drop `Workspace.clerkOrgId`, add `User.memberships[].lastAccessedAt`). The `Workspace.publicPage` subdoc (now includes `savedThemes`, `formLocale`, `collectionsPopup`, `header`, `contact`) and `PortfolioDraft`/`Inquiry`/`Booking`/`Client` schemas are **untouched** — call this out so the re-key isn't read as a publicPage rewrite.
- **Update §12 file-by-file impact map** to add the new files that exist today but weren't in the original map, each tagged "no change (insulated)" with the reason. Confirm the 30-file Clerk surface is the true edit set: `proxy.ts`, `lib/auth/{requireOrg,ownerContext,onboardingStep,teamContext}.ts`, `lib/actions/onboarding.ts`, `lib/actions/dev.ts`, `app/api/billing/checkout/route.ts`, `app/api/webhooks/clerk/route.ts`, auth pages + `components/app/{clerk-themed,client-user-button,app-sidebar}.tsx`, settings `settings-user-profile.tsx` / `settings-org-switcher.tsx`, onboarding `business-form.tsx` / `(onboarding)/layout.tsx`, `lib/auth/{clerkAppearance,userProfileAppearance}.ts`, env/`package.json`.

### B. Resolve the open gaps (edit the relevant existing sections)
- **§13 Security — bot protection:** lock in **Cloudflare Turnstile**. Add env `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`; server-side token verification inside the sign-in/sign-up/reset server actions before any WorkOS call. Specify per-IP **and** per-email rate limits with concrete thresholds (e.g. 5 attempts / 15 min / email, 20 / 15 min / IP — final numbers in spec). Note the limiter must use a **shared store** (not per-instance memory) on Vercel; reuse/upgrade whatever `app/api/inquiries/route.ts` uses (verify its backing store during implementation).
- **§6.4 active-workspace fallback:** define `User.memberships[].lastAccessedAt` (stamped on switch); resolution order = valid cookie → most-recent `lastAccessedAt` → sole membership → workspace chooser. Removes the undefined "most-recent" wording.
- **§3 / §9 / §6 role layering:** add an explicit rule — owner has lead-level access on all teams; staff team-role is independent and assigned. Reconcile `Invitation.leadOnTeamIds` wording (teams in `teamIds` not in `leadOnTeamIds` default to `member`).
- **§7.2 OAuth `state`:** define encoding — HMAC-signed base64url JSON `{ inviteToken?, locale, returnTo? }` signed with the active-workspace cookie secret; validated + integrity-checked on the Google callback. Removes "exact encoding not specified."
- **§9.4 invite email-mismatch:** specify that accept asserts the authenticated **verified** email == invite email (case-insensitive); on mismatch, **fail without consuming the token** and surface a clear localized error. State that the auth flow marks email verified (password = post-verification; Google = provider-verified).
- **§10.2 webhook ambiguity:** decide — **JIT provisioning is primary; the WorkOS webhook is OFF at cutover** (documented as future/optional). Remove §13's implied dependency on it.
- **§6.3 `getAuthUser()`:** widen the returned shape to `{ workosUserId, email, name, avatarUrl }` so JIT sync (§5.2) has the profile fields it writes.
- **§7.4 SDK inventory:** keep, but tag "verify method names against the installed `@workos-inc/node` version at implementation."

### C. Stage implementation prerequisites (documented in spec, executed later)
- **§11.2 dependency changes** — record exact commands so implementation is one-liner (DO NOT run now):
  - Add: `pnpm add @workos-inc/authkit-nextjs @workos-inc/node`
  - Remove (at cutover): `pnpm remove @clerk/nextjs @clerk/themes svix`
  - New env: `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI`, `WORKOS_COOKIE_PASSWORD` (or active-ws cookie secret), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.
  - Remove env: `NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`.

### D. Housekeeping
- Add a **Revision history** entry at top/bottom: "2026-06-13 — reconciled with `feat/portfolio-enhancements` (portfolio drafts + inquiry flow); locked Turnstile, `lastAccessedAt` fallback, owner=team-lead role rule; resolved OAuth-state, invite-mismatch, webhook, and rate-limit gaps."
- Run the brainstorming spec self-review (placeholder scan, internal consistency, scope, ambiguity) after edits.

## Files touched this session
- **Edit:** `docs/superpowers/specs/2026-06-10-clerk-to-workos-authkit-migration-design.md` (only file changed).
- No code, no `package.json`, no installs.

## Verification
- Re-read the edited spec end-to-end: confirm no "TBD/TODO/optional" left for the four locked decisions; no section contradicts another (esp. §10.2 webhook vs §13).
- Cross-check every "insulated" file path named in §A actually exists in the branch and calls `requireOrg()`/`ownerContext()` or resolves by slug (spot-check `_draftActions.ts`, `inquirySubmission.ts`, `publicPage.ts`).
- Confirm the Clerk edit set in the impact map matches the 30-file surface from exploration (no Clerk import left unlisted).
- Optional: `git commit` the polished spec (per brainstorming flow) once you approve the content.
