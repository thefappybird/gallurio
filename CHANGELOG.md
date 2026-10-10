# Changelog

All notable changes to this project are documented in this file.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [1.6.0] - 2026-10-10

Release PRs #113 (perf/a11y/CLS wave), #114 (calendars, round-trips, query cache), #115 (calendar/table layout, booked date, server sort), and #116 (vocabulary presets, animated marketing home).

### Added
- **Vocabulary presets.** Workspace owners pick a preset (Standard, photographer, venue, planner, stylist, catering, entertainer, or artists) in Settings → Customize. It renames inquiry, booking, client, and team across the app, member emails, and notifications. Routes, data, and logic are unchanged. Members see the choice read-only. Available in all five languages.
- The marketing home page has playful scroll-reveal motion (reduced-motion safe) and a "Speaks your trade" showcase section.
- **Booked date.** Bookings and inquiries record when they were booked, shown as a "Booked on" column on both tables. New bookings sort first by default.
- **Server-side sorting** on every bookings and inquiries column. A header click cycles ascending, descending, then back to the default order. Phones get a "Sort by" control.
- The bookings and inquiries tables, and the clients table, size their page to fit the screen and remember it per table.
- Unconfirmed inline edits in the booking modal show a footer note, and the confirm button turns green.
- End times follow start times (start + 1 h, capped at 23:59) in the booking wizard, booking modal, inquiry draft card, and public contact form.
- The calendar's "Teams" button is now a "Legend" with a "Conflicted" key. Workspaces without teams get a Booked/Conflicted legend.
- The inquiry source shows as a pill under the type instead of its own column.
- The app sidebar is a labelled navigation landmark on every signed-in page.

### Changed
- **Booking conflicts are per team.** Two bookings conflict only when the same team is double-booked. Different teams at the same time are fine, and bookings with no team count as one shared team. This applies to calendar colouring, the drag-and-drop gate, the booking wizard, and the booking detail modal. Inquiries keep the old rule.
- The bookings and inquiries calendars load only the visible month plus about five weeks either side, load their calendar library on demand, and have their own skeletons. "Today" follows the workspace timezone.
- Opening a booking is one request, dragging one is one request with no page refresh, and opening an inquiry is one server action. Conflict previews are batched, and `/api/users/names` is removed.
- Every client-side read on the app's data screens is cached by one workspace-scoped query cache, and every mutation invalidates the related screens through a single map.
- Dashboard charts are code-split, heavy modals load on demand, and settings, teams, and clients load their data in parallel.
- Tables fit 1280 px with the sidebar open. Column widths stay fixed while sorting or paging, and status pills share one width.

### Fixed
- **Layout shift (CLS).** The calendar no longer grows about a second after first paint, the settings and notifications skeletons match the real layout, and table skeletons render exactly the page-size rows.
- **Stale data.**
  - A save can no longer overwrite a teammate's change: a booking save takes `expectedUpdatedAt` and returns `409 stale` with the current booking on a mismatch. The modal, wizard, and calendar drag all handle it.
  - Open booking modals and inquiry cards pick up newer copies, and keep unsaved edits with a notice. Inquiry Save and Approve send only changed fields, so Approve cannot promote a draft at an outdated price.
  - Teammates' changes reach other tabs live. The socket reconnects indefinitely and refetches after any gap, and back/forward no longer restores a pre-change page.
  - Staff only refresh for bookings in their own teams.
  - Renaming a client updates the client name stored on its bookings.
  - Inquiry `eventDate` is the earliest session's start in the workspace timezone, and inquiry dates display in that timezone.
  - A drafts save that writes nothing returns `not_draft` instead of success.
- `/portfolio-preview?zone=contact` no longer returns 500.
- The public contact form's three tabs share the row and wrap at 375 px.
- A CSV import can no longer turn an inquiry's draft booking into a booked one without approval.
- Billing actions report failures instead of throwing, and the post-checkout return page can no longer hang on a transient database error.
- The teams table has the same keyboard and screen-reader support as the clients table. Relative-time text no longer throws a hydration error, and the dialog Close label is localized.
- Settings no longer has a dead reload button or a duplicate main landmark on error.

### Performance
- **Calendar round-trips:** the bookings calendar renders from 1 team read plus 1 windowed booking query. The inquiries calendar needs 2 queries instead of 5. Month navigation within the loaded range fetches nothing.
- **Booking detail:** 1 GET with activity and actor names, plus 1 batched conflict lookup, with no server re-render. "Edit all" reuses the cached booking.
- Request-level memoization resolves the signed-in user and workspace once per request instead of twice.

### Known gaps
- Vocabulary: the fil, id, and ar preset terms and grammar need native-speaker review. Some English-only hint strings are not yet tokenized in id, ar, and th, and "Invalid team id" server errors are not yet catalog keys.
- Teams still loads the full team list instead of paginating on the server, because the invite picker and cap checks need it anyway.

## [1.5.0] - 2026-09-28

Release PRs #105 (audit catalog), #106 (Puck 0.23 upgrade), #108 (Puck follow-ups: foundation wave), #109 (Puck follow-ups: perf wave), and #110 (public surfaces: search indexing and first-load performance).

### Added
- The portfolio editor's own chrome (Puck's buttons, labels, and panels) is now translated into English, Filipino, Indonesian, Arabic, and Thai, not just Gallurio's controls around it.
- The editor's left sidebar now has Components and Outline tabs, and the outline opens with the page body already expanded.
- Editor panel sections open and close with a short animation that respects reduced-motion settings.
- The navigation-order control is back in the editor.

### Changed
- The portfolio editor now runs on Puck 0.23 (`@puckeditor/core`). Existing portfolios and drafts load unchanged, and no migration is needed.
- The unsaved-changes dialog keeps all three actions on one row.
- Section presets start collapsed in the block drawer, and the Presets and Manual drawers sit flush.
- The marketing site's full desktop navigation now shows from 1280 px wide, with the menu button below that. The home page's trust row wraps instead of running off narrow screens.
- Signed-in visitors to gallurio.com are sent straight to their dashboard by a dedicated redirect, so the public home page no longer renders per visitor.

### Fixed
- Editor side panels scroll in place, and at 375 px the editor toolbar is no longer hidden under the canvas.
- A block dropped onto a section preset now lands beside the preset's inner container, not inside it.
- The block preview card closes when the pointer leaves it.
- Featured Work hints in the editor and preview follow the owner's dashboard language rather than the portfolio's language.
- Sections from starter templates always get their own block ids, which removes duplicate-key warnings on published pages.
- The portfolio editor and published portfolio pages now have their own error screens. Portfolio actions and upload endpoints report a clear failure instead of crashing, and an image upload that Cloudflare rejects returns a retryable "upload unavailable" error.

### Security
- The request proxy now strips client-supplied authentication headers at the trust boundary, so a forged session header can never reach a route that skips the auth middleware.
- The signed-in redirect from the home page is never cached, so a shared cache cannot serve one visitor's redirect to another.

### Performance — assessed and fixed
Measured in dev mode (unminified), so the numbers compare only with each other, not with production.
- **Marketing first load:** pages now ship an ~8 KB slice of the message catalog instead of the full 195 KB. The 260 KB logo is now an 8.9 KB PNG, the ambient background is plain CSS, and the light/dark screenshot is chosen by CSS, so only one variant downloads. The home page is served statically, refreshed every minute, and loads the visitor's regional price after the page appears. Results: home HTML 312 KB → 174 KB; `/pricing` HTML 213 KB → 58 KB; mobile Lighthouse LCP 10.98 s → 7.82 s, TBT 4.37 s → 2.56 s, page weight 1,760 KiB → 1,294 KiB.
- **Public portfolios:** every portfolio image is served through `next/image` with Cloudflare resizing. Large filmstrips and popup layouts render only visible thumbnails, background slideshows load only the current and adjacent slides, and the lightbox and collection popup download on first open. The gallery page's mobile LCP went from 3.47 s to 2.79 s, and its DOM from 421 to 229 nodes. The tenant pages no longer preload the old 192 KB logo.
- **Portfolio editor:** the editor loads through a lazy boundary. The gallery picker caches its requests, cutting duplicate fetches from 3 to 0. The editor's Puck configuration and metadata are memoized.
- **Declined after measuring:** `memo()` on block renderers (Puck 0.23 already memoizes them), `optimizePackageImports` (−0.8 KB, noise), and windowing the public gallery grid (it would hide photos from search engines).
- **Still open:** the booking calendar and dashboard charts are not yet code-split, and the calendar's range fetches are not cached. The billing settings pages lack their own error handling. See the "Known gaps" sections in `docs/modules/`.

### Accessibility — assessed and fixed
- The portfolio module was re-audited, confirming the labelled contact form, keyboard block moves, focus rings, correct RTL scoping, and semantic section elements.
- The editor chrome is now translated in all five languages, animations honor reduced motion, and the mobile editor toolbar is reachable again.
- The marketing site was checked across five languages × light/dark × phone/tablet/desktop, with no overflow and no untranslated keys. The collection popup and lightbox open from the keyboard.
- **Still open:** the app's sidebar has no navigation landmark, and the Arabic editor chrome is translated but not mirrored.

### SEO — assessed and fixed
Driven by the Google Search Console coverage report of 2026-09-17.
- **Page with redirect (8 pages):** localized homes pointed their canonical and hreflang at a trailing-slash URL that redirected. Localized headers and footers linked to redirecting editorial URLs, and the intl middleware sent a conflicting hreflang `Link` header. All three are fixed.
- **Blocked by robots.txt (1 page):** the Portfolio Maker demo is crawlable again under every language prefix, so Google can read its `noindex`.
- **Crawled – currently not indexed (4 pages):** these were most likely the localized homes above.
- The editorial pages (Resources, Blog, Compare) no longer loop between redirects for visitors whose browser or cookie prefers a non-English language.
- A crashed public portfolio page is marked `noindex`, so an error screen is never indexed.
- **After deploy:** run "Validate fix" on all three reasons in Search Console and re-check coverage in 2–4 weeks.

## [1.4.2] - 2026-09-15

Release commits through `6439ed3d`.

### Added
- Booking imports can now map unfamiliar CSV and XLSX column headings and values to Gallurio booking fields before review, so exports from other systems do not need to match the template exactly.
- The marketing header now links directly to Portfolio Maker and Resources on desktop and mobile.
- Marketing and public portfolio pages now include stronger search and sharing metadata, including generated Open Graph images and structured data for marketing content.

### Changed
- The booking import flow is now a guided sheet with clearer upload, mapping, review, and results steps; successful clean imports close automatically, while partial imports keep actionable errors available.
- Booking exports now use the same responsive sheet pattern and keep the active booking-list filters in the downloaded file.
- Marketing, blog, and comparison-page titles, descriptions, and editorial copy have been refined for clearer search presentation.

### Fixed
- Public portfolio pages now load selected Google fonts and publish gallery-image metadata consistently, improving the accuracy of published pages and their search previews.
- The test environment no longer attempts to load CSS files from happy-dom during unit tests.

## [1.4.1]

### Added
- Photo lightbox layouts now offer a "see more" panel showing date, location, client, custom details, and tags — previously only visible on the Sidebar and Sheet layouts, now also on Caption and Cinema.
- Photo galleries with 8 or fewer photos now show clickable position dots instead of a numeric counter, on the Caption, Cinema, and Featured Work (immersive) lightbox layouts.
- Photo tag entry is now consistent everywhere it appears — the photo details editor, the post-upload wizard, SEO keywords, and CRM client tags all use the same pill-style input, committing a tag on space, comma, Enter, or a pasted list.
- The Featured Work popup's Contact Sheet, Justified, and Split Index layouts now offer a column-count control (1-6), and the editor's popup preview matches it exactly instead of guessing a different count than the published popup.
- Owners can now manually reorder the navigation bar's logo, home, gallery, and contact items — useful for RTL-friendly layouts, since the nav itself does not auto-mirror.
- New page sections can now inherit an owner-set default radius, padding, margin, gap, and width when dropped into a page — existing sections are never changed retroactively.

### Changed
- The Sidebar and Sheet lightbox layouts now keep their navigation controls reachable at the bottom of the panel while scrolling through a photo's details, instead of scrolling out of view.
- The portfolio starter templates are now Minimal, Editorial, Luxury, Romantic, and Modern, replacing the earlier four-template lineup and filling the template picker evenly; Bold remains available as a brand theme but is no longer offered as a starter template.
- The "Framed selection" gallery grid preset is now a split layout — a bordered photo grid alongside an introduction — instead of a single centered card.
- RTL for an Arabic-language portfolio is now scoped to only the contact form and the featured-work photo popup/viewer, which always match the portfolio's own language; the rest of the page (and the editor canvas) always renders left-to-right regardless of the owner's own dashboard language, so what you see while editing always matches what visitors see.

### Fixed
- The photo details editor's tags field no longer silently ignores the Enter key — it was a plain text box despite its own placeholder telling you to press Enter.
- The "Photos & collections" manager could stop responding to Close and Escape after editing a second collection, requiring the Back button to get out. It now closes reliably every time.
- The Sidebar lightbox layout no longer shows a faint duplicate close button when opened from a Featured Work collection popup.

## [1.4.0] - 2026-08-31

Release commits through `56b6ece5`.

### Added
- The portfolio editor now offers a 33-variant section preset library across eleven groups (Hero, About, Services, CTA, Contact, Gallery Grid, Gallery Masonry, Featured Work, Gallery Landing, Video, and Footer), presented in a grouped, collapsed block drawer.
- Preset and video rows now open a hover-and-focus preview showing a live miniature of the section alongside its description, so same-group variants are distinguishable before insertion.
- A Collection Card block, a scrim color token, and a go-to-home button action are now available to portfolio layouts.
- A portfolio built in the public Portfolio Builder demo now carries into the real editor after signup, with its demo images re-parented into the workspace gallery.

### Changed
- Upload failures now report the actual reason a file was rejected instead of a generic message.
- Gallery image selection now supports clearer bulk selection and more reliable picker behavior.

### Fixed
- Editor layout is now stable across container propagation, Columns row and cell behavior, and border toggles, and no longer flashes while a draft loads.
- Published brand backgrounds are now painted, and every brand kit meets the preset contrast bar; Romantic, Modern, Minimal, and Bold were corrected.
- The ContactDetails block's editor canvas now renders identically to the published page, including icon alignment.
- Buttons now follow the section text cascade, link and legacy buttons no longer override a section's text color token, and preset buttons stay legible on accent bands.
- Gallery blocks now show their effective padding instead of a blank control, and template seed values no longer drift from the shared contrast recipes.
- Only one drawer preview opens at a time, anchored so that crossing a row's two mounts cannot make it jitter.
- A retried demo-portfolio import now returns the draft it already created for that demo session instead of adding a duplicate.

### Security
- Claiming a demo image now verifies the demo subfolder in addition to the session, closing a path by which one tenant could adopt another's asset.
- Imported gallery items derive their URL from the ownership-verified asset id rather than a client-supplied URL, closing a stored cross-site-scripting path.

## [1.3.0] - 2026-08-23

Release commits through `b9ac48a3`.

### Added
- Regional Pro pricing now selects a base or global USD tier server-side, shows a local-currency estimate where rates are available, and clearly identifies the billed USD amount.
- Workspace currency roll-ups now use daily exchange-rate tables and freeze the applicable rate on paid booking amounts; changing a workspace currency performs an explicit, transactional restatement and then observes a 90-day cooldown.
- Public editorial discovery now includes practical guides, comparison and pillar pages, article structured data, canonical and hreflang metadata, sitemap entries, and `llms.txt`.
- Published portfolios now expose tenant-scoped `robots.txt` and `sitemap.xml`, connected JSON-LD, published-image discovery, automatic SEO guidance, and editable gallery-image alt text and captions.

### Changed
- The unified plan card and billing screens now present the applicable price, annual savings, beta eligibility, and existing Pro grants consistently.
- The production image now includes editorial content, and the billing-lifecycle timer is deployed with the other systemd jobs.

### Fixed
- Portfolio metadata no longer advertises empty descriptions or unpublished/index-disabled pages; canonical URLs use the resolved workspace slug.
- Gallery and editor controls now meet the 24px target size, preserve focus on Escape, and correctly localize the alt-text workflow and Arabic dialog titles.
- Marketing, pricing, dashboard, client, and booking surfaces now keep converted and charged amounts legible on narrow layouts.

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
