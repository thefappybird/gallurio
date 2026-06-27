# Arabic locale + RTL support

## Problem

Gallurio shipped in `en`, `fil`, `ms`, `id` only. The Gulf markets are already
supported for billing/currency but their tenants saw English chrome, and the app
had no right-to-left (RTL) layout. This adds **Arabic (`ar`) as a fifth, RTL
locale** and the cross-cutting RTL foundation, then makes each non-deferred page
RTL-correct.

## Scope & decisions

- **Dev only, no live users.** Arabic is **opt-in**: selectable via the new
  sidebar locale switcher and the existing Settings → Customize language list,
  and reachable at `/ar/*` URLs. `localeForCountry` still maps Gulf countries to
  `en` — auto-defaulting Gulf tenants to Arabic is **deferred** (see "Deferred").
- **Machine-translated catalog**, validated for ICU/placeholder/plural
  correctness (FormatJS parser, all 1381 strings).
- **Phased by surface**, committed per phase.
- **Deferred surfaces (out of scope):** Dashboard, Portfolio editor + public
  portfolio (`/w/[orgSlug]`), Onboarding, Landing/marketing — these are being
  overhauled separately.

## Changes by phase

- **Phase 0 — Foundation:** `messages/ar.json` (full parity with `en.json`);
  `ar` added to `lib/i18n/routing.ts`; `<html dir>` set from locale in
  `app/[locale]/layout.tsx`; new `components/app/locale-switcher.tsx` mounted in
  the sidebar footer (preserves path **and** query string); sidebar flips to the
  inline-start (right) edge in RTL; physical→logical utility audit of shared
  primitives (`dropdown-menu`, `select`, `dialog`, `sheet`, `sidebar`, `tooltip`)
  and directional-icon mirroring; `globals.css` calendar override →
  `margin-inline-start`; `emailLocale` narrowed (Arabic email copy deferred);
  `ar` native label added to the language maps in all catalogs.
- **Phase 1 — Auth + invite:** password show/hide toggle → logical.
- **Phase 2 — Clients:** toolbar search + table alignment.
- **Phase 3 — Teams:** search/table/badges/spinners/lead-warning popover.
- **Phase 4 — Notifications:** desktop panel re-anchors to the sidebar's inner
  edge in RTL (right offset + slide-from-right); rows; sidebar bell badge.
- **Phase 5 — Settings:** nav border, password/MFA/avatar, input-group joins,
  org-switcher; the language selector already lists Arabic.
- **Phase 6 — Bookings:** `react-big-calendar rtl={isRtl}`, event chips, modals,
  toolbar, CSV import, wizard steps.
- **Phase 7 — Inquiries + detail:** table, back-arrow mirror, cards; the
  inquiries calendar reuses the (already-fixed) `BookingCalendar`.

## Cross-cutting: middleware locale header (hard-reload fix)

`proxy.ts` composes authkit + next-intl on protected routes by merging authkit's
response headers onto next-intl's response. Both middlewares inject **request**
headers through Next.js's `x-middleware-override-headers` manifest (a single
comma-separated list of header names). The old merge `set()` authkit's manifest
straight over next-intl's, dropping `x-next-intl-locale` — so a **hard reload**
(full document load) of any non-default `/{locale}/*` page resolved the default
locale and rendered English chrome under a correct `dir`/`lang`. (Soft client
navigations were unaffected; `setRequestLocale` did not mask it because the
prop-less `NextIntlClientProvider` resolves messages before it takes effect.)
The merge now **unions** that manifest and copies every other header (incl.
authkit's session headers + `set-cookie`) through unchanged. Regression coverage:
`proxy.test.ts` (manifest union) and `e2e/i18n-hard-reload.spec.ts` (logged-in
hard reload of `/ar` and `/id` renders translated chrome).

## Key conventions established

- Logical Tailwind utilities only for direction-sensitive styles:
  `ms/me/ps/pe/start/end/text-start/text-end/border-s/border-e`. Mirror
  directional icons with `rtl:-scale-x-100`.
- Update all **5** locales together.

## Verification

- `pnpm typecheck`, `pnpm lint` clean.
- Per-phase targeted tests pass; new tests: full-catalog parity
  (`messages/locale-parity.test.ts`), routing/Gulf guards, `LocaleSwitcher`
  (incl. query-string preservation).
- Pre-existing unrelated failures unchanged (a WorkOS sign-in cookie test, an
  avatar-upload `waitFor` flake).
- **Manual RTL pass pending** (see the PR testing checklist) — must be observed
  in a browser at 375/768/1280 in both `en` and `ar`, with special attention to
  the bookings/inquiries calendar drag-and-drop in week/day views.

## Deferred (follow-up, not in this PR)

Once the deferred surfaces (Dashboard, Portfolio, Onboarding, Landing) are
RTL-ready, a final change flips `localeForCountry` Gulf cases → `ar`, adds an
Arabic `EMAIL_COPY` catalog (the `emailLocale` cast must widen to include `ar`),
and updates `lib/i18n/localeForCountry.test.ts`.
