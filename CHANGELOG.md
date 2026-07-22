# Changelog

All notable changes to this project are documented in this file.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [Unreleased]

### Changed
- Reworked the public Book a Demo page into the auth-shell split layout, reversed: a compact demo form card now sits over the theme-aware ambient SVG pane, while the narrower, theme-opposed pane presents the localized Gallurio manifesto.

## [1.1.1] - 2026-07-21

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

Initial production release baseline (`Production Release 1.0`, #63), following the beta release of the Gallurio CRM and portfolio builder with Lemon Squeezy billing.
