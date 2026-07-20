# Changelog

All notable changes to this project are documented in this file.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

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
