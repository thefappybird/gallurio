# Module: i18n & Design System

## Locales

Live: `en`, `fil`, `id`, `ar` (RTL), `th`. Malay (`ms`) dropped 2026-07-18 (too close to `id` to justify a separate catalog); Thai (`th`) reintroduced same day after root-causing the original mojibake corruption (a PowerShell UTF-8 encoding bug, not a real content issue) and adding `messages/encoding-sanity.test.ts` to catch any recurrence. Routes live under `app/[locale]/...`; ICU message formatting throughout. Public workspace chrome uses the workspace's country locale, not the visitor's.

Update all 5 locale catalogs together for any user-facing string change; never reintroduce `ms`.

## Arabic / RTL

Arabic is a fifth, user-selectable RTL locale (sidebar/settings switcher, `/ar/*` URLs). `<html dir>` is set from locale in `app/[locale]/layout.tsx`. Shipped in phases — Auth/invite, Clients, Teams, Notifications, Settings, Bookings (`react-big-calendar rtl={isRtl}`), Inquiries, Dashboard, and the Portfolio editor's owner-facing chrome (Puck grid mirrors under `dir=rtl`, side-panel dialogs, draft overlay, `SpotlightGuide` tooltip placement) are all done.

**Still deferred**: onboarding and the marketing/landing pages are not yet localized for RTL. `localeForCountry` does not yet auto-default Gulf-country tenants (`AE`, `SA`, `QA`, `KW`, `OM`, `BH`) to `ar` — they see English chrome today; flipping this is a one-line change in `lib/i18n/localeForCountry.ts` plus its test, gated behind finishing the deferred surfaces above. Arabic transactional/lifecycle email copy (`EMAIL_COPY`) does not exist yet — English-only email locale is hard-cast for now.

Conventions: logical Tailwind utilities only (`ms/me/ps/pe/start/end/text-start/border-s`), never physical (`ml/mr/pl/pr/left/right`); mirror directional icons with `rtl:-scale-x-100`; `Intl.NumberFormat` renders Eastern Arabic numerals under `ar` by default (verify acceptability or pass `numberingSystem: "latn"` per surface). See `docs/modules/billing.md`'s Gulf-currency-precision note for a related, still-open display issue in the same rollout.

Public-facing portfolio pages additionally support an **owner-controlled** `formLocale`/`formDir` on `Workspace.publicPage`, independent of the CRM's own locale — the only place Arabic is enabled for a public site today. This is **deliberately narrow, not deferred**: general manual-block content (Home/Gallery templates, Columns, Hero, every ordinary block) never mirrors for RTL — in canvas, in the Preview tab, or on the published page — regardless of `formLocale`/`formDir` or the owner's own CRM UI language, so canvas/preview/publish can never disagree (a WYSIWYG guarantee). `<html dir>` and the public page wrapper stay `"ltr"` always. Only the **contact form** (`ContactModal`, its preview equivalent, and the canvas swatch) and the **featured-work popup + its nested Lightbox** (Contact Sheet/Justified/Split Index/Immersive) follow `resolveEffectiveDir(formDir, locale)` — each accepts an explicit `dir` prop and applies it itself, since all three portal to `document.body` and would otherwise escape any wrapper `dir`. The editor canvas also pins `dir="ltr"` on its root (`EditorShell.tsx`) so canvas RTL-ness can't leak in from the owner's own CRM UI locale; the canvas contact/popup swatches instead resolve their copy from `formLocale` via `lib/i18n/useFormLocaleTranslator.ts` (a client-side dynamic-import + `createTranslator`, independent of the CRM request locale).

## Design system ("The Studio Ledger")

Source of truth: root `PRODUCT.md` (register, users, brand personality, anti-references) and `DESIGN.md` (tokens, typography, components) — read those before any UI work; this file only summarizes the load-bearing rules.

- Semantic tokens only — never raw color utilities, never pure-black/white. Palette is a softened neutral-cool OKLch ramp (light base ~oklch 0.972, dark base ~oklch 0.205).
- Brand teal (hue 195) is the **one** deliberate accent — "act on this," never decorative. Roughly 10–20% of any view: focus rings, active nav/sidebar, calendar highlights, hover accents.
- Flat UI: hairline `ring-foreground/10` + tonal shift, no `box-shadow` on cards/dialogs.
- Controls are soft, frames are sharp: interactive controls use `--radius` (0.25rem default); structural frames (cards, dialogs, sidebar, panels) use `--radius-surface` (0rem default). Both are governed by `data-radius` on `<html>` + `lib/theme/appTheme.ts` — extend theming there, not with ad-hoc Tailwind.
- One type family for the whole app shell hierarchy: Plus Jakarta Sans (`--font-jakarta`/`--font-sans`). Merriweather is a portfolio brand-kit font *option*, not an app font.
- Public portfolios may override brand styling only inside the public-page wrapper — the app shell's own theme never leaks into or out of that boundary. See `docs/modules/portfolio-and-media.md` and the `portfolio-theme-brand-kit` skill for the brand-kit/token pipeline.
- Reject: SaaS-cream dashboards, sterile enterprise chrome, clutter.
