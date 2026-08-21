# Currency conversion

Two separate things use one FX source:

1. **Local price estimate** — the Pro subscription price is shown with an
   approximate equivalent in the visitor's currency (`≈ $4.30 · billed in PHP`).
   Display only. Lemon Squeezy always charges the store currency by variant id.
2. **Workspace roll-up** — dashboard totals convert every booking and
   transaction into the workspace currency before summing, so a workspace with
   a USD-paying client still gets one correct PHP figure.

## Why the app does this and not Lemon Squeezy

Lemon Squeezy has a single store currency, used across its dashboard, checkout
and receipt emails. There is no per-country currency setting and no purchasing
power parity — [it is an open feature request](https://lemonsqueezy.nolt.io/445),
not a configuration option. So the estimate is ours to compute, and the amount
charged stays in the store currency regardless of what the visitor is shown.

## Files

| File | Role |
| --- | --- |
| `lib/pricing/fxRates.ts` | Fetches the daily USD rate table, caches it 24h, returns `null` on any failure |
| `lib/pricing/countryCurrency.ts` | ISO country → currency table, USD fallback |
| `lib/pricing/localPricing.ts` | `getDisplayPricing()` — live LS price + local estimate |
| `lib/pricing/currencyConverter.ts` | `buildRateMap` / `convertAmount` / `convertedAmountExpr` |
| `lib/pricing/workspaceRates.ts` | `getWorkspaceRateMap()` — which currencies a workspace stores |
| `components/app/local-price-note.tsx` | The `≈ … · billed in …` line |

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

The page reads no database and both inputs are process-cached (LS pricing 1h,
FX table 24h), so the per-request cost is template rendering only. Restoring a
static shell would mean moving the estimate to a client fetch against a new
public endpoint plus ISR — more surface for no benefit this page needs.

## Provider

Open Exchange Rates, via the existing `OPENEXCHANGERATES_APP_ID`. The free plan
serves one USD-based table per call (`base` is a paid feature), so every
non-USD pair is cross-rated off that table — one fetch a day covers every
currency in the app on the success path; a failed fetch is retried on the next
call, so a sustained outage can consume quota faster.

The ECB feed (`api.frankfurter.dev`) was rejected: it publishes ~30 currencies
and none of the Gulf ones, which would leave the `ar` locale without rates.

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

- Visit `/pricing` from outside the Philippines (or with a proxy). A second
  muted line appears under the price: `≈ $4.30 · billed in PHP`.
- With the key unset, that line is simply absent and the PHP price renders
  alone. This fail-closed guarantee covers the price estimate only; the
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

## Known limitations

- **Rates are indicative.** Daily reference rates, not the rate a card issuer
  or Lemon Squeezy applies. Never present a converted figure as an amount
  charged.
