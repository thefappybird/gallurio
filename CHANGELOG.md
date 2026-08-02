# Changelog

All notable changes to this project are documented in this file.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [1.2.0] - 2026-08-02

Commit: `2b9a3d61ba5eb3f04c83f4ba01c641c69df3bebb`

### Added
- CSV and XLSX booking import/export now support round-trippable booking data, grouped multi-session bookings, payment lines, team selection, date-range filtering, and downloadable sample files.
- Booking exports can now cover multiple teams from one dialog, with team-aware filenames and XLSX output.
- A workspace invoice and receipt theme dialog now provides branded previews using the workspace's business details.
- Client name-matching and field-reconciliation flows now help staff resolve duplicate client details when creating bookings or converting inquiries.

### Changed
- Form validation feedback is now consistently rendered next to the affected control across the booking, client, inquiry, onboarding, settings, and authentication flows.
- Lemon Squeezy checkout now supports paid subscriptions behind the production launch gate, with return-page verification and updated pricing and legal copy.
- Booking import preview and commit flows now surface row-level conflicts and validation results before data is written.

### Fixed
- Arabic dashboard charts and segmented controls now render correctly in RTL layouts.
- Booking imports reject malformed client contact details before progressing, and location errors appear at their input.
- Import/export handling now recognizes header aliases and prevents spreadsheet-formula injection.
- Tenant redirects no longer leak an internal origin port into public portfolio URLs.

## [1.1.3] - 2026-07-25

Commit: `c884bdb220067ba3fae9c3ba4667ab18e788f8ab`

### Added
- Public About page that plainly describes Gallurio's portfolio, booking, and client-workspace functionality, plus the optional Google Sign-In identity data use and links to the legal policies.
- Regression coverage for the marketing navigation, legal footer labels, root favicon metadata, and standalone-versus-sidebar utility-menu positioning.

### Changed
- Made the landing page's explicit functionality description visible directly beneath the Gallurio hero heading; the application remains publicly accessible at the root homepage for OAuth review.
- Reordered marketing navigation to Portfolio Builder, About, Pricing, Book a Demo, Sign in, and Get started; the footer follows the same public-product order before its legal links.
- Expanded legal-link labels to their full policy names, including Privacy Policy and Refund Policy.
- Updated the Portfolio Builder call to action to use the Gallurio brand button style.
- Published the stable square Gallurio PNG as the root app and public-portfolio favicon, including icon, shortcut, and Apple metadata.

### Fixed
- Theme and language menus on standalone header controls now open below their trigger with logical-end alignment; sidebar controls retain their original inline-side behavior.

## [1.1.2] - 2026-07-22

Commit: `3890761a8542df22667620656f7e402d2fc1c098`

### Added
- Public Portfolio Builder demo: visitors can explore the editor without an account using local-only drafts, starter templates, a guided tour, temporary demo-image uploads, and clear upgrade gates.
- A one-month Pro promotional reward for Portfolio Builder demo participants, redeemable during onboarding or from the subscription gate.
- Public Book a Demo form with validated, rate-limited submissions plus branded confirmation and internal-notification emails.
- Lapsed workspace owners can now rejoin an active beta program once from the subscription gate. The recovery grant is transactionally guarded at the identity level and remains subject to the existing beta-program safeguards.

### Changed
- Updated marketing, header, footer, and auth-page calls to action to feature the no-code, drag-and-drop Portfolio Builder and Book a Demo experiences.
- Reworked the public Book a Demo page into the auth-shell split layout: a compact demo form card sits over the theme-aware ambient SVG pane, while the narrower, theme-opposed pane presents the localized Gallurio manifesto.
- Redesigned the owner subscription gate and onboarding plan selector with consistent Pro, beta-recovery, and promo-code controls; promo validation errors now remain visible and associated with their input across responsive layouts.
- Updated the new demo, booking, subscription-recovery, and onboarding-plan copy across all 5 launch locales (en, fil, id, ar, th).

### Fixed
- Public marketing and demo routes no longer redirect anonymous visitors to sign-in.
- Portfolio Builder demo behavior now keeps preview unavailable, makes the guide optional, and avoids overflow in the demo editor.

## [1.1.1] - 2026-07-21

Commit: `23a5f11e3ff5cdc7c27431923df30170e5594b24`

### Added
- Redesigned marketing landing page: split hero contrasting the public portfolio ("Show") against the business workspace ("Manage"), a trust strip, an audience marquee, a "What is Gallurio?" section, and a surfaced transparency/compliance block ahead of pricing.
- Theme-paired (light/dark) product screenshots via a new `ThemedShot` component, swapping with the visitor's theme the same way the ambient SVG background already does.

### Changed
- Auth pages (sign-in, sign-up, MFA, forgot/reset password, verify email) now show the same tagline and trust checklist as the landing page instead of per-route copy; the brand pane no longer has an opaque fill, so the shared ambient line art shows through.
- Reworded the manifesto quote, which read as booking/management-only, to also cover the portfolio/showcase side of the product.
- Feature panels reordered and given bullet-point highlights; custom-branding messaging folded into the Portfolio Builder panel instead of a separate buried section.
- Marketing copy updated across all 5 locales (en, fil, id, ar, th).

### Fixed
- The marketing page's scroll-gated reveal animation (`data-anim`) left all content below the fold invisible to full-page or headless renders (no `MotionObserver` to trigger it); removed the reveal-on-scroll gating from the marketing page and its pricing teaser.
- Ambient background art crossing through hero and final-CTA text, fighting it for contrast in both themes; corrected with a center-out fade mask and a 180-degree rotation of the art layer.

## [1.1.0] - 2026-07-20

Commit: `d5f2851b7868c2c60bc558b057ab76c7dd6994a4`

### Added
- Tenant subdomain routing: `*.gallurio.com` hosts rewrite to `/w/{slug}`, with a permanent 301 from the canonical host's `/w/{slug}` path to the matching subdomain (`NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN`-gated, no-op when unset).
- Open Graph image generation and updated social-sharing metadata.
- Logo fields on the public-page `settingsDraft` schema, ahead of moving story-prompt data off the active portfolio draft.
- Regression test asserting the active-workspace cookie is host-only (no `domain` attribute), guarding against session leakage to tenant subdomains.

### Changed
- Refactored `signIn`, `signUp`, `verifyEmail`, and `mfaChallenge` Server Actions for more consistent user handling and redirects.
- AuthKit's request context now passes through to the `next-intl` middleware.
- `completeStoryPromptAction` no longer touches `PortfolioDraft`; SEO description/keywords/logo/site icon/OG image now write to `Workspace.publicPage.settingsDraft` directly, the same buffer the settings Save action uses.

### Fixed
- `/opengraph-image` no longer falls through to `next-intl` and 404s (was reachable but not actually bypassed despite being listed in `UNAUTHENTICATED_PATHS`).
- Booking session validation no longer false-rejects same-workspace-day sessions that cross UTC midnight in positive-offset timezones (e.g. Asia/Manila, UTC+8); the timezone-aware same-day check remains authoritative.
- `completeStoryPromptAction` silently creating a blank portfolio draft on a visitor's first visit.
- WorkOS key now provided during the image build step.

## [1.0.0] - 2026-07-19

Commit: `39d3f7807aec4bc46ec0bded2118814c43b13ecc`

Initial production release baseline (`Production Release 1.0`, #63), following the beta release of the Gallurio CRM and portfolio builder with Lemon Squeezy billing.
