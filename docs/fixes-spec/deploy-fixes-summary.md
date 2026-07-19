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

## QA-evidence screenshots

`locale issue.jpeg` (A1), `slug-issue.jpeg` (A2), `public-page-icon-issue.jpeg` (A3), `add-bookings-action-issue.jpeg` / `cors-error-on-add-bookings.jpeg` (bookings).
