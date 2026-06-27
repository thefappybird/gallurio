# Dashboard Overhaul — Bookings + Portfolio

> Approved plan (saved for crash-recovery / reference). Mirror of the working plan file.
> Net-doc rule: consolidate into one summary doc under `docs/dashboard/` before the PR and
> delete scratch.

## Status — shipped (branch `enhance/dashboard`)

All four phases implemented, committed, and verified. 206 tests green; typecheck + lint clean.

- **Phase 1** — `[Bookings | Portfolio]` switcher, shared date filter, wider 8-color
  on-brand chart palette (light+dark), `InfoHint`, shared `CHART_TOOLTIP` (dark-mode fix),
  tab preferences, page split (hidden tab never queries).
- **Phase 2** — Bookings redesign: compact KPI cards with real period-over-period deltas
  (badge hidden when no baseline — fixes the "5% on 0 bookings" bug), side-by-side donut
  legend, paginated activity, team-performance cards, mini-calendar team filter
  (`/api/bookings/by-day?team=` intersected fail-closed with scope), color-coded +
  capitalized status chips, info-hints, fixed quick-add (`?add=1` deep-links), and removal
  of pipeline / payment-method / per-team-revenue / weekday widgets.
- **Phase 3** — Privacy-clean page-view tracking: `PageviewRollup` + TTL `PageviewVisitorSeen`
  models, salted daily `visitorHash` / `classifySource` / bot filter, `recordPageview`
  (test-and-set unique visitors), hardened public beacon (bot filter → per-IP + per-(IP,slug,page)
  rate limits → Zod → published-slug resolve → record, always 204), client `PageViewBeacon`
  mounted in the public layout, and best-effort inquiry counter.
- **Phase 4** — Portfolio analytics dashboard (Vercel-style): totals/timeseries/per-page/
  top-sources reads, headline cards + views/visitors bar + sources + per-page + publish
  status + site inquiries, with the date filter wired in (workspace-tz day buckets).

**Unified date filter:** one date filter sits to the left of the tab switcher and applies to
BOTH dashboards. Modes: All time / Up until / Between / Starting from (native `<input
type=date>`, workspace-tz day boundaries). It threads through every windowed loader on both
tabs — bookings KPIs (range-scoped totals; deltas vs the preceding equal window for a fully
bounded range, hidden for half-open/all-time; outstanding stays point-in-time), revenue trend,
event-type, team cards, and all portfolio reads. Inherently-current widgets (today/upcoming,
the navigable mini-calendar) and the cumulative top-clients list are intentionally not
range-scoped. Default landing: bookings = this month (with deltas), portfolio = all-time.

**Verification:** Both dashboards driven in-browser at 375/768/1280 + dark mode (dark-mode
chart tooltip legible). Portfolio populated (via seeded rollups, since cleaned) + empty states;
the live beacon was confirmed recording end-to-end. Unified filter verified: a "Between" June
range re-scoped the bookings dashboard (event-type 25 → 3) and persists across the tab switch.

**Security review:** no critical/high findings. Verified: the public beacon never trusts a
client workspaceId, persists no raw IP/UA/referrer, is bot-filtered + layer-rate-limited, and
always returns 204; tenant isolation holds on every new query; team-filter intersection is
fail-closed. Low/medium findings (half-open ranges, per-page visitors, refund reconciliation,
$lookup defense-in-depth) were fixed.

**Env:** `PAGEVIEW_SALT_SECRET` (optional; falls back to `ACTIVE_WORKSPACE_COOKIE_SECRET`).

**Local tooling note:** `.claude/tdd-guard/data/config.json` (gitignored) adds `*.tsx` to
ignorePatterns so the guard enforces TDD on `.ts` logic while Playwright covers `.tsx` views.

## Context

Gallurio's feature set is complete; the dashboard now needs a redesign. Today there is a
single owner dashboard at `app/[locale]/(app)/dashboard/` with ~14 widgets, minimalist
teal-heavy charts, a hard-to-read pipeline, mock KPI percentages, status text that isn't
color-coded or capitalized, a calendar blind to teams, and no portfolio/visitor analytics
at all.

This work splits the dashboard into **two** dashboards toggled by a `[Bookings | Portfolio]`
segmented switcher (right of the "Welcome back" greeting), redesigns the Bookings dashboard
for compactness + clarity + team insight, and builds a brand-new **Portfolio** dashboard
(Vercel-metrics style) backed by new privacy-friendly page-view tracking plumbed into the
public portfolio pages. Both dashboards gain shared date filters and a wider-but-on-brand
chart palette.

### Decisions locked (from clarifying Q&A)
- **Geo: skip in v1.** No MaxMind / external geo API / new dependency. Show traffic
  source/referrer breakdown instead of a countries map; add geo later.
- **Tracking: anonymous aggregate counters.** Daily rollup docs, no individual pageview
  rows, no cookies, no consent banner. Unique visitors deduped via a daily-rotating salted
  HMAC of IP+UA (raw IP/UA never stored).
- **Bookings widgets kept:** revenue trend, top clients, today/upcoming/recent lists (plus
  the named-to-keep: 4 KPI cards redesigned, event-type donut, mini-calendar+team selector,
  recent activity paginated, new team cards). **Cut:** pipeline funnel, transactions-by-method,
  transactions-by-team (folds into team cards), weekly-bookings bar, **and payment-method**.
- **Delivery:** phased commits on `enhance/dashboard`, one PR at the end.
- **Timezone (now IN scope):** all day bucketing — bookings, inquiries, and both dashboards —
  must agree on the **workspace timezone**, not UTC. Reuse `lib/utils/timezone.ts`
  (`FALLBACK_TZ="Asia/Manila"`, `dayBoundInTz`, `wallTimeInTzToUtc`) and Mongo's `timezone`
  option on `$dateToString`/`$dateTrunc`. See the Timezone section below.
- **Rate limiting (emphasized):** the public metrics beacon gets layered abuse controls, not
  just a single per-IP bucket. See the hardened Phase 3 beacon section.

---

## Phase 1 — Shared foundation & visual system

Unblocks both dashboards. Pure scaffolding + tokens; no behavior removed yet.

**Tokens / palette (`app/globals.css`)**
- Extend `--chart-1..5` -> `--chart-1..8` in both `:root` and `.dark`, and register
  `--color-chart-6..8` in the `@theme` block. Keep teal (`--brand`, hue 195) as `--chart-1`
  accent (~10-20%); widen across mid-luminance/moderate-chroma hues legible in BOTH themes
  (indigo 250, amber 60, coral 25, violet 300, green 150, gold 95, slate neutral). Dark
  variants nudge L up ~+0.06.
- Dashboard compactness: shrink grid gaps `gap-4 -> gap-3` (KPI strip + section grids); opt
  dashboard cards into soft frames with `rounded-[var(--radius)]` (0.25rem) locally — do NOT
  change the global `--radius-surface` token. Bars get `radius={[2,2,0,0]}`.

**Shared utils / primitives (CREATE)**
- `lib/charts/tooltip.ts` — exported `CHART_TOOLTIP` with themed `contentStyle` + **`itemStyle`
  + `labelStyle`** all = `var(--popover-foreground)`. Fix for the black-tooltip-text bug: the
  offender is `transactions-by-team-bar.tsx` (latent in `-method-bar`), which set only
  `contentStyle.color`; recharts colors each tooltip item by its series/Cell color (dark team
  hues -> invisible in dark mode). Spread `{...CHART_TOOLTIP}` onto every `<Tooltip>`.
- `components/ui/info-hint.tsx` — `<InfoHint label>`: accessible `(i)` button built on the
  existing base-ui `components/ui/tooltip.tsx` (opens on hover AND focus, keyboard, `aria-label`,
  `focus-visible:ring-ring`, `bg-foreground text-background` so it inverts and stays readable in
  dark mode). Far-right in each card header.
- `lib/dashboard-preferences.ts` + `lib/dashboard-preferences.server.ts` — mirror of the
  existing `lib/view-preferences*.ts`: `DashboardTab = "bookings"|"portfolio"`, default
  `"bookings"`, cookie `gallurio_dashboard_tab`, `persistDashboardTab`, `resolveStoredDashboardTab`.
- `lib/dashboard/date-range.ts` — `parseDashboardRange(searchParams)` -> `{ from: Date|null, to:
  Date|null, mode }` from `?dmode=until|between|since` + `?from`/`?to` (native dates). `until` ->
  `(-inf,to]`, `since` -> `[from,+inf)`, `between` -> `[from,to]`, none -> all-time.

**Switcher + date filter (CREATE, client)**
- `_components/dashboard-tabs.tsx` — wraps `SegmentedToggle` (confirmed API:
  `{value, onChange, options:[{key,label,icon}], ariaLabel}`), options
  `bookings`(CalendarCheck2Icon) / `portfolio`(LayoutTemplateIcon). Writes `?tab=` (omit for
  default) + persists; preserves `?from/?to/?dmode` on toggle.
- `_components/dashboard-date-filter.tsx` — `SegmentedToggle` mode picker (until/between/since)
  + 1-or-2 native `<input type="date">` + Clear. Writes `?dmode/?from/?to`. No date lib.

**Page split (`page.tsx` MODIFY)**
- Resolve `tab` + `range` from awaited `searchParams`; keep `requireOrg()` owner gate.
- Header row: greeting (left) + `<DashboardTabs>` (right) on `sm:`; `<DashboardDateFilter>` below.
- Render ONLY the selected tab's section so the hidden tab never queries. Extract two async
  server sections: `_components/bookings-dashboard.tsx` and `_components/portfolio-dashboard.tsx`,
  each owning its own `Promise.all`.

**Commit:** "foundation: palette, switcher, date filter, info-hint, dashboard split".

---

## Phase 2 — Bookings dashboard redesign

All in `app/[locale]/(app)/dashboard/_components/` + `_data/dashboard-metrics.ts`.

1. **KPI cards** (`kpi-strip.tsx` rewrite) — compact layout: larger icon left, label+trend on
   row 1, value on row 2 (`[ic] label (percent)` / `[..] value`), `flex items-center gap-3 p-3`
   (~30% shorter). **Fix the percentage bug:** add `getKpiSnapshotWithDeltas()` to
   `dashboard-metrics.ts` computing real current-vs-previous-equal-window deltas; when prior
   period is `0` (or for point-in-time "outstanding balance"), return `null` so `TrendBadge`
   hides — no more "5% with 0 active bookings". Delete `MOCK_TRENDS` from `page.tsx`.
2. **Event-type donut** (`event-type-donut.tsx`) — `CardContent` -> `flex-row items-center gap-4`;
   pie fixed `h-40 w-40 shrink-0`, legend becomes `flex-1` column beside it so height matches
   neighbor cards. Keep center total. Use new palette.
3. **Activity feed** (`activity-feed.tsx`) — convert to client; show first 6, "Show more / Show
   less" toggle (`useState`); raise loader limit to ~20. Capitalized + color-coded statuses.
4. **Team performance cards (NEW)** `_components/team-performance-cards.tsx` (render only when
   `teams.length > 1`):
   - Card A leaderboard — rows colored by `team.color`, revenue (from existing
     `getTransactionsByTeam`) + booking count (new `getBookingsCountByTeam()`), bar = revenue/max,
     most-successful first; inactive teams muted + line-through.
   - Card B mini bar — bookings per team (recharts, Cells = team color, `CHART_TOOLTIP`).
   - Add `getBookingsCountByTeam(workspaceId, range?)` to `dashboard-metrics.ts`
     (`$match status != draft` + window -> group teamId -> join Team).
5. **Mini calendar team selector** (`mini-booking-calendar.tsx`) — header selector defaulting to
   "All teams", reusing the bookings team options (`getBookingTeamOptions` / `TeamPicker`). Thread
   `teamIds` into `getBookingsByDay` (already supports it) and into `app/api/bookings/by-day/route.ts`
   (read `?team=`, intersect with owner scope before querying).
6. **Status chips everywhere** — replace raw `{status}` in `todays-events-list.tsx`,
   `recent-inquiries-list.tsx`, `activity-feed.tsx` with a small chip using `STATUS_COLOR_VAR`
   (`lib/bookings/status-style.ts`) for bookings + `--event-inquiry`/neutral for inquiry statuses,
   labels from `messages.*.bookings.statusValues` / `inquiries.statusValues` (capitalization from
   the catalog, not CSS).
7. **Quick-add fix** (`quick-add.tsx`) — current `/bookings/new`, `/clients/new`, `/inquiries/new`
   are **dead routes** (creation is modal). Repoint Booking -> `/bookings?add=1` (confirmed param).
   Clients/inquiries use local-state modals (`client-form-modal.tsx`) with no deep-link — add a
   small `?add=1` open-on-load to those two pages for parity (preferred), else point to the list page.
8. **InfoHints** — add `<InfoHint>` to every card header (far-right) with per-section copy.
9. **Delete cut widgets** + their dead loaders: `pipeline-funnel.tsx`,
   `transactions-by-method-bar.tsx`, `transactions-by-team-bar.tsx`, `weekly-bookings-bar.tsx`;
   remove `getPipelineCounts`, `getTransactionsByMethod`, `getBookingsByWeekday` from
   `dashboard-metrics.ts` (KEEP `getTransactionsByTeam`, `getBookingsByDay`).

**Commit(s):** KPI+deltas / donut+activity / team cards+calendar selector / status chips+quick-add+cuts.

---

## Phase 3 — Portfolio analytics tracking infra

Privacy-friendly aggregate counters. All new; no UI yet.

**Models (CREATE, `lib/db/models/`)**
- `PageviewRollup.ts` — one doc per `(workspaceId, date[workspace-local midnight, stored as the
  UTC instant of that local midnight], page)` where `page in {home, gallery, contact, _site}`.
  Fields: `views`, `visitors`, `inquiries` (on `_site`), `sources: Map<string,number>` (on `_site`).
  Unique index `{workspaceId,date,page}` (upsert target) + `{workspaceId,date}` (range reads).
  `_site` holds portfolio-wide totals so summing per-page docs never double-counts.
- `PageviewVisitorSeen.ts` — ephemeral dedup set: `{workspaceId,date,scope,visitorHash,expiresAt}`,
  unique `{workspaceId,date,scope,visitorHash}` (atomic test-and-set) + TTL index on `expiresAt`
  (`expireAfterSeconds:0`, set to date+48h to absorb clock skew / midnight straddle). Insert
  succeeds -> new unique -> bump `visitors`; `E11000` -> already counted -> skip.
- Export both from `lib/db/models/index.ts`.
- **Day bucketing is workspace-local:** the beacon resolves the workspace timezone at write time
  (`workspace.timezone ?? FALLBACK_TZ`) and computes the rollup `date` via `dayBoundInTz(today, tz,
  0,0,0,0)` so a day's views align with the owner's calendar day (consistent with bookings).
  Have `resolveWorkspaceIdBySlug` also return `timezone`. The daily salt still rotates on UTC date —
  dedup correctness doesn't depend on the bucket tz, only counter assignment does.

**Hashing / classification (CREATE, `server-only`)**
- `lib/analytics/pageview.ts` — `dailySalt()` = `HMAC(secret, "pv-salt:"+UTC-date)` (rotates at
  UTC midnight with **no cron**; reuse `PAGEVIEW_SALT_SECRET` env, fallback to an existing server
  secret). `visitorHash(ip,ua)`, `utcMidnight()`, `classifySource(referrer,utm,ownHost)` (bounded
  keyspace: utm_source > referrer-host > "direct", lowercased, strip `.`/`$`, <=32 chars),
  `isBotUserAgent(ua)` (regex + missing/short UA).
- `lib/analytics/recordPageview.ts` — upserts: `$inc views` on `(ws,date,page)` and `(ws,date,_site)`;
  test-and-set `_site` visitor -> `$inc visitors` + `$inc sources.<bucket>`. All ops throw to caller.

**Public beacon (CREATE) — layered rate limiting / abuse control**
- `app/api/public/pageviews/route.ts` (Node runtime). Order of cheap-reject gates before any DB write:
  1. **Bot-UA filter** + missing/short-UA reject -> 204 (no work).
  2. **Per-IP token bucket** `rateLimit("pv:"+ip, {limit:60, windowMs:60_000})` -> 204 over limit.
  3. **Per-IP+slug+page cap** `rateLimit("pv:"+ip+":"+slug+":"+page, {limit:10, windowMs:60_000})`
     — stops a single client inflating one page's counters.
  4. **Zod-bounded inputs** (`orgSlug<=64`, `page` enum, `referrer<=1024`) -> 204 on parse fail.
  5. `resolveWorkspaceIdBySlug` (published-only; add slim `_id`-only resolver to
     `lib/db/queries/publicPage.ts`) -> 204 if not found -> `recordPageview`.
  - When a request is rate-limited, **skip the `PageviewVisitorSeen` write entirely** so a flood
    can't amplify TTL-collection writes.
  - Whole body in try/catch; **every path returns 204** (never 500 the page; raw IP/referrer
    never stored). Reuse `getClientIp` from `app/api/inquiries/route.ts`.
  - **Per-instance caveat (Hetzner):** `lib/server/rateLimit.ts` is in-memory, so limits are
    per-Node-instance. Add a layer at the reverse proxy: a Caddy/Nginx `limit_req`/rate-limit
    rule on `/api/public/pageviews` (document in RELEASE-CHECKLIST). The app limiter blunts casual
    abuse; the proxy rule is the real ceiling. Optional bounded-damage backstop: ignore new
    `sources` Map keys once a rollup doc already has N (e.g. 50) buckets.
- `app/(public)/w/[orgSlug]/_components/PageViewBeacon.tsx` (`"use client"`): derive `page` from
  `usePathname()`, `useRef`-guard one fire per path, `fetch(POST, keepalive:true)` with
  `document.referrer`; all failures ignored. Mount in `app/(public)/w/[orgSlug]/layout.tsx`
  beside `MotionObserver`. Contact is a modal -> fire `page:"contact"` on modal open if the
  trigger exposes a hook; otherwise ship Home/Gallery in v1 (inquiry count is the contact signal).

**Inquiry counter (`lib/server/inquirySubmission.ts` MODIFY)** — after the existing transaction
commits, best-effort (outside the txn) `$inc _site.inquiries` for the day; `.catch` log-only.

**Env** — document `PAGEVIEW_SALT_SECRET` in `.env.example` / release checklist.

**Commit:** "portfolio analytics: rollup models + beacon + inquiry counter".

---

## Phase 4 — Portfolio dashboard + date wiring + i18n + tests

**Read layer (CREATE `_data/portfolio-analytics.ts`, `server-only`)** — all filter `workspaceId`
+ date range, backed by `{workspaceId,date}`: `getPageviewTimeSeries` (fill day gaps in JS like
`getRevenueTrend`), `getAnalyticsTotals` (views/visitors/inquiries + `conversionRate =
inquiries/max(visitors,1)`), `getPerPageBreakdown`, `getTopSources` (`$objectToArray` on `sources`).

**Portfolio dashboard UI (`_components/portfolio-dashboard.tsx`)** — Vercel-metrics style:
- Headline metric cards: total views, unique visitors, inquiries, conversion rate (reuse the new
  compact KPI card layout).
- **Bar graph: views + visitors over time** (recharts, `CHART_TOOLTIP`, honors date filter).
- **Inquiries from the site** (count + reuse `RecentInquiriesList`).
- **Top sources/referrers** breakdown (bar or list) — stands in for the deferred countries map.
- **Per-page breakdown** (Home/Gallery/Contact).
- Publish status card: published vs draft, last-published, public URL `/w/{orgSlug}`, "Open editor".
- All windowed by the shared date filter.

**Date wiring** — thread `range` into both dashboards' loaders (`getRevenueTrend`, `getKpiSnapshot…`,
`getTopClients`, `getEventTypeBreakdown`, team queries, all portfolio reads). Month-bound loaders
(KPI revenue) use the range when present, else current month.

**i18n (all 4 locales `en/fil/ms/id`)** — add `app.dashboard.{tabs,dateFilter,sections,hints,
activity,team,portfolio}` keys. Reuse existing `bookings.statusValues`/`inquiries.statusValues`
+ `bookings.teamPicker.*`.

**Tests** — `dashboard-metrics` deltas + `getBookingsCountByTeam`; `portfolio-analytics`
aggregations (mirror `dashboard-metrics.test.ts`); beacon route (bot filter, rate limit, bad
input -> 204, dedup increments once); inquiry-counter increment; tenant isolation on all new
queries. In-memory Mongo, mock only external services.

**Commit(s):** portfolio reads+UI / date wiring / i18n / tests.

---

## Timezone sync (cross-cutting)

Make day boundaries agree across bookings, inquiries, and both dashboards using the **workspace
timezone** — no UTC drift. Reuse `lib/utils/timezone.ts` (no new deps).

- **Resolver:** add `resolveWorkspaceTimezone(workspace) = workspace.timezone ?? FALLBACK_TZ`
  (small helper in `lib/utils/timezone.ts`); pass the resolved tz from `requireOrg()` into every
  data loader.
- **Aggregations:** add the IANA `timezone` option to every `$dateToString`/`$dateTrunc`/`$dayOfWeek`
  in `dashboard-metrics.ts` (currently UTC — file already flags this as the follow-up at lines
  159-160) and in the new `portfolio-analytics.ts`. Fixes revenue-trend, bookings-by-day, and any
  weekday bucketing so they match the calendar day.
- **Date-filter boundaries:** `parseDashboardRange` converts `?from`/`?to` (YYYY-MM-DD) to UTC
  instants via `dayBoundInTz(dateStr, tz, …)` (start = 00:00:00.000, end = 23:59:59.999) so the
  range means the owner's local day, applied uniformly to bookings + portfolio queries.
- **Rollups:** written in workspace-local day (see Phase 3 model note); reads bucket the same way,
  so the portfolio bar graph's "today" equals the owner's today.
- **Inquiries:** any inquiry day grouping on the dashboard uses the same tz (inquiries already store
  UTC `createdAt`; only the bucketing tz changes). Verify existing inquiry-facing dashboard reads.

## Key files

| Area | Path |
|---|---|
| Page split | `app/[locale]/(app)/dashboard/page.tsx` |
| Bookings data | `app/[locale]/(app)/dashboard/_data/dashboard-metrics.ts` |
| Portfolio data (new) | `app/[locale]/(app)/dashboard/_data/portfolio-analytics.ts` |
| KPI / donut / activity / calendar / team cards | `app/[locale]/(app)/dashboard/_components/*` |
| Switcher / date filter / info-hint (new) | `dashboard-tabs.tsx`, `dashboard-date-filter.tsx`, `components/ui/info-hint.tsx` |
| Rollup models (new) | `lib/db/models/PageviewRollup.ts`, `PageviewVisitorSeen.ts` |
| Beacon (new) | `app/api/public/pageviews/route.ts`, `app/(public)/w/[orgSlug]/_components/PageViewBeacon.tsx` |
| Analytics libs (new) | `lib/analytics/pageview.ts`, `recordPageview.ts` |
| Tokens | `app/globals.css` |

**Reuse (do not reinvent):** `components/ui/segmented-toggle.tsx`, `lib/view-preferences*.ts`,
`bookings/_components/team-picker.tsx` + `view-toggle.tsx`, `app/api/bookings/by-day/route.ts`,
`components/ui/tooltip.tsx`, `lib/bookings/status-style.ts`, `getClientIp`/`rateLimit()` from the
inquiry route, `RecentInquiriesList`, `lib/utils/timezone.ts`.

---

## Verification

- **Unit/integration:** `pnpm test --run` for touched areas (dashboard-metrics, portfolio-analytics,
  beacon route, inquiry counter, tenant isolation). Full sweep at pre-merge.
- **Typecheck + lint:** `pnpm typecheck` + `pnpm lint`.
- **Tracking end-to-end (Playwright CLI):** load a public `/w/[orgSlug]` page -> confirm beacon POST
  returns 204 and a `PageviewRollup` doc increments; reload (same session) -> `views` increments but
  `visitors` does not (dedup); submit a contact inquiry -> `_site.inquiries` increments.
- **Both dashboards (Playwright, 3 breakpoints 375/768/1280):** switcher toggles tabs and persists;
  date filter modes (until/between/since/clear) re-window the data; KPI badges hide when no prior
  period; donut legend sits beside the pie; activity "show more" works; calendar team selector
  filters counts; status chips are colored + capitalized; **tooltips readable in dark mode**;
  InfoHints open on hover + keyboard focus and are legible in dark mode; quick-add links land on a
  working create flow.
- **States:** every async card shows loading/empty/error/populated; empty-state when a workspace has
  no traffic/teams/bookings yet.
- **Timezone:** a booking/inquiry/view near local midnight buckets into the same calendar day across
  bookings views, inquiry views, and both dashboards (test a workspace tz != UTC, e.g. Asia/Manila).
- **Rate limiting:** the beacon rejects (204) past the per-IP and per-IP+slug+page caps and does not
  increment counters or write dedup rows when throttled.

## Out of scope (v1)
- Visitor geo/countries map (deferred — sources breakdown stands in).
- Distributed/shared rate-limit store (app limiter is in-memory per-instance; the reverse-proxy
  `limit_req` rule is the real ceiling, documented in RELEASE-CHECKLIST).
