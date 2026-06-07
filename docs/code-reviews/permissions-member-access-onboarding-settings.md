# Code Review & Security Audit — `fix/permissions/member-access-onboarding-settings`

Pre-merge review of the member-permissions overhaul, onboarding-redirect fix, and Settings UI cleanup. Two independent passes: a strict code review and a security audit focused on authorization / tenant isolation.

## Scope of the change

- **`lib/auth/requireOrg.ts`** — onboarding-completion redirect now applies **only to owners**; members (who never onboard) are no longer bounced to `/onboarding`. `isOwner` is computed before the gate and reused for the `role` assignment.
- **`proxy.ts`** — `MEMBER_BLOCKED_PREFIXES` trimmed to `/dashboard`, `/teams`, `/gallery`, `/page-builder`. `/clients`, `/inquiries`, `/settings` removed from the block list; the `MEMBER_ALLOWED_SETTINGS` exception deleted. Post-login `/` redirect routes `org:admin → /dashboard`, everyone else `→ /bookings`. Pure helpers extracted to `lib/auth/memberAccess.ts`.
- **`app/[locale]/(app)/settings/_actions.ts`** — `updateTimeFormatAction` switched from `ownerContext()` (owner-only) to `requireOrg()` (any member), writing the caller's own `User.timeFormat`.
- **Settings UI** — removed the Switch-Workspace tab and floated the org switcher above the Clerk card; hid the Clerk API-keys tab via `apiKeysProps={{ hide: true }}`; fixed the card width with Tailwind `!important` overrides on Clerk appearance elements.
- **`components/app/app-sidebar.tsx`** — `MEMBER_NAV` gains `clients`; Settings link shown to all roles; removed dead `/inquiries` + `/gallery` owner links; removed the duplicate in-sidebar collapse trigger (the header `SidebarTrigger` is now the single one).
- **`dashboard/page.tsx`** — added `if (role !== "owner") notFound()` defense-in-depth gate.
- i18n: `switchWorkspace → currentWorkspace` across all four active locales.

## Security audit — verdict: no vulnerabilities

| # | Area | Verdict |
|---|------|---------|
| 1 | Owner-only settings sub-routes (`/settings/workspace`, `/public-page`, `/danger`, `/dev-plan`) after `/settings` was un-blocked in the proxy | **Safe** — page-level `OWNER_ONLY_SLUGS` + `notFound()` runs server-side in a Server Component before any data render; cannot be bypassed client-side. |
| 2 | `updateTimeFormatAction` self-scoping | **Safe** — writes `{ clerkUserId: ctx.userId }` from the session only; `format` is Zod-enum validated; no path to write another user/tenant. `redirect()` in the action unwinds before the write for unauth callers. |
| 3 | Sibling owner-gated actions | **Safe** — all other `_actions.ts` actions still call `ownerContext()`; nothing loosened. |
| 4 | Tenant isolation | **Safe** — `clerkUserId` is globally unique; no cross-tenant write possible. |
| 5 | Members skipping the onboarding gate | **Safe** — onboarding governs setup completeness (branding/public-page/plan), not data scope; member-visible booking/client data is structurally complete. |
| 6 | `apiKeysProps={{ hide: true }}` | **UX-only control** — real removal is the Clerk Dashboard toggle, tracked in `docs/RELEASE-CHECKLIST.md` (item 1b). Not a security boundary by itself. |
| 7 | Post-login role derivation | **Safe** — `session.sessionClaims?.org_role` is from the signed JWT; not client-spoofable. |
| 8 | `/teams` still blocked | **Safe** — remains in `MEMBER_BLOCKED_PREFIXES`. |

## Code review — verdict: fix-then-merge (all items resolved)

| Severity | Finding | Resolution |
|----------|---------|------------|
| Medium | `proxy.ts` comment cited a non-existent `/inquiries` route | Fixed — comment now references `/clients` and `/settings` only. |
| Medium | Proxy is the sole gate for `/dashboard` but had zero tests | Extracted pure helpers to `lib/auth/memberAccess.ts` (`isMemberBlocked`, `stripLocale`, `landingPathForRole`, `MEMBER_BLOCKED_PREFIXES`) and added `lib/auth/memberAccess.test.ts` (block list, locale prefixes, prefix-boundary, login-redirect split). |
| Recommended | `/dashboard` page lacked a server-side `role` gate (parity with `/teams`) | Added `if (role !== "owner") notFound()` defense-in-depth. |
| Coverage | No test for member direct-URL to an owner-only settings sub-route | Added `settings/[[...catchall]]/page.test.ts` asserting `notFound()` for staff on owner-only slugs and pass-through for base/customize/owner. |
| Low | Tailwind `!important` width hack | Accepted — justified per CLAUDE.md "third-party unlayered CSS must be re-paired / win the cascade"; `width:100%` cannot overflow a flex parent at 375px. |

### Confirmed clean
- No dead imports left (`ArrowLeftRight`, in-sidebar `SidebarTrigger`, `CameraIcon`, `MessageSquareIcon`, `SettingsOrgSwitcher` in page.tsx all removed).
- All four active locales updated consistently; no leftover `switchWorkspace` references in code.
- Sharp edges / semantic tokens preserved.

## Known follow-ups (not blocking this PR)
- **Production:** disable the API Keys feature in the Clerk Dashboard (release checklist 1b).
- **Visual:** the Clerk card width fix needs an eyes-on check at 375px and desktop (no browser in the build environment).
- **Future:** if a `/settings/teams` sub-page is ever added, add `teams` to `OWNER_ONLY_SLUGS`.
