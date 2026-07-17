# Dashboard analytics redesign implementation plan

## Goal

Replace low-value dashboard visualizations with two decision-focused views:

- Portfolio: exposure -> intent -> inquiry conversion.
- Bookings: scheduled workload -> booking value -> collection coverage.

This plan is written for Claude's fixed seven-seat roster. The orchestrator is
the only participant allowed to edit either dashboard composition file.

## Locked scope

### Portfolio dashboard

1. Phase the Sources card out of the rendered dashboard. Do not migrate or
   delete historical `sources` rollup data in this change.
2. Add an inquiry pipeline card: New, Booked (including legacy Converted), and
   Archived.
3. Replace the existing traffic chart with visitor-days and inquiries over
   time.
4. Add a three-stage funnel: portfolio visitor-days -> contact visitor-days ->
   inquiries submitted.
5. Add an inquiry demand profile: event-type mix, requested-event month, and
   median inquiry lead time.
6. Keep recent inquiries as an operational list, but label it as current rather
   than implying that the dashboard date filter controls it.

### Bookings dashboard

1. Clarify KPI semantics:
   - `Scheduled bookings` instead of ambiguous `Active bookings`.
   - `Collected revenue` remains payment-date scoped.
   - `Outstanding balance` is visibly marked as a current snapshot.
2. Replace the event-type donut with a stacked event-type trend.
3. Add a booked-hours heatmap based on actual session duration.
4. Add scheduled booking value versus collected amount for bookings in the
   selected event-date range.
5. Add collection coverage: scheduled value, collected to date, and remaining
   balance.
6. Keep calendar, today, upcoming week, quick-add, and activity under a clearly
   separate Operations section.

## Metric definitions

These definitions are part of the contract and must not drift between agents.

| Metric | Definition |
|---|---|
| Portfolio visitor-days | Sum of daily `_site.visitors`; this is not a range-wide distinct-person count. |
| Contact visitor-days | Sum of daily `contact.visitors`, recorded through the existing pageview endpoint when the contact modal opens. |
| Portfolio inquiries | Sum of `_site.inquiries` in the selected range. |
| Portfolio submission rate | Inquiries / portfolio visitor-days. |
| Contact completion rate | Inquiries / contact visitor-days. |
| New inquiries | `status: inquiry`, created in the selected range. |
| Booked inquiries | `status: booked` or `converted`, created in the selected range. |
| Archived inquiries | `status: archived`, created in the selected range. |
| Scheduled bookings | Bookings with `status: booked` whose first session begins in the selected range. |
| Booked hours | Sum of session duration intersecting each workspace-local calendar day; exclude draft and cancelled bookings. |
| Scheduled booking value | `Booking.amount.total` for booked/completed bookings whose first session begins in the selected range. |
| Collected against scheduled work | Net deposit/balance/refund transactions linked to those selected bookings, regardless of payment date. |
| Remaining balance | `max(scheduled booking value - collected against scheduled work, 0)`. |
| Collected revenue KPI | Net deposit/balance/refund transactions whose `paidAt` is inside the selected range. |

The scheduled-value chart and collection card measure the same booking cohort.
The existing revenue KPI measures cash movement during the period and therefore
must retain a distinct label and hint.

## Funnel instrumentation

Do not add a new route or analytics collection.

`PageviewRollup` already supports the `contact` page bucket, and
`/api/public/pageviews` already validates that value. When `ContactModal`
transitions from closed to open, send the same fire-and-forget beacon with
`page: "contact"`. Repeated opens may increment views, while the existing
daily visitor marker keeps `contact.visitors` deduplicated for the funnel.

The funnel must show `Collecting data` when the selected range predates contact
tracking or has portfolio traffic but zero contact visitor records. Do not
present a historical zero as proof that nobody opened the form.

## Target layout

### Portfolio

```text
KPI strip: Visitor-days | Inquiries | Submission rate | Booked leads

Visitors + inquiries over time (2/3) | Conversion funnel (1/3)

Inquiry pipeline (1/3) | Demand profile (2/3)

Recent inquiries / portfolio status actions
```

### Bookings

```text
KPI strip: Collected revenue | Scheduled bookings | New inquiries | Outstanding

Scheduled value + collected coverage (2/3) | Collection coverage (1/3)

Booked-hours heatmap (2/3) | Event-type trend (1/3)

Team performance

Operations: calendar | today | upcoming | quick add | activity
```

At 375 px every grid becomes one column. Charts must remain readable without
horizontal page scrolling; dense legends may become compact lists beneath the
chart. At 768 px use two-column groupings where they remain legible. At 1280 px
use the proportions above.

## Fixed-team execution

Use one flat roster only. No subagent may spawn another agent.

### Phase 0 - orchestrator preparation

1. Create `.claude/worktrees/dashboard-analytics-redesign` from `dev` on an
   appropriately named branch.
2. Index that worktree once with codebase-memory because this is a broad fan-out
   task; give every reader/executor the same project name.
3. Read and inject no more than 300 relevant lines into each executor prompt.
   Executors receive resolved context and exact file ownership; they do not
   explore broadly.
4. Record the pre-existing dirty state and never overwrite unrelated changes.

### Phase 1 - two `lean-reader` seats in parallel

Reader A returns only relevant excerpts/signatures for portfolio analytics,
`PageviewRollup`, `PageviewVisitorSeen`, `PageViewBeacon`, `ContactModal`, and
their tests.

Reader B returns only relevant excerpts/signatures for bookings, transactions,
session splitting/duration helpers, chart primitives, dashboard tests, and
locale keys.

The orchestrator converts these results into final prop and return-type
contracts before dispatching executors.

### Phase 2 - four executor seats in parallel

#### `senior-backend-engineer` A - portfolio data only

Owned files:

- `app/[locale]/(app)/dashboard/_data/portfolio-analytics.ts`
- `app/[locale]/(app)/dashboard/_data/portfolio-analytics.test.ts`

Deliver typed queries for:

- visitor-days plus inquiries daily series, including zero-day normalization;
- inquiry pipeline;
- contact funnel;
- demand profile.

Every query includes `workspaceId`, honors the workspace-local selected range,
and has isolation, empty-state, and boundary tests. Leave `getTopSources`
available but unused unless the orchestrator later confirms it has no callers.

#### `senior-backend-engineer` B - booking analytics only

Owned files:

- new `app/[locale]/(app)/dashboard/_data/booking-analytics.ts`
- new `app/[locale]/(app)/dashboard/_data/booking-analytics.test.ts`

Deliver typed queries for:

- event-type trend;
- booked-hours heatmap;
- scheduled value and collected amount series;
- collection coverage snapshot.

Reuse existing timezone/session helpers where correct. Explicitly test
multi-session, overnight, refund, cancelled/draft exclusion, workspace
isolation, and empty ranges. Do not edit UI or the existing composition/data
loader file.

#### `senior-frontend-engineer` A - portfolio UI only

Owned files:

- new `portfolio-visitors-inquiries-chart.tsx` plus test;
- new `portfolio-conversion-funnel-card.tsx` plus test;
- new `portfolio-lead-pipeline-card.tsx` plus test;
- new `portfolio-demand-profile-card.tsx` plus test;
- `app/(public)/w/[orgSlug]/_components/ContactModal.tsx` and its focused test.

Build entirely from typed props supplied in the prompt. Do not import dashboard
queries and do not edit `portfolio-dashboard.tsx`. Contact tracking uses the
existing endpoint and must never affect modal opening or submission on failure.

#### `senior-frontend-engineer` B - booking UI only

Owned files:

- new `booking-value-collection-chart.tsx` plus test;
- new `collection-coverage-card.tsx` plus test;
- new `booked-hours-heatmap.tsx` plus test;
- new `booking-event-type-trend-chart.tsx` plus test.

Build from typed props only. Do not edit `page.tsx`, existing data loaders, or
locale files. Use semantic chart tokens, accessible text equivalents, RTL-safe
layout, and populated/empty states. Dashboard data is server-rendered, so these
cards do not invent client loading/error states that cannot occur independently.

Each executor runs only its focused tests and reports exact exports plus any
handoff needed from the other boundary. Executors do not stage or commit in
parallel.

### Phase 3 - orchestrator-only integration

Only the orchestrator edits:

- `app/[locale]/(app)/dashboard/page.tsx`
- `app/[locale]/(app)/dashboard/_components/portfolio-dashboard.tsx`
- `messages/en.json`
- `messages/fil.json`
- `messages/ms.json`
- `messages/id.json`
- `messages/ar.json`
- this consolidated dashboard document if implementation details changed.

Integration work:

1. Wire all server queries into the two active dashboard paths.
2. Remove Sources from portfolio composition and replace the old chart/cards.
3. Replace the donut in bookings composition and add the financial/workload
   cards.
4. Separate Analytics from Operations visually.
5. Consolidate all locale handoff keys in one pass to prevent JSON conflicts.
6. Remove imports orphaned by this change. Do not delete old components until
   `rg` confirms they have no callers and deletion remains within scope.

### Phase 4 - verification

1. Run every affected data and component test.
2. Run `rtk tsc`, `rtk lint`, and `rtk next build` when summarized output is
   sufficient.
3. Run Playwright CLI against 375, 768, and 1280 px:
   - portfolio populated and empty/collecting states;
   - bookings populated and empty states;
   - date-filter changes;
   - contact modal open records analytics without breaking the public flow;
   - RTL layout in Arabic.
4. Confirm no chart relies on color alone and every interactive control has a
   keyboard/focus state.
5. Refresh the codebase-memory index after the integrated changes.

### Phase 5 - `senior-reviewer`

The reviewer performs a strict read-only review of the integrated diff,
dashboard behavior, tenant isolation, metric semantics, mobile/RTL behavior,
and test coverage. Save the review in the single dashboard summary document or
fold its durable findings into this file; do not create scratch review files.

The reviewer applies no fixes. The orchestrator sends each confirmed finding
back to the appropriate original executor as a follow-up, then repeats focused
verification. Merge to `dev` requires explicit user approval.

## Estimated execution time

With the four executor seats working in parallel, this is approximately 5-8
hours of implementation and verification, assuming no unexpected historical
data or chart-library issue. The funnel begins producing accurate contact-stage
data only after deployment; older ranges cannot be backfilled reliably.

## Visual reference

Layout / information-hierarchy references (not pixel-perfect specs):
`docs/dashboard/portfolio-dash-reference.jpeg` and
`docs/dashboard/bookings-dashboard-reference.jpeg`. Where their sample labels
conflict with the real Gallurio status model, the metric definitions in this
plan win.

## Implementation outcome (2026-07-17)

Built as specified. Notable decisions and deviations:

- **Executors ran as two waves of parallel seats** (not four-at-once) and never
  ran builds/typecheck — the orchestrator owns all builds, run one at a time
  (local RAM constraint). codebase-memory indexing was skipped: resolved context
  was injected into each executor, so no shared graph was needed.
- **Bookings extras retained:** the Revenue-trend chart (collected cash by
  `paidAt` over time) and Top-clients-by-spend bar were kept in an analytics
  extras row. Neither is redundant — the new booked-value/collected chart buckets
  by *event date* and its "collected" ignores payment date, and no other card
  shows per-client spend.
- **Inquiry pipeline** is New / Booked(+Converted) / Archived only. The reference
  image's sub-statuses ("Proposal sent", "Negotiation", …) have no backing field
  in the `Inquiry` model and were deliberately NOT fabricated.

### Verification

- `tsc --noEmit` clean; new files lint-clean (the 3 repo ESLint errors are
  pre-existing in unrelated files).
- Unit tests green across both `_data` modules, all 8 new components, and the
  ContactModal beacon.
- Visually verified in a real browser at 375 / 768 / 1280 px and Arabic RTL
  (portfolio + bookings). The funnel's "Collecting data" state and all card
  empty states render correctly; no horizontal page overflow at any breakpoint.
- Live QA caught a cross-boundary unit mismatch: `coveragePct` was returned as a
  0–1 fraction but the card renders 0–100 → fixed to return a percentage.

### Senior review outcome

Clean on tenant isolation, refund netting, day/week/overnight bucketing, the
frontend/backend boundary, locale completeness, and mobile/RTL. Findings fixed:

1. **(Major)** Conversion funnel showed a false "0% of opened" on the
   inquiry-submitted row when contact tracking was absent — now drops the
   of-opened clause (mirrors the "Collecting data" treatment).
2. **(Minor)** `getCollectionCoverage.coveragePct` clamped to [0, 100] in the
   query (was unclamped; the card already clamped for display).
3. **(Minor)** Funnel "% of opened" capped at 100% (stages are not strictly
   nested: per-submission inquiries vs daily-deduped contact visitor-days).

### Deferred follow-ups (nits, out of this change's scope)

- Orphaned portfolio queries left dead by the redesign
  (`getPageviewTimeSeries`, `getPerPageBreakdown`); `getPageviewTimeSeries` also
  buckets by raw UTC rather than workspace tz (latent, moot while unused).
  `getTopSources` is intentionally retained per the plan. Remove in a cleanup
  pass once confirmed no future consumer.
- The coverage "as of" snapshot date and the dashboard greeting date use the
  server clock, not the workspace timezone (cosmetic near-midnight edge).
