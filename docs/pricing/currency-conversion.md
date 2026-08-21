# Currency conversion

Two separate things use one FX source:

1. **Local price headline** — the Pro subscription price is shown in the
   visitor's own currency (`$4.30 / month`), with the amount Lemon Squeezy
   actually charges named underneath (`Billed as ₱250 PHP`). The headline is a
   conversion, not a quote: Lemon Squeezy always charges the store currency by
   variant id.
2. **Workspace roll-up** — dashboard totals convert every booking and
   transaction into the workspace currency before summing, so a workspace with
   a USD-paying client still gets one correct PHP figure.

## Which currency a figure is shown in

| Surface | Headline | Subtitle |
| --- | --- | --- |
| Public price surfaces (landing teaser, `/pricing`, `/subscribe`, onboarding plan, settings billing) | the visitor's own currency | `Billed as ₱250 PHP` — what Lemon Squeezy charges |
| Booking list rows, calendar | workspace currency | none |
| Booking detail, client detail bookings/payments | the record's own currency | workspace equivalent; rate + date when the money froze one |
| Dashboard KPIs, Total Spent, top clients | workspace currency | none |
| Booking export (CSV/XLSX) | the record's own currency | `workspaceAmountTotal` / `workspaceCurrency` columns |

Two rules drive the table. In-app, the workspace has one currency, so any
record that does *not* use it carries a subtitle naming what it is worth in
that currency, and a record that does use it carries no subtitle at all. Lists
and aggregates are the exception: a column of mixed currencies cannot be
scanned or summed by eye, so those convert and show one currency.

On public pages the visitor has no workspace, so the headline is their own
currency — a price only reads as a price in a currency you use daily. If the
rate table has no entry for it, the headline falls back to USD rather than to
the store currency. The amount actually charged is always named underneath;
that line disappears only when the visitor already uses the store currency.
`headlinePrice()` (`lib/pricing/displayPrice.ts`) picks the pair, and
`BilledAsNote` renders the disclosure — dropping the trailing ISO code in
locales that format the amount with the code already.

## Why the app does this and not Lemon Squeezy

Lemon Squeezy has a single store currency, used across its dashboard, checkout
and receipt emails. There is no per-country currency setting and no purchasing
power parity — [it is an open feature request](https://lemonsqueezy.nolt.io/445),
not a configuration option. So the estimate is ours to compute, and the amount
charged stays in the store currency regardless of what the visitor is shown.

## Files

| File | Role |
| --- | --- |
| `lib/pricing/fxRates.ts` | Reads the daily USD rate table from `FxRateTable`, falls back to fetching it directly, returns `null` only when no table is stored at all |
| `lib/db/models/FxRateTable.ts` | `FxRateTable` (daily snapshot) / `FxFetchLock` (single-flight claim lease) |
| `app/api/cron/fx-rates/route.ts` | Daily cron: fetches Open Exchange Rates once, upserts today's `FxRateTable` doc |
| `lib/pricing/countryCurrency.ts` | ISO country → currency table, USD fallback |
| `lib/pricing/localPricing.ts` | `getDisplayPricing()` — live LS price + the visitor's own currency (USD when unrateable) |
| `lib/pricing/displayPrice.ts` | `headlinePrice()` — picks the headline figure and the billed figure to disclose |
| `lib/pricing/currencyConverter.ts` | `buildRateMap` / `convertAmount` / `convertedAmountExpr` |
| `lib/pricing/workspaceRates.ts` | `getWorkspaceRateMap()` — which currencies a workspace stores |
| `components/app/billed-as-note.tsx` | The `Billed as ₱250 PHP` line under the headline |
| `components/app/fx-subtitle.tsx` | The `≈ ₱48,440 · rate … · date` line under an in-app record |

Country comes from Cloudflare's `CF-IPCountry` header (production sits behind
proxied Cloudflare DNS). It is spoofable when the origin is reached directly,
which is harmless: it only picks which approximate figure to render. Unknown or
absent country falls back to USD.

### `/pricing` renders per request, deliberately

Reading `CF-IPCountry` opts `/pricing` out of prerendering. That is the correct
trade here, not a regression to undo.

The Docker build only receives `NEXT_PUBLIC_*` build args
(`.github/workflows/release.yml`), so `LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID` and
its yearly counterpart are unset during `next build`. `getProPricing()`
therefore returns its `staticFallback` — the hardcoded `PLAN_CATALOG` PHP
amounts — and a prerendered `/pricing` baked those into the HTML for all five
locales, serving a fixed price until the next image build regardless of what
Lemon Squeezy said. Per-request rendering is what makes the page agree with
live pricing at all.

LS pricing is process-cached 1h. The FX table is process-memoized ~15 min
(see "Storage and refresh" below) and normally comes straight from that memo
or the day's already-fetched `FxRateTable` doc, so the per-request cost stays
template rendering plus a cheap indexed read, not a network call. Restoring a
static shell would mean moving the estimate to a client fetch against a new
public endpoint plus ISR — more surface for no benefit this page needs.

## Provider

Open Exchange Rates, via the existing `OPENEXCHANGERATES_APP_ID`. The free plan
serves one USD-based table per call (`base` is a paid feature), so every
non-USD pair is cross-rated off that table — a daily cron makes exactly one
fetch a day cover every currency in the app; see "Storage and refresh" below
for how the request path avoids ever re-hitting the API itself in steady
state.

The ECB feed (`api.frankfurter.dev`) was rejected: it publishes ~30 currencies
and none of the Gulf ones, which would leave the `ar` locale without rates.

## Storage and refresh

The rate table lives in Mongo (`FxRateTable`, `lib/db/models/FxRateTable.ts`),
one document per UTC day keyed `_id: "YYYY-MM-DD"` (sorts lexicographically, so
"latest" is `sort({ _id: -1 }).limit(1)`, no extra index). It is deliberately
not `workspaceId`-scoped — global market data with no tenant dimension, unlike
every other collection in this repo. History is kept, not overwritten: each
day is ~5KB and it doubles as the audit trail behind a restated frozen rate
(see "Changing the workspace currency" below).

`getFxRate()`/`resolveFxFreeze()` (`lib/pricing/fxRates.ts`) read three layers,
Open Exchange Rates last:

1. **In-process memo, ~15 min.** Keeps per-render work off Mongo.
2. **Today's `FxRateTable` doc**, written by the daily cron below. This is the
   only layer that runs in steady state — the request path never calls Open
   Exchange Rates when the cron has already done its job for the day.
3. **Fallback fetch, only when today's doc is missing** (the cron failed or
   hasn't run yet). Before calling the API, the caller takes a claim lease —
   a single lock row (`FxFetchLock`, `_id: "fx-fetch-lock"`) claimed via
   `findOneAndUpdate({ _id, lockedUntil: { $lt: now } }, { $set: { lockedUntil: now + 60s } }, { upsert: true })`.
   One container wins and fetches; every other container (including a
   duplicate-key race two containers can hit upserting the same lock row at
   the same instant) skips the fetch and falls through to step 4. Without
   this, N running containers would all miss the cache at once and each fire
   its own request against the same 1,000/month quota.
4. **Stale-if-error.** A failed or skipped fetch still serves whatever table
   is already stored, however old — an outage degrades conversions to
   "yesterday's rate," never to "no conversion at all." `getFxRate()` returns
   `null` only when there is no stored table whatsoever (a cold start against
   a broken upstream) — the existing fail-open contract callers already
   depend on.

`app/api/cron/fx-rates/route.ts` is the daily job: Node runtime, the same
timing-safe Bearer `CRON_SECRET` auth as the other cron routes (401 without a
match), calls Open Exchange Rates once, and upserts today's `FxRateTable` doc.
Idempotent — firing it twice the same day just overwrites with the same data,
so a retry or manual re-run is harmless. In steady state this route is the
only caller of Open Exchange Rates: 1 fetch/day × ~31 days/month, against the
1,000/month free quota.

### VPS systemd timer

Same pattern as the other scheduled jobs in `docs/modules/hosting-ops.md`
("Scheduled jobs (systemd timers, not Vercel Cron)") — reuses the same
`/etc/gallurio/cron.env` (`CRON_SECRET`, `APP_ORIGIN`) that
`gallurio-billing-lifecycle`/`gallurio-invite-seats` already read. Unit files:
`deploy/systemd/gallurio-fx-rates.service` and
`deploy/systemd/gallurio-fx-rates.timer`.

```
sudo cp deploy/systemd/gallurio-fx-rates.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gallurio-fx-rates.timer
```

The timer stanza:

```
[Timer]
OnCalendar=*-*-* 00:15:00 UTC
Persistent=true
RandomizedDelaySec=60
```

00:15 UTC — shortly after Open Exchange Rates' daily publish, ahead of
business hours in every market Gallurio serves. `Persistent=true` catches up a
run missed by downtime/reboot; a missed run is not urgent on its own since
stale-if-error keeps serving the last table indefinitely. Status:
`systemctl list-timers`, `journalctl -u gallurio-fx-rates.service`.

## Adding it to the VPS

`OPENEXCHANGERATES_APP_ID` is a **server-side runtime secret**. It goes in the
VPS environment file only — **not** GitHub Actions.

GitHub Actions only builds and publishes the image; the VPS supplies runtime
env. `deploy/README.md` states the rule directly: application secrets "remain
only in `/etc/gallurio/gallurio.env` on the VPS." Only `NEXT_PUBLIC_*` values
are build-time and belong in Actions — this key is not one of them, and putting
it there would bake a secret into a published image layer.

On the VPS, as a user with sudo:

```sh
# 1. Append the key to the runtime env file (root-owned, group-readable by gallurio)
sudo sh -c 'printf "OPENEXCHANGERATES_APP_ID=%s\n" "<your-app-id>" >> /etc/gallurio/gallurio.env'

# 2. Confirm the file's permissions are unchanged
sudo ls -l /etc/gallurio/gallurio.env   # expect -rw-r----- root gallurio

# 3. Recreate the container so it picks up the new environment
cd /opt/gallurio
docker compose up -d --wait

# 4. Verify the app is healthy
curl --fail --silent --show-error 'http://127.0.0.1:3000/api/health?ready=1'
```

Get the App ID from <https://openexchangerates.org> → App IDs. Do not print the
value into shell history you keep, and do not commit it.

### Verifying it works

- Visit `/pricing` from outside the Philippines (or with a proxy). The headline
  price is in your own currency and a muted line under it reads
  `Billed as ₱250 PHP`.
- With the key unset, the PHP price is the headline and that line is absent. This fail-closed guarantee covers the price estimate only; the
  workspace roll-up falls back to summing raw amounts.
- Server logs print `[fx] Failed to fetch reference rates, currency conversion
  disabled: …` when the API call itself fails.

## Frozen rate on payments and `Client.totalSpent`

A booking's `amount` and each of its `payments[]` carry `fxRate` / `fxTarget` /
`fxAt`. The rate is frozen **once**, the moment a payment first becomes `paid`
— `fxTarget` is the workspace currency at that instant, and the rate is never
recaptured even if the payment is later edited. This is the primary path for
"what did this paid amount actually convert to."

The freeze lives on `Booking`, not on `Transaction`: `syncBookingPaymentsForClient`
deletes and recreates every `type: "balance"` `Transaction` on each booking
edit, so a rate stored only on the ledger row would re-freeze at today's rate
on every edit instead of staying pinned to the original payment date. Each
derived `Transaction` gets a **copy** of its source payment's `fx*` fields so
the ledger can still show the same frozen figure without owning it.

Only *collected* money freezes. Scheduled/expected amounts (an unpaid
`amount.total`, a booking with no paid payments yet) have no rate to freeze
and stay live-converted. Legacy rows written before this shipped, and rows
where FX was unavailable at the moment of payment, also have null `fx*` — read
paths fall back to the live rate map for those, and the UI omits any frozen-rate
subtitle rather than guessing.

`Client.totalSpent` stays a **raw, unconverted** running sum in the currencies
each booking used, written by `lib/db/clientTransactions.ts` — independent of
any frozen `fx*` on the underlying payments. It is converted at **read** time
instead, by `getConvertedClientTotals`, which re-derives the total from the
`Transaction` ledger (`type: deposit|balance` — the same definition the write
path uses) with `frozenOrLiveAmountExpr` (prefers each row's frozen rate when
`fxTarget` matches the current workspace currency, else falls back to the live
rate map).

Live-map fallback is still what keeps the clients table and the dashboard
agreeing on rows without a usable frozen rate — there is no way for the user
to tell which of two disagreeing figures is right, so both read paths apply
the same preference order.

Conversion is applied at every place the total is rendered labelled with the
workspace currency:

| Site | How |
| --- | --- |
| Clients list | `listClients({ rates })` |
| Client detail modal | `getClientByIdAction` → `getClientById(…, rates)` |
| Dashboard top clients | `getTopClients(wid, 5, rates)` — ranks off the converted ledger, since the stored field is not a valid sort key for a mixed-currency workspace |

Single-currency workspaces skip the conversion, but still pay the two
`distinct` queries that resolve the rate map (memoized per workspace for 5
minutes — see `getWorkspaceRateMap`). `getTopClients` keeps its
`sort({ totalSpent: -1 })` — there is no `{workspaceId, totalSpent}` index on
`Client`.

## Changing the workspace currency: restatement + cooldown

`Workspace.currency` is editable in Settings → Workspace. Because every frozen
row's `fxTarget` is the workspace currency **at the moment it froze**, simply
flipping `currency` would silently break every existing frozen row — none of
their `fxTarget`s would match the new currency, so they'd all fall back to
live conversion, the exact drift freezing exists to prevent.

`lib/pricing/currencyRestatement.ts` (`changeWorkspaceCurrency`,
`previewCurrencyRestatement`) instead treats a currency change as an explicit
restatement, wired into `updateWorkspaceBusinessAction`
(`app/[locale]/(app)/settings/_actions.ts`):

1. Find every booking with an already-frozen payment or deposit
   (`payments[].fxRate` or `amount.fxRate` non-null), scoped by `workspaceId`.
2. Resolve today's rate for **every distinct original `amount.currency`**
   among them, before any write. If any is unresolvable, abort with no writes
   at all — all-or-nothing, same reasoning as `buildRateMap`'s fallback, but
   surfaced as a hard error here instead of silently degrading to unconverted,
   since silently degrading is exactly the bug this restates.
3. Re-freeze `payments[].fx*` and `amount.fx*` from each row's **original**
   `amount.currency` at today's rate — never chained off the stale `fxTarget`,
   which would compound a second conversion into a number meant to be exact.
4. Copy the same rate onto the derived `Transaction` rows
   (`type: "deposit" | "balance"`) that already carry a frozen `fx*`, via a
   direct `updateMany` rather than replaying `syncBookingPaymentsForClient` —
   `amount`/`price` never change here, only `fx*`, so there is nothing to
   resync on the `Client.totalSpent` side (it stays untouched, per the
   raw-unconverted-sum rule above).
5. Stamp `Workspace.currencyChangedAt = now` **only when something was
   actually restated**. A workspace with no paid money changes currency
   freely and never engages the cooldown.

A 90-day cooldown (`CURRENCY_CHANGE_COOLDOWN_DAYS`) then blocks the next
change while `currencyChangedAt` is set, enforced server-side in
`changeWorkspaceCurrency` — the settings UI's disabled state is an affordance,
not the gate.

The restatement and the rest of the settings write share **one** transaction:
`updateWorkspaceBusinessAction` opens the session and passes it in
(`changeWorkspaceCurrency({ …, session })`), so neither half of a submit can
survive alone. A rejected currency change saves none of the other fields, and
a failing field write — a duplicate slug racing past the pre-check into the
unique index — rolls back the re-frozen rows and the `currencyChangedAt` stamp
with it. Without that, an owner could be told the save failed while a real
90-day cooldown had already started.

## Pricing tiers

Two price tiers of the same Pro plan, sold as two Lemon Squeezy variant
pairs:

| Tier | Monthly | Yearly | Who |
| --- | --- | --- | --- |
| `base` | $5 | $50 | Everyone by default, including the launch market (PH) |
| `global` | $15 | $150 | A fixed list of 28 high-income countries |

`lib/pricing/pricingTier.ts` (`tierForCountry`) holds the country list and
resolves it from `CF-IPCountry` — same header `countryCurrency.ts` reads, but
a separate, short, explicit table: a currency-guess miss just shows an odd
number, a tier miss changes what Lemon Squeezy actually charges. Tier is
**always** resolved server-side, in `lib/pricing/localPricing.ts` (display)
and `app/api/billing/checkout/route.ts` (charging) — never accepted from the
client or request body.

Absent country, `XX` (Cloudflare's own unknown code), and `T1` (Tor) all
resolve to `base`. In production Cloudflare always sets `CF-IPCountry`, so a
missing value means the origin was reached directly (proxy bypassed) rather
than a real unknown visitor — defaulting to the cheap tier leaks less than
overcharging a launch-market buyer whose header didn't arrive.

Lemon Squeezy renews a subscription against the variant it was created with,
not a re-evaluated tier — a customer who relocates after subscribing keeps
their original price. `Workspace.lsVariantId`, written by every subscription
snapshot (`lib/billing/subscriptionSnapshot.ts`), records which variant a
subscriber is actually on so settings can show what they actually pay;
existing subscribers (all sold at base price, before this shipped) read
`null`, which is correct — it reads as base tier.

`lib/lemonsqueezy/plans.ts#getProVariantsForTier` resolves a tier's variant
ids and offline fallback amounts; `PLAN_CATALOG`'s single `"pro"` entry always
carries the base pair, so every other consumer (entitlements, settings,
onboarding) keeps working unchanged. `getProPricing(tier)`
(`lib/lemonsqueezy/pricing.ts`) caches live pricing per tier, 1h TTL each.
`planForVariantId` checks all four variant ids (base + global, monthly +
yearly) so a global-tier subscriber's webhook maps to `"pro"` too.

## Known limitations

- **Rates are indicative.** Daily reference rates, not the rate a card issuer
  or Lemon Squeezy applies. Never present a converted figure as an amount
  charged.
