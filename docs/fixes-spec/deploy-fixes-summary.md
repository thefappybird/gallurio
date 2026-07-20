# Deploy fixes — shipped summary

Pre-launch fix/feature pass on `action/deploy-fixes` (branched from `f3b3c61b`).
One line per shipped item: what + where. QA-evidence screenshots kept in this
folder are referenced inline.

## A. Independent fixes (original spec)

- **A1 — missing `plans.beta`/`plans.promo` locale keys** (`locale issue.jpeg`): added `plans.beta.name`/`plans.promo.name` across all 5 locale files, so the onboarding done-step stops printing the raw key.
- **A2 — public URL showed an unrouted subdomain** (`slug-issue.jpeg`): resolved by landing the subdomains feature below (`{slug}.gallurio.com` is now actually routed), not by unsetting the env.
- **A3 — native date/time glyphs invisible on dark theme** (`public-page-icon-issue.jpeg`): native controls now render with a dark `color-scheme` so picker/clock glyphs are light-on-dark.
- **A4 — `gallurio.com` share image 404** : `/opengraph-image` gets an early `proxy.ts` bypass (was being rewritten under `/[locale]` and 404ing).

## B/C. Story-prompt / settings-draft cluster (shared root cause)

- **B1/B2/B3 — story-prompt data was draft-scoped and fabricated a blank draft**: `completeStoryPromptAction` no longer touches `PortfolioDraft`; SEO description/keywords/logo/site-icon/OG image now land on `Workspace.publicPage.settingsDraft` (same buffer the settings Save action writes), so they surface in `settings/public-page` and the new-user check stays accurate. (`app/[locale]/(app)/portfolio/_actions.ts`)
- **C1 — Save deleted the still-live share image**: leak-safe deletion in `updatePublicPageSettingsAction` — a replaced draft-buffer asset (OG/site-icon/logo) is deleted only when it differs from both the new value and the live published value. (`app/[locale]/(app)/settings/_actions.ts`)
- **C1 (publish) — publish stranded the live logo**: `publishDraftAction` now propagates/clears the staged header logo independent of `doc.header`, and deletes only superseded live assets. (`app/[locale]/(app)/portfolio/_draftActions.ts`)
- **C2 — onboarding share image never reached the live page**: closed as a side effect of B1 (data now workspace-level, promoted on publish).
- **Workspace logo field**: added to `settings/public-page` (`settingsDraft.logo` → `publicPage.header` on publish), header-logo defaults exposed from the settings loader, hidden logo file-input ref wired, logo schema fields + i18n keys added. (`_form.tsx`, `settingsDraft` schema, `messages/*`)

## Tenant subdomains (`*.gallurio.com`)

- **Routing**: `proxy.ts` rewrites `{slug}.{base}` → `/w/{slug}` and 301s the canonical `/w/{slug}` → subdomain, gated on `NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN`.
- **Reserved-label denylist**: `lib/portfolio/reservedSlugs.ts` (`www,auth,autoconfig,dev,send,staging,app,api,admin,mail,static,cdn,assets,status`) skipped in the rewrite and rejected as workspace slugs.
- **Open-redirect fix**: the 301 validates the captured slug against `WORKSPACE_SLUG_RE` before using it as the redirect host label. (`proxy.ts`)
- **Caddy**: `*.gallurio.com` site block serving a Cloudflare Origin CA wildcard cert via `GALLURIO_WILDCARD_HOST`/`GALLURIO_ORIGIN_CERT`/`GALLURIO_ORIGIN_KEY`. (`deploy/Caddyfile`, `deploy/README.md`)
- **Cookie posture**: session cookies kept host-only; test locks `gw_active_ws` to no `domain` attribute. `WORKOS_COOKIE_DOMAIN` must never be `.gallurio.com`.

## Additional pre-launch fixes/features

- **Uploads**: type + size only — dropped the 600px-minimum / pixel-dimension rejection in `uploadImage`/`uploadAsset`; CF delivery-time fit handles sizing. In-app cropper deferred to a future PR.
- **Canvas/preview bg** : stop auto-painting the theme background; the page bg is painted only when an explicit `_rootStyle.bgColorToken` is set (editor/preview/publish parity).
- **Public color-scheme**: derived from brand background luminance on the public portfolio.
- **Business type**: added `artists` enum + `businessTypeOther` free-text, persisted in onboarding + settings actions and reflected in the router cards. (`Workspace` model, business step/settings actions)
- **Timezone**: searchable combobox in onboarding + settings, with i18n keys and a scrollable max-height.
- **Bookings** (`add-bookings-action-issue.jpeg`, `cors-error-on-add-bookings.jpeg`): drawer title inputs no longer close the drawer, booking footer layout fix, dropped the UTC-day refine from `bookingSessionSchema` (was false-rejecting PH-timezone dates).
- **Branded 404**: immersive locale + root catch-all 404 pages.
- **Brand kit**: compact font dropdowns (A12), guard unapplied changes on close + footer Save.
- **Portfolio editor polish**: required asterisk on New Collection title (A17), reveal entrance-animated blocks in preview, wrap label+control rows in the style toolkit.
- **Notifications**: bell arrival-popup placement adapts to collapsed/expanded sidebar.
- **Heatmap**: per-cell tooltip, per-cell booking detail, extended paging bounds to booking dates + skip-5-pages nav.

## Follow-up fixes (portfolio editor + auth)

- **Canvas background parity**: the editor canvas didn't paint an explicit page `bgColorToken` past the first block — Puck's own `_PuckCanvas-root_` wrapper hardcodes a white background that our injected canvas stylesheet wasn't targeting. Extended the rule to that wrapper too; unset-background case still doesn't auto-paint (unchanged). (`lib/page-builder/RootCanvasStyle.tsx`)
- **Theme font dropdown overflow**: the Heading/Body font picker was a native `<select>` whose popup escaped the viewport. Replaced with a generic searchable combobox (`components/ui/combobox.tsx`, catalogued in `REUSABLE_CODE.md`); also fixed a hotkey interceptor in the editor shell that was swallowing the new control's arrow/enter/escape keys. (`lib/page-builder/brandKitPicker/BrandKitPicker.tsx`, `app/[locale]/(app)/portfolio/_components/EditorShell.tsx`)
- **Theme name error duplication + row desync**: a stale-closure bug meant the footer error banner only appeared on the *second* failed save, and the inline theme-tile Discard never cleared it. Footer error now derives from the shared theme-editor controller (single source of truth); the tile itself shows a non-text invalid signal (ring + icon + one-shot glow, `prefers-reduced-motion`-aware) instead of a second copy of the message. (`lib/page-builder/brandKitPicker/ThemeTile.tsx`, `ThemeGrid.tsx`, `app/[locale]/(app)/portfolio/_components/ThemePanelDialog.tsx`)
- **`getAuthUser()` crash on public-path 404s**: `withAuth()` throws when AuthKit's middleware didn't cover the request — true for any 404 under `/sign-in`, `/sign-up`, `/pricing`, etc. (`proxy.ts` skips AuthKit on those paths). `getAuthUser()` now checks AuthKit's own coverage header first and returns `null` instead of throwing — reproduced in prod, not just dev. (`lib/auth/session.ts`)

## Playwright verification pass (post-implementation)

Targeted Playwright run across areas touched by this branch surfaced and fixed:

- **Onboarding plan step defaulted every new signup to a paid "Subscribe" CTA**: `Workspace.plan` is set to `"pro"` at creation for the free-trial grant, so the plan step's `currentPlan` prop (sourced from the raw field) pre-selected the Pro card instead of Free. Now derived from the already-correct `activation` signal, which excludes the trial grant. (`app/[locale]/(onboarding)/onboarding/plan/page.tsx`)
- **Settings loader could show a blank logo despite a live one existing**: `settingsDraft.logo` defaults to `{url:"",assetId:""}` as soon as the `settingsDraft` subdocument exists at all (e.g. after any unrelated SEO save) — the prior per-field `??` on `url`/`assetId` never fell back to the live header logo, since `""` is neither `null` nor `undefined`. Fixed by gating the fallback on `assetId` truthiness. (`app/[locale]/(app)/settings/[[...catchall]]/page.tsx`)
- **Two pre-existing e2e specs updated to match current UI, not caused by this branch**: `booking-payments.spec.ts` queried `role="row"` on the bookings table, but the row's own `role="button"` (whole-row click target) overrides the implicit row role — switched to querying by button role. `portfolio-responsive.spec.ts`'s mobile test never dismissed the "Welcome back" entry dialog or opened the compact canvas-controls popover (both pre-existing UI, unrelated to this branch) before interacting.

## Review pass (pre-PR)

- `senior-reviewer` + `security-auditor` ran independently over the full `dev...HEAD` diff. Security audit: no findings above Low (open-redirect protection, cookie host-scoping, tenant isolation on `settingsDraft` mutations, upload ownership checks, and the `getAuthUser()` null-return change all verified clean with evidence).
- Code review found one real Medium-severity bug (the settings-loader logo fallback above, fixed) plus a Low-severity sibling risk in `publishDraftAction` that turned out to conflict with an existing, deliberate test (`settingsDraft.logo` explicitly cleared to empty is meant to override the draft's own header logo on publish) — left as-is; only the uncontested loader fix landed.

## QA-evidence screenshots

`locale issue.jpeg` (A1), `slug-issue.jpeg` (A2), `public-page-icon-issue.jpeg` (A3), `add-bookings-action-issue.jpeg` / `cors-error-on-add-bookings.jpeg` (bookings).
